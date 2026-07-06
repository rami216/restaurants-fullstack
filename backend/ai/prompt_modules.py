# backend/ai/prompt_modules.py  — v2 (FULL REPLACEMENT)
# ============================================================
# Modular prompt system, hardened. v2 adds everything the old
# monolith prompt encoded about DISPLAY QUALITY and DEFAULTS:
#   - the three content types (settings tokens vs fetched data
#     vs per-row templates) and how each must be rendered
#   - compact, data-shape-driven layouts (no giant cells, no
#     phantom image space, real tables for text data)
#   - read-only by default; management UI only when asked
#   - a prompt-aware lint that catches these deterministically
# ============================================================
import re
import copy
from typing import Any, Dict, List, Optional

# ------------------------------------------------------------------
# BASE — always included
# ------------------------------------------------------------------
BASE_RULES = """
You are an expert front-end developer. Output ONE valid JSON object with four keys: "aiTemplate", "properties", "editableProps", "script".

## THE THREE CONTENT TYPES (decide this FIRST for every piece of text/data)
1. OWNER SETTINGS — titles, labels, button text, colors, sizes the website owner customizes.
   → {{token}} in aiTemplate + entry in properties + entry in editableProps. These render ONCE.
2. FETCHED DATA — anything loaded from the API at runtime (rows, stats, AI responses).
   → NEVER a {{token}}. Mustache does not loop and does not re-render; a {{name}} token for row data
     prints the literal text "{{name}}" on the page. Fetched data is rendered ONLY inside the script,
     using template literals that read the response (e.g. `${r.data.name ?? ''}`), written into an
     empty container div that exists in aiTemplate (e.g. <div class="list-container"></div>).
3. USER INPUT — form fields. Plain inputs in aiTemplate or built by the script; never tokens.
Violating rule 2 is the #1 failure mode. If a value comes from api.get/api.post, it is type 2.

## OUTPUT
- aiTemplate: a single <div class="UNIQUE_CLASS"> containing a scoped <style> tag and the HTML. Fetched-data areas are EMPTY containers the script fills.
- properties: initial value for EVERY token. Data-connected elements also get "schema_id": "<uuid>".
- editableProps: [{key,label,type}] for EVERY token. Types: text, color, image, number. ALWAYS append {"key":"slot_key","label":"⚡ Agent Slot Key","type":"text"} last, and "slot_key":"" to properties.
- script: raw JS (no <script> tags), arrow functions only, no console.log.

## DESIGN DEFAULTS (compact and professional unless the prompt asks otherwise)
- Match the layout to the DATA SHAPE, not habit:
  * Text-only fields (names, emails, messages, dates, numbers) → a real, COMPACT <table>: border-collapse:collapse; td padding 10px 14px; font-size 14px; line-height 1.5; thead th 12px uppercase letter-spacing .05em color #6b7280 background #f9fafb; row borders 1px solid #f3f4f6; hover row background #f9fafb.
  * Schema/content includes image fields → cards or media rows are appropriate (image height 160-200px, object-fit:cover).
  * NEVER reserve space for images, avatars, icons or thumbnails when there is no image field — no empty squares, no min-height blocks, no aspect-ratio boxes.
- No fixed heights on text content. Long text: max-width:65ch; overflow-wrap:break-word — the CELL stays compact, the text wraps.
- Typography scale: section title 20-24px bold #111827; body 14-15px #374151; secondary/meta 13px #6b7280.
- Buttons compact: padding 6-10px vertical, 12-16px horizontal, font 14px, border-radius 8px.
- Vertical rhythm: 8/12/16/24px spacing steps; lists dense (row gap 0, padding does the work); generous whitespace only for hero/marketing sections.
- Whitespace-heavy card grids ONLY when the prompt says cards/gallery/showcase/portfolio or images exist.

## CSS
- Every rule prefixed with the unique class (.cls button {...}; never bare selectors or :root).
- Outer container: background transparent; width:100%; display:flex; justify-content:center; align-items:center. Design (colors/borders/shadows) goes on INNER elements.
- Collections/card grids: display:grid; grid-template-columns:repeat(auto-fit,minmax(min({{cardMinWidth}},100%),1fr)); gap:{{gap}}; width:100%.
- Card images: width:100%; height:200px; object-fit:cover. Cards: display:flex; flex-direction:column; height:100%; buttons pushed down with margin-top:auto.
- Inputs/buttons in cards: width:100%; box-sizing:border-box. Disabled: .cls button:disabled{opacity:.5;cursor:not-allowed}.
- No fixed pixel widths on containers (max-width + width:100%). Flex rows get flex-wrap:wrap. Tables wrapped in <div style="overflow-x:auto;width:100%">.
- Always include, scoped: @media (max-width:768px){ .cls{padding:12px!important;overflow-x:hidden!important} .cls .grid-container{grid-template-columns:1fr!important} .cls .flex-container{flex-direction:column!important} .cls .card{width:100%!important;min-width:unset!important} }

## JAVASCRIPT
- `container` is INJECTED — never declare it. Only container.querySelector, never document.querySelector. Give elements descriptive classes and select by class (never :nth-child or bare tag selectors when ambiguous).
- Never assign container.innerHTML — always write into a child element (.list-container, .content, etc). Never use inline onclick="" attributes in HTML; attach all handlers in the script.
- Action buttons use btn.onclick — NEVER form.onsubmit — unless it is a classic contact form (<form onsubmit="return false;"> + e.preventDefault() first line).
- Every async op: disable button + loading text → try/catch → restore in finally. Errors: alert(err.response?.data?.detail || 'Something went wrong.') — the server returns readable 409/422 messages.
- Deletes: if (!confirm('Are you sure you want to delete this item?')) return;
- Empty lists render "No items found". Loading state ("Loading...") in the target container while fetching.

## MUSTACHE (STRICT)
- Only {{var}} and {{{html}}} exist. NO {{#if}}, {{#eq}}, {{#unless}}, no helpers, no loops.
- Conditional classes/content: compute in JS before use and inject via template literals or classList.
- Every token added to aiTemplate MUST exist in properties AND editableProps — and per the content-type rules, tokens are for OWNER SETTINGS ONLY.

## DATA SAFETY
- Row id is row.row_id (never row.id). schemaId is injected — never declare or hardcode it. Lists come back as res.data.rows.
- Every field read gets a fallback: (r.data.field ?? ''). Booleans arrive as 'true'/'false' strings: check (v===true||v==='true'). Numbers: Number(x).toFixed(2). Galleries: typeof g==='string'?JSON.parse(g):(g||[]). Relations: r.data.item?.data?.item_name with optional chaining.
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

## READ-ONLY IS THE DEFAULT
"show / display / list / get data from X" = READ-ONLY: no edit buttons, no delete buttons, no add form, no Actions column.
Include management UI ONLY when the prompt asks to manage/edit/delete/add/CRUD/admin the data, or clearly implies users maintain their own entries. When in doubt: read-only. The owner can ask for buttons later.

## RENDERING FETCHED ROWS (CRITICAL — content type 2)
Never put row fields as static {{tokens}} — they would render as literal "{{name}}" text. Build row HTML in the script:
let rows = []; let currentPage = 0; const rowsPerPage = 20; // top-level
const fetchAndRenderRows = async () => {
  const list = container.querySelector('.list-container');
  list.innerHTML = '<p>Loading...</p>';
  try {
    const res = await api.get(`/custom-data/rows/${schemaId}?skip=${currentPage*rowsPerPage}&limit=${rowsPerPage}`);
    rows = res.data.rows;
    if (!rows.length) { list.innerHTML = '<p>No items found</p>'; return; }
    list.innerHTML = `
      <div style="overflow-x:auto;width:100%"><table>
        <thead><tr><th>Name</th><th>Email</th><th>Inquiry</th></tr></thead>
        <tbody>${rows.map(r => `
          <tr>
            <td>${r.data.name ?? ''}</td>
            <td>${r.data.email ?? ''}</td>
            <td class="wrap">${r.data.inquiry ?? ''}</td>
          </tr>`).join('')}
        </tbody></table></div>`;
    attachEventListeners();
    renderPagination();
  } catch (e) { list.innerHTML = '<p>Could not load data.</p>'; }
};
Adapt columns/markup to the actual schema fields and the compact-table design defaults. If (and only if) management was requested, add an Actions column with buttons carrying data-id="${r.row_id}" (class "edit"/"delete"), then in attachEventListeners loop container.querySelectorAll('.edit'/'.delete'), read btn.getAttribute('data-id'), apply loading/confirm rules, and refresh via fetchAndRenderRows(). Listeners are attached once per render pass — never nested inside another render loop.

## PAGINATION
Only when the data can plausibly exceed one page (lists of user submissions, products, bookings): Previous/Next buttons in a .pagination container, disabled at bounds (page 0 / rows.length < rowsPerPage), clicking changes currentPage and refetches. Skip pagination for small fixed datasets (a menu of 8 items, a team of 5).

## OWNERSHIP (sitemember_id)
- Not user-scoped → null everywhere.
- PUT/DELETE on a row the USER created → currentUserId (null gives 403). On a SHARED/admin-created row (booking a slot) → null (currentUserId gives 403). Rule: match whoever created the row.
- NEVER use the zero UUID "00000000-..." — it is rejected on public sites.
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
Likes: increments:{likes:1}. Spend credits: increments:{credits:-1} with a conditions guard if needed. No manual availability checks anywhere.
""".strip()

