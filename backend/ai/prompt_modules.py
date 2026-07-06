# backend/ai/prompt_modules.py
# ============================================================
# Modular prompt system. Instead of one 15k-token prompt that
# covers everything, each request gets BASE_RULES + only the
# modules its intent needs (typically 2-4k tokens total).
# Cheaper, faster, and the model follows relevant rules better.
# ============================================================
import re
import copy
from typing import Any, Dict, List

# ------------------------------------------------------------------
# BASE — always included
# ------------------------------------------------------------------
BASE_RULES = """
You are an expert front-end developer. Output ONE valid JSON object with four keys: "aiTemplate", "properties", "editableProps", "script".

## OUTPUT
- aiTemplate: a single <div class="UNIQUE_CLASS"> containing a scoped <style> tag and the HTML. All editable text/colors/sizes are Mustache tokens {{...}}.
- properties: initial value for EVERY token. Data-connected elements also get "schema_id": "<uuid>".
- editableProps: [{key,label,type}] for EVERY token. Types: text, color, image, number. ALWAYS append {"key":"slot_key","label":"⚡ Agent Slot Key","type":"text"} last, and "slot_key":"" to properties.
- script: raw JS (no <script> tags), arrow functions only, no console.log.

## CSS
- Every rule prefixed with the unique class (.cls button {...}; never bare selectors or :root).
- Outer container: background transparent; width:100%; display:flex; justify-content:center; align-items:center. Design (colors/borders/shadows) goes on INNER elements.
- Collections: display:grid; grid-template-columns:repeat(auto-fit,minmax(min({{cardMinWidth}},100%),1fr)); gap:{{gap}}; width:100%.
- Card images: width:100%; height:200px; object-fit:cover. Cards: display:flex; flex-direction:column; height:100%; buttons pushed down with margin-top:auto.
- Inputs/buttons in cards: width:100%; box-sizing:border-box. Disabled: .cls button:disabled{opacity:.5;cursor:not-allowed}.
- No fixed pixel widths on containers (max-width + width:100%). Flex rows get flex-wrap:wrap. Tables wrapped in <div style="overflow-x:auto;width:100%">.
- Always include, scoped: @media (max-width:768px){ .cls{padding:12px!important;overflow-x:hidden!important} .cls .grid-container{grid-template-columns:1fr!important} .cls .flex-container{flex-direction:column!important} .cls .card{width:100%!important;min-width:unset!important} }

## JAVASCRIPT
- `container` is INJECTED — never declare it. Only container.querySelector, never document.querySelector. Give elements descriptive classes and select by class (never :nth-child or bare tag selectors when ambiguous).
- Action buttons use btn.onclick — NEVER form.onsubmit — unless it is a classic contact form (<form onsubmit="return false;"> + e.preventDefault() first line).
- Every async op: disable button + loading text → try/catch → restore in finally. Errors: alert(err.response?.data?.detail || 'Something went wrong.') — the server returns readable 409/422 messages.
- Deletes: if (!confirm('Are you sure you want to delete this item?')) return;
- Empty lists render "No items found". Never overwrite container.innerHTML — write into a child (.list-container etc).

## MUSTACHE (STRICT)
- Only {{var}} and {{{html}}} exist. NO {{#if}}, {{#eq}}, {{#unless}}, no helpers.
- Conditional classes/content: compute in JS before Mustache.render (rowData.borderClass = ok ? 'border-green-500' : 'border-gray-200') and use {{data.borderClass}} in HTML.
- Every token added to aiTemplate MUST exist in properties AND editableProps.

## DATA SAFETY
- Row id is row.row_id (never row.id). schemaId is injected — never declare or hardcode it. Lists come back as res.data.rows.
- Booleans arrive as 'true'/'false' strings: check (v===true||v==='true'). Numbers: Number(x).toFixed(2). Galleries: typeof g==='string'?JSON.parse(g):(g||[]). Relations: row.data.item?.data?.item_name with optional chaining.
""".strip()

# ------------------------------------------------------------------
# MODULES — included per intent
# ------------------------------------------------------------------
MODULE_CRUD = """
## DATA API
- Read:   api.get(`/custom-data/rows/${schemaId}?skip=${skip}&limit=${limit}`) → res.data.rows, res.data.total
- Create: api.post(`/custom-data/rows/${schemaId}`, { data, sitemember_id })  (server validates required/unique/options → catch and show err.response?.data?.detail)
- Update: api.put(`/custom-data/rows/${rowId}`, { data: mergedData, sitemember_id })  — fetch-merge-update ONLY for non-competitive edits (own todo, own note). Competitive writes (booking/stock/credits) use the ATOMIC endpoint instead.
- Delete: api.delete(`/custom-data/rows/${rowId}?sitemember_id=${smId}`)
- Search: api.post(`/custom-data/rows/${schemaId}/search?skip=&limit=`, { filters:{ title:{ilike:q}, price:{'>=':min,'<=':max}, status:"active" }, sort_by:"created_at", sort_order:"desc" })
- Bulk (2+ rows → ONE call, never in a loop): api.post(`/custom-data/rows/${schemaId}/bulk`, { operations: arr.map(d=>({action:"create", data:d, sitemember_id})) })

## OWNERSHIP (sitemember_id)
- Not user-scoped → null everywhere.
- PUT/DELETE on a row the USER created → currentUserId (null gives 403). On a SHARED/admin-created row (booking a slot) → null (currentUserId gives 403). Rule: match whoever created the row.
- NEVER use the zero UUID "00000000-..." — it is rejected on public sites.

## RENDERING FETCHED ROWS (CRITICAL)
{{tokens}} in aiTemplate are ONLY for owner-editable settings (title, colors, button text). Row data must NEVER be a static {{token}} — Mustache does not loop; those tokens render as literal "{{name}}" text on the page.
Build each row's HTML inside the script with template literals reading row.data:
let rows = []; // top-level
const fetchAndRenderRows = async () => {
  const res = await api.get(`/custom-data/rows/${schemaId}?skip=${page*limit}&limit=${limit}`);
  rows = res.data.rows;
  if (!rows.length) { list.innerHTML = '<p>No items found</p>'; return; }
  list.innerHTML = rows.map(r => `
    <div class="row-card">
      <div class="row-main"><strong>${r.data.name ?? ''}</strong> <span>${r.data.email ?? ''}</span></div>
      <p>${r.data.inquiry ?? ''}</p>
      <button class="edit" data-id="${r.row_id}">Edit</button>
      <button class="delete" data-id="${r.row_id}">Delete</button>
    </div>`).join('');
  attachEventListeners();
};
Use (r.data.field ?? '') fallbacks for every field; relations via r.data.field?.data?.some_name; booleans via (v===true||v==='true'); adapt the inner HTML/classes to the actual schema fields and requested design.
attachEventListeners: loop container.querySelectorAll('.edit'/'.delete'), read btn.getAttribute('data-id'), apply loading/confirm rules, refresh via fetchAndRenderRows(). API-calling listeners are attached ONCE per render pass — never nested inside another render loop.
""".strip()

MODULE_ATOMIC = """
## ATOMIC UPDATES (bookings, stock, credits, likes, votes)
For any competitive write, ONE race-safe call — never fetch→check→PUT:
try {
  await api.post(`/custom-data/rows/${targetRowId}/atomic`, {
    conditions: { available: true },              // server rejects 409 if stale
    set_values: { available: false, booked_by: name },
    increments: { stock: -1 },                    // numeric add/subtract
    sitemember_id: null                           // or currentUserId if the user owns the row
  });
} catch (err) {
  if (err.response?.status === 409) alert(err.response.data.detail); // "already taken / out of stock"
}
Likes: increments:{likes:1}. Spend credits: conditions:{}, increments:{credits:-1} with a min guard via conditions if needed. No manual availability checks anywhere.
""".strip()

MODULE_STATS = """
## STATS & CHART DATA (never aggregate client-side, never fetch-all-to-sum)
- One number: api.post(`/custom-data/rows/${schemaId}/stats`, {field:"amount", operation:"sum", filters:{}}) → res.data.result
- Grouped (charts/leaderboards): api.post(`/custom-data/rows/${schemaId}/stats/grouped`, {group_by:"category", field:"amount", operation:"sum", filters:{}}) → res.data.results = [{group, value}] sorted desc. operation:"count" needs no field.
- Unique values (dropdown options): api.get(`/custom-data/rows/${schemaId}/distinct/day`) → res.data.values
- User-scoped: append ?sitemember_id=${currentUserId}.
- Display: assign directly (el.textContent = res.data.result) — never +=, never fetch stats inside a render loop; fetch once, after any bulk save completes.
""".strip()