MODULE_STATS = """
## STATS & CHART DATA (never aggregate client-side, never fetch-all-to-sum)
- One number: api.post(`/custom-data/rows/${schemaId}/stats`, {field:"amount", operation:"sum", filters:{}}) → res.data.result
- Grouped (charts/leaderboards): api.post(`/custom-data/rows/${schemaId}/stats/grouped`, {group_by:"category", field:"amount", operation:"sum", filters:{}}) → res.data.results = [{group, value}] sorted desc. operation:"count" needs no field.
- Unique values (dropdown options): api.get(`/custom-data/rows/${schemaId}/distinct/day`) → res.data.values
- User-scoped: append ?sitemember_id=${currentUserId}.
- Display: assign directly (el.textContent = res.data.result) — never +=, never fetch stats inside a render loop; fetch once, after any bulk save completes. Stats are FETCHED DATA (content type 2): rendered by the script, never {{tokens}}.
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
if (!currentUserId) { container.querySelector('.content').innerHTML = '<p>Please log in to view your data</p>'; return; }
Reads: append ?sitemember_id=${currentUserId}. Writes: sitemember_id: currentUserId (including every bulk operation). Deletes: ?sitemember_id=${currentUserId}.
User-scoped elements ARE management elements by nature: users maintain their own entries, so edit/delete on their own rows is appropriate here even without explicit "edit/delete" words in the prompt.
Do NOT filter relational/reference dropdown data by user — only the main list.
""".strip()