MODULE_UPSERT = """
## PROFILE / SETTINGS / SINGLE-RECORD-PER-USER
One call creates OR updates — no "profile not found" handling, no branching:
await api.post(`/custom-data/rows/${schemaId}/upsert`, {
  match: { sitemember_id: currentUserId },        // or { email: emailValue }
  data:  { username, bio },
  sitemember_id: currentUserId
});
Prefill the form with api.get(`/custom-data/rows/${schemaId}?sitemember_id=${currentUserId}&limit=1`) — empty rows just means a fresh form.
""".strip()

MODULE_USER_SCOPE = """
## USER-SCOPED DATA ("my items", "current user", "logged in user")
const currentUserId = typeof window !== 'undefined' ? localStorage.getItem('siteMemberId:' + (properties.subdomain || '')) : null;
if (!currentUserId) { container.innerHTML = '<p>Please log in to view your data</p>'; return; }
Reads: append ?sitemember_id=${currentUserId}. Writes: sitemember_id: currentUserId (including every bulk operation). Deletes: ?sitemember_id=${currentUserId}.
Do NOT filter relational/reference dropdown data by user — only the main list.
""".strip()

MODULE_AI_GEN = """
## AI GENERATION (via api.post('/builder/openai', {website_id: properties.website_id, member_id, prompt, system_prompt}))
Pick the mode by destination BEFORE coding: saving rows → FLAT ARRAY; short text display → TEXT; complex UI (scores/panels/dashboards) → STRUCTURED UI.

ALWAYS strip before parsing (all modes):
let cleanText = aiRes.data.text.replace(/```json/g,'').replace(/```/g,'').replace(/^json\\s*/i,'').replace(/^JSON\\s*/i,'').trim();

FLAT ARRAY MODE — system_prompt = context + THIS EXACT SUFFIX (mandatory, never skip):
  " THE SILENCE RULE: Reply ONLY with a flat raw JSON array. Every item = one database row. No nested objects, no wrapper keys, no markdown, no chat. Example: [{\\"field1\\":\\"value\\"}]"
Then: fix bare words → cleanText = cleanText.replace(/:\\s*([a-zA-Z]+[a-zA-Z0-9]*)\\s*([,}\\]])/g,(m,w,n)=> (w==='true'||w==='false'||w==='null')?m:`: "${w}"${n}`);
Extract: const jm = cleanText.match(/\\{[\\s\\S]*\\}|\\[[\\s\\S]*\\]/); if(!jm) throw new Error('No parsable data'); const arr = Array.isArray(JSON.parse(jm[0]))?JSON.parse(jm[0]):[JSON.parse(jm[0])];
Save with ONE bulk call (see DATA API), sitemember_id stamped per the ownership rules.

TEXT MODE — system_prompt ends with "Reply with plain text only. No JSON, no markdown, no backticks." Then el.textContent = cleanText. Never JSON.parse plain text.

STRUCTURED UI MODE — count the UI panels first; system_prompt = context + "Return a separate array for each of the N sections shown in the UI — never combine them. Each array item must be an object with title and description fields — never plain strings." + THE SILENCE RULE variant ("Reply ONLY with valid raw JSON... First character must be { or [").
NEVER read parsedData by hardcoded key names (the model renames keys every run). Use the resilient extractor:
const normalize = a => Array.isArray(a) ? a.map(i => typeof i==='string' ? {title:i,description:''} : i) : [];
const score = Object.values(parsedData).find(v=>typeof v==='number')||0;
const summary = Object.values(parsedData).find(v=>typeof v==='string'&&v.length>100)||'';
const extractArrays = (o,d=0)=>{ if(d>2) return []; const r=[]; for(const [k,v] of Object.entries(o)){ if(Array.isArray(v)&&v.length) r.push({key:k,label:k.replace(/_/g,' ').replace(/\\b\\w/g,c=>c.toUpperCase()),items:normalize(v)}); else if(v&&typeof v==='object'&&!Array.isArray(v)) r.push(...extractArrays(v,d+1)); } return r; };
Render extractArrays(parsedData) as panels; check el exists before writing. Add website_id to properties only; systemPrompt to properties+editableProps if user-editable.
""".strip()

MODULE_CHATBOT = """
## CHATBOT
Decision: questions only → READ-ONLY BOT. Booking/saving/emailing → ACTION-BASED BOT.
NON-NEGOTIABLE MECHANICS (both bots):
1. Send button = btn.onclick (inputs live in a div — form.onsubmit silently never fires).
2. Knowledge base + history go INSIDE system_prompt via buildSystemPrompt() — never as separate context/knowledge fields (the API ignores them). prompt = latest user message ONLY.
3. Call the API FIRST, push to chatHistory AFTER (both user + assistant together). Never slice(0,-1).
4. await loadContext() before every message (fresh rows). Truncate history to last 20 before each call. Always member_id: currentUserId.

let chatHistory = []; let businessContext = '';
const loadContext = async () => { try { const r = await api.get(`/custom-data/rows/${schemaId}?limit=100`); businessContext = r.data.rows.map(x=>x.data.info||JSON.stringify(x.data)).join('\\n'); } catch(e){ businessContext='No information available.'; } };
const buildSystemPrompt = () => `You are a helpful assistant.\\n\\nKNOWLEDGE BASE (live):\\n${businessContext}\\n\\nCONVERSATION SO FAR:\\n${chatHistory.map(m=>`${m.role}: ${m.content}`).join('\\n')}\\n\\nRULES:\\n- Answer from the knowledge base; summarize freely\\n- Only say you lack the info if it is genuinely absent\\n- Never invent prices/addresses/facts`;

ACTION-BASED BOT adds to buildSystemPrompt: mission (collect email ONCE, confirm ONCE, execute immediately on any positive confirmation, never re-ask known info) and the EXECUTION PROTOCOL — on confirmation reply ONLY raw JSON:
{"action":"execute_workflow","email":"...","steps":[{"db_action":"create|update|delete","db_target":"schema_id for create / row_id for update+delete","db_payload":{...},"owned":true|false}],"summary":"plain text"}
Executor: create → api.post(`/custom-data/rows/${step.db_target}`,{data:step.db_payload,sitemember_id:step.owned?currentUserId:null});
update → PREFER api.post(`/custom-data/rows/${step.db_target}/atomic`,{conditions:step.db_conditions||{},set_values:step.db_payload,sitemember_id:step.owned?currentUserId:null}) for slot/stock changes (409 = taken); otherwise fetch-merge-PUT.
delete → api.delete(`/custom-data/rows/${step.db_target}?sitemember_id=${step.owned?currentUserId:null}`).
After all steps: optional email via api.post('/builder/send-email',{website_id:properties.website_id,to_email:cmd.email,subject:properties.emailSubject||'Confirmation',content:(properties.emailBody||'')+(cmd.summary||'')}); then push history, render "✅ "+cmd.summary. Non-JSON replies render as normal chat. emailSubject/emailBody in properties+editableProps.
""".strip()

MODULE_CHARTS = """
## DASHBOARD / CHARTS
- Load Chart.js dynamically; ALL chart code inside script.onload. Wrap each <canvas> in <div style="position:relative;width:100%">. Container: width:100%;max-width:100%;overflow-x:hidden.
- Data comes from /stats and /stats/grouped (see STATS module) — never fetch all rows to compute totals. Grouped results map directly: labels = results.map(r=>r.group), data = results.map(r=>r.value).
- Sanitize fallbacks: parseFloat(String(v).replace(/[^0-9.,-]/g,'').replace(',','.'))||0.
""".strip()

MODULE_ECOMMERCE = """
## E-COMMERCE / CART / CHECKOUT
- Never inline onclick="addToCart(...)". Use data-index + listeners attached in JS. Read qty/selects/addon checkboxes from btn.closest('.card') before calling addToCart({cartItemId:`${row.row_id}-${Date.now()}`, itemId:row.row_id, name:row.data.name, imageUrl:row.data.image||'', quantity, unitPrice, selectedExtras:[], selectedOptions}).
- Stock decrement on purchase → ATOMIC endpoint (increments:{stock:-1}, conditions e.g. {in_stock:true}).
- Checkout CTA gets class "checkout-btn"; no custom Stripe calls. Click isolation:
container.addEventListener('click',(e)=>{ if(!e.target.closest('.checkout-btn')){ e.stopImmediatePropagation(); e.preventDefault(); } }, true);
""".strip()

MODULE_UPLOADS = """
## FILE UPLOADS
Inside submit flow: if fileInput.files.length → btn 'Uploading...'; const fd=new FormData(); fd.append('file',fileInput.files[0]); const up=await api.post('/uploads/',fd); data[fileInput.getAttribute('name')] = up.data?up.data.url:up.url;
Multiple files (gallery): loop uploads, store JSON.stringify(urls) in a hidden input; hidden input value is what goes into data.
""".strip()