MODULE_AI_GEN = """
## AI GENERATION (via api.post('/builder/openai', {website_id: properties.website_id, member_id, prompt, system_prompt}))
Pick the mode by destination BEFORE coding: saving rows → FLAT ARRAY; short text display → TEXT; complex UI (scores/panels/dashboards) → STRUCTURED UI.
AI responses are FETCHED DATA (content type 2): rendered by the script, never {{tokens}}.

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

Chat messages are FETCHED DATA: render bubbles in the script (user right/primary color, assistant left/gray), auto-scroll the messages div to bottom after each append.

ACTION-BASED BOT adds to buildSystemPrompt: mission (collect email ONCE, confirm ONCE, execute immediately on any positive confirmation, never re-ask known info) and the EXECUTION PROTOCOL — on confirmation reply ONLY raw JSON:
{"action":"execute_workflow","email":"...","steps":[{"db_action":"create|update|delete","db_target":"schema_id for create / row_id for update+delete","db_payload":{...},"owned":true|false}],"summary":"plain text"}
Executor: create → api.post(`/custom-data/rows/${step.db_target}`,{data:step.db_payload,sitemember_id:step.owned?currentUserId:null});
update → PREFER api.post(`/custom-data/rows/${step.db_target}/atomic`,{conditions:step.db_conditions||{},set_values:step.db_payload,sitemember_id:step.owned?currentUserId:null}) for slot/stock changes (409 = taken); otherwise fetch-merge-PUT.
delete → api.delete(`/custom-data/rows/${step.db_target}?sitemember_id=${step.owned?currentUserId:null}`).
After all steps: optional email via api.post('/builder/send-email',{website_id:properties.website_id,to_email:cmd.email,subject:properties.emailSubject||'Confirmation',content:(properties.emailBody||'')+(cmd.summary||'')}); then push history, render "✅ "+cmd.summary. Non-JSON replies render as normal chat. emailSubject/emailBody in properties+editableProps.
""".strip()