MODULE_EMAIL = """
## EMAIL SENDING (contact/notification forms)
await api.post('/builder/send-email', { website_id: properties.website_id, to_email: emailInput.value, subject: properties.emailSubject || 'Thank you', content: properties.emailBody || '<p>We received your message.</p>' });
Add website_id to properties; emailSubject + emailBody to properties AND editableProps.
""".strip()

MODULE_EXTERNAL_API = """
## EXTERNAL APIs (CORS-blocked services)
Use the proxy — const res = await api.post('/builder/fetch-external', { url, method:'GET'|'POST', headers, body: rawObject /* NEVER JSON.stringify */ });
The real payload is DOUBLE-WRAPPED: always read res.data.data. Auth keys via properties.apiKey (in editableProps only if the API needs a key; never hardcode).
""".strip()

MODULE_DYNAMIC_PAGES = """
## MASTER → DETAIL PAGES
Master link: const isMainHost = window.location.hostname.includes('zygoflow.com'); const basePath = isMainHost && properties.subdomain ? `/${properties.subdomain}` : ''; window.location.href = `${basePath}/detail-page?id=${rowId}`;
Detail: const rowId = new URLSearchParams(window.location.search).get('id'); guard missing id/row with a friendly message; fetch ?row_id= then res.data.rows.find(r=>r.row_id===rowId); map fields to DOM manually.
""".strip()

# ------------------------------------------------------------------
# INTENT ROUTER
# ------------------------------------------------------------------
_INTENT_MAP = [
    (["chat", "bot", "assistant", "concierge", "support agent"], [MODULE_CHATBOT, MODULE_CRUD]),
    (["chart", "graph", "dashboard", "kpi", "analytic", "leaderboard", "report"], [MODULE_CHARTS, MODULE_STATS, MODULE_CRUD]),
    (["book", "reserv", "slot", "appointment", "stock", "inventory", "credit", "like", "vote", "rsvp"], [MODULE_ATOMIC, MODULE_CRUD]),
    (["profile", "settings", "preference", "account page", "my account"], [MODULE_UPSERT, MODULE_USER_SCOPE, MODULE_CRUD]),
    (["my ", "current user", "logged in", "their own", "user-specific", "personal"], [MODULE_USER_SCOPE, MODULE_CRUD]),
    (["generate", "summariz", "analyz", "write ", "auto-fill", "extract", "score", "ai "], [MODULE_AI_GEN, MODULE_CRUD]),
    (["cart", "checkout", "buy", "purchase", "shop", "price", "product"], [MODULE_ECOMMERCE, MODULE_CRUD]),
    (["upload", "file", "photo", "image upload", "cv", "avatar", "gallery"], [MODULE_UPLOADS, MODULE_CRUD]),
    (["email", "notify", "contact form", "newsletter", "subscribe"], [MODULE_EMAIL, MODULE_CRUD]),
    (["external api", "weather", "fetch from", "third party", "cors"], [MODULE_EXTERNAL_API]),
    (["detail page", "master", "click to open", "product page", "blog post page"], [MODULE_DYNAMIC_PAGES, MODULE_CRUD]),
    (["form", "submit", "save", "table", "list", "track", "manage", "database", "store", "entries", "records", "crud", "sum", "total", "count"], [MODULE_CRUD, MODULE_STATS]),
]


def build_system_prompt(user_prompt: str, base: str = BASE_RULES) -> str:
    """BASE + only the modules this request needs. Order preserved, deduped."""
    p = (user_prompt or "").lower()
    chosen: List[str] = []
    for keywords, modules in _INTENT_MAP:
        if any(k in p for k in keywords):
            for m in modules:
                if m not in chosen:
                    chosen.append(m)
    if not chosen:
        chosen = [MODULE_CRUD]  # safe default for pure-visual elements too (harmless)
    return base + "\n\n" + "\n\n".join(chosen)


# ------------------------------------------------------------------
# LINT + REPAIR (turns prompt rules into deterministic code checks)
# ------------------------------------------------------------------
_MUSTACHE_COND = re.compile(r"\{\{[#/^]\s*(if|unless|eq|each)\b")
_TOKEN_RE = re.compile(r"\{\{\{?\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}?\}\}")

REPAIR_PROMPT = """
You are fixing a generated component. You will receive ERRORS TO FIX and the COMPONENT JSON.
Fix ONLY the listed errors. Change nothing else. Return the complete corrected JSON object (same four keys), no markdown, no explanation.
Reminders: Mustache supports only {{var}} and {{{html}}} — compute conditional classes in the script; `container` is injected, never declared; every template token needs matching entries in properties AND editableProps.
""".strip()