MODULE_CHARTS = """
## DASHBOARD / CHARTS
- Load Chart.js dynamically; ALL chart code inside script.onload. Wrap each <canvas> in <div style="position:relative;width:100%;max-width:100%;height:300px">. Container: width:100%;max-width:100%;overflow-x:hidden.
- Data comes from /stats and /stats/grouped (see STATS module) — never fetch all rows to compute totals. Grouped results map directly: labels = results.map(r=>r.group), data = results.map(r=>r.value).
- KPI number cards: compact (padding 16-20px), big number (28-32px bold), small gray label (13px) — no images, no icons unless asked.
- Sanitize fallbacks: parseFloat(String(v).replace(/[^0-9.,-]/g,'').replace(',','.'))||0.
""".strip()

MODULE_ECOMMERCE = """
## E-COMMERCE / CART / CHECKOUT
- Never inline onclick="addToCart(...)". Use data-index + listeners attached in JS. Read qty/selects/addon checkboxes from btn.closest('.card') before calling addToCart({cartItemId:`${row.row_id}-${Date.now()}`, itemId:row.row_id, name:row.data.name, imageUrl:row.data.image||'', quantity, unitPrice, selectedExtras:[], selectedOptions}).
- Stock decrement on purchase → ATOMIC endpoint (increments:{stock:-1}, conditions e.g. {in_stock:true}).
- Checkout CTA gets class "checkout-btn"; no custom Stripe calls. Click isolation:
container.addEventListener('click',(e)=>{ if(!e.target.closest('.checkout-btn')){ e.stopImmediatePropagation(); e.preventDefault(); } }, true);
- Product grids MAY be visual (cards with images) — products are the image-field case of the design defaults.
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
External API responses are FETCHED DATA: rendered by the script, never {{tokens}}.
""".strip()

MODULE_DYNAMIC_PAGES = """
## MASTER → DETAIL PAGES
Master link: const isMainHost = window.location.hostname.includes('zygoflow.com'); const basePath = isMainHost && properties.subdomain ? `/${properties.subdomain}` : ''; window.location.href = `${basePath}/detail-page?id=${rowId}`;
Detail: const rowId = new URLSearchParams(window.location.search).get('id'); guard missing id/row with a friendly message; fetch ?row_id= then res.data.rows.find(r=>r.row_id===rowId); map fields to DOM manually (fetched data — script-rendered, no tokens).
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
    (["form", "submit", "save", "table", "list", "track", "manage", "database", "store", "entries", "records", "crud", "sum", "total", "count", "show", "display", "get data", "view"], [MODULE_CRUD, MODULE_STATS]),
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
        chosen = [MODULE_CRUD]  # safe default (harmless for pure-visual elements)
    return base + "\n\n" + "\n\n".join(chosen)


# ------------------------------------------------------------------
# LINT + REPAIR (prompt-aware in v2)
# ------------------------------------------------------------------
_MUSTACHE_COND = re.compile(r"\{\{[#/^]\s*(if|unless|eq|each)\b")
_TOKEN_RE = re.compile(r"\{\{\{?\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}?\}\}")

# words that legitimately imply management UI (edit/delete/add)
_MANAGEMENT_WORDS = [
    "edit", "delete", "remove", "manage", "update", "crud", "admin",
    "add", "create", "submit", "form", "book", "reserv", "upload",
    "their own", "own data", "own entries", "track", "save", "todo",
    "cancel", "sign up", "register", "apply", "order",
]

REPAIR_PROMPT = """
You are fixing a generated component. You will receive ERRORS TO FIX and the COMPONENT JSON.
Fix ONLY the listed errors. Change nothing else. Return the complete corrected JSON object (same four keys), no markdown, no explanation.
Key rules while fixing:
- {{tokens}} are ONLY for owner settings (title, colors, labels). Fetched row data is rendered inside the script with template literals (r.data.field ?? '') into an empty container div — remove row-data tokens from aiTemplate rather than adding them to properties.
- Text-only data renders as a compact table (small padding, 14px font, no image placeholders); do not reserve space for images that don't exist.
- Mustache supports only {{var}} and {{{html}}} — compute conditional classes in the script.
- `container` is injected, never declared; container.querySelector only; write into child elements, never container.innerHTML.
""".strip()


def lint_component(payload: Dict[str, Any], user_prompt: str = "") -> List[str]:
    errors: List[str] = []
    tmpl = payload.get("aiTemplate", "") or ""
    script = payload.get("script", "") or ""
    props = payload.get("properties", {}) or {}
    eprops = payload.get("editableProps", []) or []
    p = (user_prompt or "").lower()
    fetches_rows = "custom-data/rows" in script

    # --- hard JS rules ---
    if "document.querySelector" in script:
        errors.append("Replace every document.querySelector with container.querySelector.")
    if re.search(r"\b(const|let|var)\s+container\b", script):
        errors.append("Do not redeclare `container` — it is injected by the runtime.")
    if re.search(r"container\.innerHTML\s*=", script):
        errors.append("Never assign container.innerHTML — write into a child element (e.g. container.querySelector('.list-container').innerHTML = ...). Add the child div to aiTemplate if missing.")
    if "console.log" in script:
        errors.append("Remove all console.log calls.")
    if re.search(r"onclick\s*=\s*[\"']", tmpl):
        errors.append("Remove inline onclick=\"\" attributes from aiTemplate — attach all handlers in the script via querySelector + .onclick.")

    # --- Mustache rules ---
    if _MUSTACHE_COND.search(tmpl):
        errors.append("Remove Mustache conditionals ({{#if}}/{{#eq}}/{{#each}}...) — compute conditional classes/content in the script and expose only plain owner-setting {{tokens}}.")

    # --- token/content-type discipline ---
    tokens = set(_TOKEN_RE.findall(tmpl)) - {"data", "row_id"}
    missing_props = tokens - set(props.keys())
    if missing_props:
        if fetches_rows:
            errors.append(
                f"Tokens {sorted(missing_props)} are in aiTemplate but not in properties. "
                "If they are ROW DATA fields: REMOVE them from aiTemplate and render the rows inside "
                "the script with template literals (r.data.<field> ?? '') into an empty container — "
                "static Mustache tokens cannot display fetched data. If they are owner-editable "
                "settings, add them to properties AND editableProps instead."
            )
        else:
            errors.append(f"Add these template tokens to properties (with sensible initial values): {sorted(missing_props)}")
    eprop_keys = {e.get("key") for e in eprops if isinstance(e, dict)}
    missing_eprops = tokens - eprop_keys - {"website_id", "schema_id", "all_schemas", "schema_fields", "subdomain"}
    if missing_eprops and not (fetches_rows and missing_props):
        errors.append(f"Add editableProps entries for: {sorted(missing_eprops)}")
    if "slot_key" not in eprop_keys:
        errors.append('Append {"key":"slot_key","label":"⚡ Agent Slot Key","type":"text"} as the last editableProps entry and "slot_key":"" to properties.')

    # --- data hygiene ---
    if "api.delete(" in script and "confirm(" not in script:
        errors.append("Every delete must be guarded: if (!confirm('Are you sure you want to delete this item?')) return;")
    if fetches_rows and re.search(r"\.data\.rows\b", script) is None and "res.data.rows" not in script:
        errors.append("Row lists come back as res.data.rows — read that property, not res.data directly.")

    # --- prompt-aware: read-only default ---
    if user_prompt:
        wants_management = any(w in p for w in _MANAGEMENT_WORDS)
        does_mutation = ("api.delete(`/custom-data" in script or "api.delete('/custom-data" in script
                         or "api.put(`/custom-data" in script or "api.put('/custom-data" in script)
        if fetches_rows and does_mutation and not wants_management:
            errors.append(
                "The request only asked to DISPLAY data. Remove all edit/delete buttons, forms, and "
                "api.put/api.delete calls — render a read-only list/table only."
            )

    return errors


# ------------------------------------------------------------------
# DIFF-BASED REFINEMENT
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
- Every NEW {{token}} you introduce in aiTemplate needs: a set op for properties.<token>, and a set op replacing the whole "editableProps" array with the appended entry. Tokens are for OWNER SETTINGS only — fetched data is rendered inside the script, never as tokens.
- Mustache has NO conditionals — conditional classes/content are computed in the script and exposed as plain tokens or injected via template literals.
- Follow the compact design defaults: text-only data = dense table, no phantom image space, management buttons only where the user wants them.
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
# DATA APP GENERATOR v3.1
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
- Empty containers: <div class="form-container mb-8 p-6 bg-gray-50 rounded-xl border border-gray-200 hidden"></div>, <div class="data-display w-full overflow-x-auto"></div>, <div class="pagination-controls mt-6 flex justify-center gap-2"></div>.
- <template id="displayTemplate">: ONE row, matching the data shape:
  * Text-only schemas → a compact table row: <tr class="border-b border-gray-100 hover:bg-gray-50"> with <td class="px-4 py-2.5 text-sm text-gray-700"> per field ({{data.field_id}}); long-text fields get class "max-w-md break-words". The script wraps rendered rows in <table class="min-w-full"><thead>...</thead><tbody>...</tbody></table>.
  * Schemas WITH image fields → a media row/card: flex items-center gap-4 p-4 bg-white border border-gray-100 rounded-lg hover:shadow-md; image → <img src="{{data.f}}" class="h-12 w-12 object-cover rounded">.
  Relations render via {{data.field_id.display_label}}; file → download <a>. Never reserve image space for schemas without image fields.
  Edit/delete buttons ("edit-btn"/"delete-btn" with data-row-id="{{row_id}}", px-3 py-1 text/hover styles) appear ONLY when the prompt implies management (manage/edit/delete/admin/own entries); pure display/booking-form prompts get no action buttons.
- All user-facing text and colors are {{tokens}} with entries in properties AND editableProps (types: text|color|image|number). Append the slot_key entry last ({"key":"slot_key","label":"⚡ Agent Slot Key","type":"text"}, properties "slot_key":""). Row data is ONLY ever {{data.*}} inside displayTemplate — never plain top-level tokens.

## script (receives container, api, schemaId, properties, Mustache — container.querySelector ONLY, arrow functions, no console.log)
1. Top: sync static UI from properties (title text/color, add button text/bg). Get schema via properties.schema_fields.
2. State: currentPage=0, rowsPerPage=20, let currentRows=[], let editingRowId=null.
3. fetchAndRenderRows: first line `if (properties.hideData) return;`. GET /custom-data/rows/${schemaId}?skip=${currentPage*rowsPerPage}&limit=${rowsPerPage} → res.data.rows. Per row: convert booleans to 'true'/'false' strings; for relations set rowData[f.id].display_label from the nested data (first non-object value, or the matching field id); render each row via Mustache from displayTemplate; text-only schemas: assemble the rows inside a <table> with a <thead> built from schema labels; empty → "No items found"; then renderPagination().
4. renderPagination: Previous/Next with "px-3 py-1 border rounded bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed", disabled at bounds, clicks change currentPage and refetch.
5. generateForm(initialData={}): build <form class="grid grid-cols-1 md:grid-cols-2 gap-4"> in .form-container. Labels "block text-sm font-semibold text-gray-700 mb-1"; inputs/selects "w-full p-2 border rounded-lg border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none transition-all"; submit button "md:col-span-2 w-full bg-blue-600 text-white font-bold py-2.5 rounded-lg hover:bg-blue-700 transition-colors mt-2".
   - relation → <select>, options fetched once from /custom-data/rows/${related_schema_id}?limit=1000, option value = row_id, label = first readable value.
   - PARENT dropdowns needing unique values (e.g. Day): use GET /custom-data/rows/${related_schema_id}/distinct/<field> for the option labels — do NOT dedup with Set(). Dependent CHILD dropdowns: cache child rows, on parent change filter by extracted row_id (const rel=c.data.parent; const id=(rel&&typeof rel==='object')?rel.row_id:rel;) and label children with their concatenation (e.g. `${r.data.start_time} - ${r.data.end_time}`).
   - boolean → select true/false. image/file/gallery → file input + hidden input holding the URL (gallery: multiple + JSON array string); onchange uploads via api.post('/uploads/', formData) with button loading state.
6. form.onsubmit: e.preventDefault(); build data from FormData (hidden inputs supply file URLs). editingRowId ? PUT /custom-data/rows/${editingRowId} {data, sitemember_id} : POST /custom-data/rows/${schemaId} {data, sitemember_id}. In catch: alert(err.response?.data?.detail || 'Save failed') — this surfaces server validation (422) and automation blocks like double-bookings (409). PRIVACY: Scenario A (public/booking/"don't show data") → never call fetchAndRenderRows, just alert success + form.reset() + hide form. Scenario B (admin/manage lists) → refresh after submit and call fetchAndRenderRows() at the bottom of the script. Default = B.
7. Edit: on .edit-btn click, loading state, GET ?row_id=, const target = res.data.rows.find(r=>r.row_id===rowId), editingRowId=rowId, generateForm(target.data). Delete: confirm() → loading state → DELETE /custom-data/rows/${rowId}?sitemember_id=${smId} → remove from DOM. (Skip this step entirely when no management buttons were generated.)
8. sitemember_id: user-scoped prompt → currentUserId from localStorage('siteMemberId:'+(properties.subdomain||'')) with a login guard; otherwise null. NEVER use the zero admin UUID — it is rejected on public sites. When deciding smId for PUT/DELETE: match whoever created the row (user-created → currentUserId; admin/shared → null).

## Minimal shape example (structure only — your script implements the rules above):
{"name":"Booking System","schema":[{"id":"name","label":"Name","type":"text","required":true},{"id":"email","label":"Email","type":"email","required":true},{"id":"time","label":"Time Slot","type":"relation","related_schema_id":"<existing-uuid>"}],"automations":[{"trigger":"on_create","action_type":"mutate_row","config":{"source_field":"time","conditions":{"available":true},"set":{"available":false},"condition_error":"That slot was just taken."}}],"aiTemplate":"<style>...</style><div class=...>...</div><template id=\\"displayTemplate\\">...</template>","properties":{"title":"Book a Slot","addButtonText":"New Booking","titleColor":"#111827","buttonBgColor":"#3b82f6","slot_key":""},"editableProps":[{"key":"title","label":"Title","type":"text"},{"key":"addButtonText","label":"Add Button Text","type":"text"},{"key":"titleColor","label":"Title Color","type":"color"},{"key":"buttonBgColor","label":"Button Color","type":"color"},{"key":"slot_key","label":"⚡ Agent Slot Key","type":"text"}],"script":"..."}
""".strip()