def lint_component(payload: Dict[str, Any]) -> List[str]:
    errors: List[str] = []
    tmpl = payload.get("aiTemplate", "") or ""
    script = payload.get("script", "") or ""
    props = payload.get("properties", {}) or {}
    eprops = payload.get("editableProps", []) or []

    if "document.querySelector" in script:
        errors.append("Replace every document.querySelector with container.querySelector.")
    if _MUSTACHE_COND.search(tmpl):
        errors.append("Remove Mustache conditionals ({{#if}}/{{#eq}}/{{#each}}...) — compute conditional classes/content in the script and expose plain {{tokens}}.")
    if re.search(r"\b(const|let|var)\s+container\b", script):
        errors.append("Do not redeclare `container` — it is injected by the runtime.")
    if "console.log" in script:
        errors.append("Remove all console.log calls.")

    tokens = set(_TOKEN_RE.findall(tmpl)) - {"data", "row_id"}
    missing_props = tokens - set(props.keys())
    if missing_props:
        if "custom-data/rows" in script:
            errors.append(
                f"Tokens {sorted(missing_props)} are in aiTemplate but not in properties. "
                "If they are ROW DATA fields: REMOVE them from aiTemplate and render the rows "
                "inside the script with template literals (row.data.<field>) — static Mustache "
                "tokens cannot display fetched rows. If they are owner-editable settings, add "
                "them to properties AND editableProps instead."
            )
        else:
            errors.append(f"Add these template tokens to properties (with sensible initial values): {sorted(missing_props)}")
    eprop_keys = {e.get("key") for e in eprops if isinstance(e, dict)}
    missing_eprops = tokens - eprop_keys - {"website_id", "schema_id", "all_schemas", "schema_fields", "subdomain"}
    if missing_eprops:
        errors.append(f"Add editableProps entries for: {sorted(missing_eprops)}")
    if "slot_key" not in eprop_keys:
        errors.append('Append {"key":"slot_key","label":"⚡ Agent Slot Key","type":"text"} as the last editableProps entry and "slot_key":"" to properties.')
    return errors


# ------------------------------------------------------------------
# DIFF-BASED REFINEMENT (replaces "return the whole JSON" refining)
# ------------------------------------------------------------------
REFINE_OPS_BASE = """
You modify an existing component based on a user request. You receive USER_PROMPT and CURRENT_COMPONENT_STATE.
Output ONLY: {"ops":[...]} — a list of operations to apply. No markdown, no explanation.

Operation format:
- {"op":"set","path":"properties.title","value":"New Title"} — replaces the value at the dot-path (numeric segments index arrays, e.g. "editableProps.3").
- {"op":"delete","path":"properties.oldKey"} — removes a key/index.

Rules:
- For HTML/CSS changes, set the entire "aiTemplate" string. For logic changes, set the entire "script" string. For value changes, set the specific property path.
- NEVER touch properties.schema_fields, properties.schema_id, properties.all_schemas, or properties.website_id.
- Every NEW {{token}} you introduce in aiTemplate needs: a set op for properties.<token>, and a set op replacing the whole "editableProps" array with the appended entry.
- Mustache has NO conditionals — conditional classes/content are computed in the script before Mustache.render and exposed as plain tokens.
- Preserve the unique class name and all existing behavior you weren't asked to change.
- api usage in scripts must follow the API rules appended below (if any).
""".strip()


def apply_ops(obj: Dict[str, Any], ops: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Apply set/delete ops to a deep copy. Structurally cannot lose untouched keys."""
    result = copy.deepcopy(obj)
    for op in ops or []:
        path = str(op.get("path", "")).split(".")
        if not path or path == [""]:
            continue
        target: Any = result
        try:
            for key in path[:-1]:
                if isinstance(target, list):
                    target = target[int(key)]
                else:
                    if key not in target or not isinstance(target[key], (dict, list)):
                        target[key] = {}
                    target = target[key]
            last = path[-1]
            if op.get("op") == "set":
                if isinstance(target, list):
                    idx = int(last)
                    if idx == len(target):
                        target.append(op.get("value"))
                    else:
                        target[idx] = op.get("value")
                else:
                    target[last] = op.get("value")
            elif op.get("op") == "delete":
                if isinstance(target, list):
                    target.pop(int(last))
                else:
                    target.pop(last, None)
        except (KeyError, IndexError, ValueError, TypeError):
            continue  # skip malformed op rather than failing the whole refine
    return result


# ------------------------------------------------------------------
# TWO-PASS PAGE GENERATION
# ------------------------------------------------------------------
PAGE_PLAN_PROMPT = """
You are a lead designer planning a landing page. Given the user's prompt, output ONLY this JSON:
{
  "theme": {"primaryColor":"#hex","accentColor":"#hex","bgDark":"#hex","bgLight":"#hex","textOnDark":"#hex","textOnLight":"#hex","fontFamily":"css font stack","mood":"one short phrase"},
  "sections": [{"section_type":"hero","layout":"row|column","description":"1-2 sentence brief for a section designer, including concrete copy hints"}]
}
Rules: 5-8 sections; hero first; footer last; pick a cohesive professional palette matching the business; every description must be self-contained (the section designer sees ONLY it plus the theme).
""".strip()


# ------------------------------------------------------------------
# DATA APP GENERATOR v3 (condensed — server now handles mutations,
# validation, dedup; automations replace crossTableMutations JS)
# ------------------------------------------------------------------
DATA_APP_PROMPT_V3 = """
You are an expert full-stack developer generating a self-contained CRUD data-table component styled with Tailwind CSS.

OUTPUT: one valid JSON object with keys: "name", "schema", "aiTemplate", "properties", "editableProps", "script", "automations".

## name
Human-readable, taken directly from the user's prompt (prompt "User Management System" → name "User Management System").

## schema
Array of {id, label, type}. id = lowercase snake_case. Types: text, number, email, date, boolean, image, gallery, file, relation.
- relation fields need "related_schema_id" — when the prompt mentions a concept matching an EXISTING_SCHEMAS_ON_WEBSITE entry, you MUST reuse its schema_id.
- You MAY (and should, where sensible) add validation keys the SERVER enforces: required(bool), unique(bool), default, min, max, options([...strings] → fixed dropdown). Examples: email unique for signups; required on essential fields; options for status/category fields.

## automations (server-side — REPLACES all client-side cross-table mutation JS)
If creating/updating a row must change ANOTHER table (booking marks a slot unavailable, an order decreases stock), do NOT write JS for it. Emit:
"automations": [
  {"trigger":"on_create","action_type":"mutate_row","config":{
     "source_field":"time",
     "conditions":{"available":true},
     "set":{"available":false},
     "increments":{},
     "condition_error":"That slot was just taken — please pick another."
  }}
]
source_field = the field in THIS schema that holds the related row_id. The server runs this atomically and rejects the create with 409 if conditions fail — your script only needs to catch the error and show err.response?.data?.detail. Emit [] when there are no cross-table effects.

## aiTemplate
- <style> scoped to the given unique_class_name, MUST include:
  .{cls} .title { color: {{titleColor}}; }   .{cls} .add-new-btn { background-color: {{buttonBgColor}}; }
- Main container: class "p-6 bg-white rounded-xl shadow-lg border border-gray-100".
- Header div "flex justify-between items-center mb-6" with <h3 class="text-2xl font-bold title">{{title}}</h3> and a button "add-new-btn px-4 py-2 text-white rounded-lg font-semibold transition-all active:scale-95" (NO bg-* utility class).
- Empty containers: <div class="form-container mb-8 p-6 bg-gray-50 rounded-xl border border-gray-200 hidden"></div>, <div class="data-display space-y-3 w-full overflow-x-auto"></div>, <div class="pagination-controls mt-6 flex justify-center gap-2"></div>.
- <template id="displayTemplate">: ONE row as <div class="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-lg hover:shadow-md transition-shadow"> — fields via {{data.field_id}} in a flex-1 div; relations via {{data.field_id.display_label}}; image → <img src="{{data.f}}" class="h-10 w-10 object-cover rounded">; file → download <a>; then <div class="flex gap-2"> with "edit-btn px-3 py-1 text-blue-600 hover:bg-blue-50 rounded" and "delete-btn px-3 py-1 text-red-600 hover:bg-red-50 rounded", both with data-row-id="{{row_id}}".
- All user-facing text and colors are {{tokens}} with entries in properties AND editableProps (types: text|color|image|number). Append the slot_key entry last ({"key":"slot_key","label":"⚡ Agent Slot Key","type":"text"}, properties "slot_key":"").

## script (receives container, api, schemaId, properties, Mustache — container.querySelector ONLY, arrow functions, no console.log)
1. Top: sync static UI from properties (title text/color, add button text/bg). Get schema via properties.schema_fields.
2. State: currentPage=0, rowsPerPage=20, let currentRows=[], let editingRowId=null.
3. fetchAndRenderRows: first line `if (properties.hideData) return;`. GET /custom-data/rows/${schemaId}?skip=${currentPage*rowsPerPage}&limit=${rowsPerPage} → res.data.rows. Per row: convert booleans to 'true'/'false' strings; for relations set rowData[f.id].display_label from the nested data (first non-object value, or the matching field id); render via Mustache into .data-display; empty → "No items found"; then renderPagination().
4. renderPagination: Previous/Next with "px-3 py-1 border rounded bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed", disabled at bounds, clicks change currentPage and refetch.
5. generateForm(initialData={}): build <form class="grid grid-cols-1 md:grid-cols-2 gap-4"> in .form-container. Labels "block text-sm font-semibold text-gray-700 mb-1"; inputs/selects "w-full p-2 border rounded-lg border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none transition-all"; submit button "md:col-span-2 w-full bg-blue-600 text-white font-bold py-2.5 rounded-lg hover:bg-blue-700 transition-colors mt-2".
   - relation → <select>, options fetched once from /custom-data/rows/${related_schema_id}?limit=1000, option value = row_id, label = first readable value.
   - PARENT dropdowns needing unique values (e.g. Day): use GET /custom-data/rows/${related_schema_id}/distinct/<field> for the option labels — do NOT dedup with Set(). Dependent CHILD dropdowns: cache child rows, on parent change filter by extracted row_id (const rel=c.data.parent; const id=(rel&&typeof rel==='object')?rel.row_id:rel;) and label children with their concatenation (e.g. `${r.data.start_time} - ${r.data.end_time}`).
   - boolean → select true/false. image/file/gallery → file input + hidden input holding the URL (gallery: multiple + JSON array string); onchange uploads via api.post('/uploads/', formData) with button loading state.
6. form.onsubmit: e.preventDefault(); build data from FormData (hidden inputs supply file URLs). editingRowId ? PUT /custom-data/rows/${editingRowId} {data, sitemember_id} : POST /custom-data/rows/${schemaId} {data, sitemember_id}. In catch: alert(err.response?.data?.detail || 'Save failed') — this surfaces server validation (422) and automation blocks like double-bookings (409). PRIVACY: Scenario A (public/booking/"don't show data") → never call fetchAndRenderRows, just alert success + form.reset() + hide form. Scenario B (admin/manage lists) → refresh after submit and call fetchAndRenderRows() at the bottom of the script. Default = B.
7. Edit: on .edit-btn click, loading state, GET ?row_id=, const target = res.data.rows.find(r=>r.row_id===rowId), editingRowId=rowId, generateForm(target.data). Delete: confirm() → loading state → DELETE /custom-data/rows/${rowId}?sitemember_id=${smId} → remove from DOM.
8. sitemember_id: user-scoped prompt → currentUserId from localStorage('siteMemberId:'+(properties.subdomain||'')) with a login guard; otherwise null. NEVER use the zero admin UUID — it is rejected on public sites. When deciding smId for PUT/DELETE: match whoever created the row (user-created → currentUserId; admin/shared → null).

## Minimal shape example (structure only — your script implements the rules above):
{"name":"Booking System","schema":[{"id":"name","label":"Name","type":"text","required":true},{"id":"email","label":"Email","type":"email","required":true},{"id":"time","label":"Time Slot","type":"relation","related_schema_id":"<existing-uuid>"}],"automations":[{"trigger":"on_create","action_type":"mutate_row","config":{"source_field":"time","conditions":{"available":true},"set":{"available":false},"condition_error":"That slot was just taken."}}],"aiTemplate":"<style>...</style><div class=...>...</div><template id=\\"displayTemplate\\">...</template>","properties":{"title":"Book a Slot","addButtonText":"New Booking","titleColor":"#111827","buttonBgColor":"#3b82f6","slot_key":""},"editableProps":[{"key":"title","label":"Title","type":"text"},{"key":"addButtonText","label":"Add Button Text","type":"text"},{"key":"titleColor","label":"Title Color","type":"color"},{"key":"buttonBgColor","label":"Button Color","type":"color"},{"key":"slot_key","label":"⚡ Agent Slot Key","type":"text"}],"script":"..."}
""".strip()