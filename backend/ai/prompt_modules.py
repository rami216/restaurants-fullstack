# backend/ai/prompt_modules.py  — v3 (FULL REPLACEMENT)
# ============================================================
# v3 design principle: MODULES CARRY COMPLETE CODE PATTERNS,
# not descriptions. Models imitate concrete code far more
# reliably than they follow prose rules — this is what the
# original monolith prompt got right and v2 lost.
#
# Every data script is REQUIRED to start with universal helper
# functions (displayValue / extractRowId / firstValue) that make
# the [object Object] class of bug structurally impossible, and
# the form/relation/cascading machinery is spelled out in full.
#
# Exported names are identical to v1/v2 — no router changes:
#   BASE_RULES, MODULE_*, build_system_prompt, lint_component,
#   REPAIR_PROMPT, REFINE_OPS_BASE, apply_ops, PAGE_PLAN_PROMPT,
#   DATA_APP_PROMPT_V3
# ============================================================
import re
import copy
from typing import Any, Dict, List

# ------------------------------------------------------------------
# SHARED CODE BLOCK — injected wherever data is touched.
# Defined once here so CRUD / FORMS / DATA_APP all quote the
# exact same helpers (models copy them verbatim).
# ------------------------------------------------------------------
_HELPERS_JS = """
## PROVIDED RUNTIME LIBRARY (pre-injected by the platform — call these, NEVER redefine them)
extractRowId(v)            → row_id string from a value that may be a resolved relation object
displayValue(v, sep=' - ') → human-readable text for ANY value (relations, booleans, null) — use for every displayed field
firstValue(v)              → best single label (name columns, image URLs)
esc(s)                     → HTML-escape; wrap EVERY interpolated value: ${esc(displayValue(x))}
rowData(row)               → row.data whether given a row or already-data; ALWAYS use for edit prefill: openForm(rowData(target))
relLabelField(f) / relDisplay(f, v) → relation labeling (matches the relation field to the related schema's field); use relDisplay for relation TABLE CELLS and DROPDOWN labels
populateRelationSelects(form, initial={}) → fills every select[name][data-relation="<related_schema_id>"] (value=row_id, label=relDisplay) and preselects extractRowId(initial[name]) — call after inserting a form containing relation selects
wireUploads(form)          → wires input[data-upload="<field_id>"] to /uploads/ and writes URLs into the sibling hidden input[name="<field_id>"]
These exist at runtime even though you don't see their code. Redefining ANY of these names is a hard error — the platform deletes your definition, so code written against a simplified version will misbehave. Do not re-implement them; just call them.
""".strip()

RUNTIME_LIB_JS = r"""/*__ZY_RUNTIME_LIB__*/
const extractRowId = (v) => (v && typeof v === 'object') ? (v.row_id || '') : (v ?? '');
const displayValue = (v, sep = ' - ') => {
  if (v === true || v === 'true') return 'Yes';
  if (v === false || v === 'false') return 'No';
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'object') {
    const src = v.data || v;
    const vals = Object.values(src).filter(x => (typeof x === 'string' || typeof x === 'number') && String(x).length < 80);
    return vals.length ? vals.map(String).join(sep) : (v.row_id || '');
  }
  return String(v);
};
const firstValue = (v) => {
  if (v && typeof v === 'object' && v.data) {
    const vals = Object.values(v.data).filter(x => typeof x === 'string' || typeof x === 'number');
    return vals.length ? String(vals[0]) : (v.row_id || '');
  }
  return displayValue(v);
};
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const rowData = (row) => (row && row.data) ? row.data : (row || {});
const relLabelField = (f) => {
  const schemas = (typeof properties !== 'undefined' && properties.all_schemas) || [];
  const rel = schemas.find(s => String(s.schema_id) === String(f && f.related_schema_id));
  const m = rel && (rel.fields || []).find(rf => rf.id === (f && f.id) || String(rf.label || '').toLowerCase() === String((f && f.label) || '').toLowerCase());
  return m ? m.id : null;
};
const relDisplay = (f, v) => {
  const lf = relLabelField(f);
  return (lf && v && typeof v === 'object' && v.data) ? displayValue(v.data[lf]) : displayValue(v);
};
const populateRelationSelects = async (form, initial = {}) => {
  for (const sel of form.querySelectorAll('select[data-relation]')) {
    const name = sel.getAttribute('name');
    const f = ((typeof properties !== 'undefined' && properties.schema_fields) || []).find(x => x.id === name) || { id: name };
    try {
      const res = await api.get(`/custom-data/rows/${sel.getAttribute('data-relation')}?limit=1000`);
      sel.innerHTML = '<option value="">Select...</option>' +
        res.data.rows.map(r => `<option value="${r.row_id}">${esc(relDisplay(f, r))}</option>`).join('');
      const initId = extractRowId(initial[name]);
      if (initId) sel.value = initId;
    } catch (e) { sel.innerHTML = '<option value="">Failed to load</option>'; }
  }
};
const wireUploads = (form) => {
  form.querySelectorAll('input[data-upload]').forEach(fi => fi.onchange = async () => {
    if (!fi.files.length) return;
    const hidden = form.querySelector(`input[name="${fi.getAttribute('data-upload')}"]`);
    fi.disabled = true;
    try {
      if (fi.multiple) {
        const urls = [];
        for (const file of fi.files) { const fd = new FormData(); fd.append('file', file); const up = await api.post('/uploads/', fd); urls.push(up.data ? up.data.url : up.url); }
        if (hidden) hidden.value = JSON.stringify(urls);
      } else {
        const fd = new FormData(); fd.append('file', fi.files[0]);
        const up = await api.post('/uploads/', fd);
        if (hidden) hidden.value = up.data ? up.data.url : up.url;
      }
    } catch (e) { alert('Upload failed.'); }
    finally { fi.disabled = false; }
  });
};
"""
_LIB_NAMES = ("extractRowId", "displayValue", "firstValue", "esc", "rowData",
              "relLabelField", "relDisplay", "populateRelationSelects", "wireUploads")

_LIB_REDEF_RE = re.compile(
    r"(?:const|let|var)\s+(?:%s)\s*=|(?:async\s+)?function\s+(?:%s)\s*\(" % (
        "|".join(_LIB_NAMES), "|".join(_LIB_NAMES))
)

def _statement_end(src: str, i: int) -> int:
    """Scan forward from i to the end of the JS statement starting there."""
    depth = 0
    in_str = None
    seen_brace = False
    n = len(src)
    while i < n:
        c = src[i]
        if in_str:
            if c == "\\":
                i += 2
                continue
            if c == in_str:
                in_str = None
        elif c in "\"'`":
            in_str = c
        elif c in "({[":
            depth += 1
            if c == "{":
                seen_brace = True
        elif c in ")}]":
            depth -= 1
            if depth <= 0 and c == "}" and seen_brace:
                j = i + 1
                while j < n and src[j] in " \t":
                    j += 1
                return (j + 1) if (j < n and src[j] == ";") else (i + 1)
        elif depth == 0 and c == ";":
            return i + 1
        elif depth == 0 and c == "\n" and not seen_brace:
            return i + 1
        i += 1
    return n

def strip_lib_redefinitions(script: str) -> str:
    """Delete model redefinitions of runtime-library functions so the injected
    canonical versions are the ones that actually run (degenerate shadows like
    `const displayValue = v => v ?? ''` were breaking relation display)."""
    if not script or _RUNTIME_MARKER in script:
        return script
    while True:
        m = _LIB_REDEF_RE.search(script)
        if not m:
            return script
        script = script[:m.start()] + script[_statement_end(script, m.end()):]
        
_RUNTIME_MARKER = "/*__ZY_RUNTIME_LIB__*/"

def inject_runtime_lib(script: str) -> str:
    """Prepend the canonical library and wrap the model's script in an async IIFE.
    Idempotent (marker check). Model redefinitions merely shadow — never crash."""
    if not script or _RUNTIME_MARKER in script:
        return script
    return (
        RUNTIME_LIB_JS
        + "\n;(async () => {\n" + script + "\n})().catch((err) => {\n"
        + "  try { const d = container.querySelector('.list-container') || container.querySelector('.data-display') || container.firstElementChild; "
        + "if (d) d.innerHTML = '<p style=\"color:#b91c1c;font-size:14px\">Something went wrong in this element.</p>'; } catch (_) {}\n"
        + "});"
    )

# ------------------------------------------------------------------
# BASE — always included
# ------------------------------------------------------------------
BASE_RULES = """
You are an expert front-end developer. Output ONE valid JSON object with four keys: "aiTemplate", "properties", "editableProps", "script".

## THE THREE CONTENT TYPES (decide this FIRST for every piece of text/data)
1. OWNER SETTINGS — titles, labels, button text, colors the website owner customizes.
   → {{token}} in aiTemplate + entry in properties + entry in editableProps. These render ONCE.
2. FETCHED DATA — anything loaded from the API at runtime (rows, stats, AI responses, chat messages).
   → NEVER a {{token}}. Mustache does not loop and does not re-render; a {{name}} token for row data
     prints the literal text "{{name}}" on the page. Fetched data is rendered ONLY inside the script,
     via template literals, into an EMPTY container div that exists in aiTemplate
     (e.g. <div class="list-container"></div>).
3. USER INPUT — form fields. Plain inputs in aiTemplate or built by the script; never tokens.
If a value comes from api.get/api.post, it is type 2. This is the #1 rule.

## OUTPUT
- aiTemplate: a single <div class="UNIQUE_CLASS"> containing a scoped <style> tag and the HTML. Fetched-data areas are EMPTY containers the script fills.
- properties: initial value for EVERY token. Data-connected elements also get "schema_id": "<uuid>".
- editableProps: [{key,label,type}] for EVERY token. Types: text, color, image, number. ALWAYS append {"key":"slot_key","label":"⚡ Agent Slot Key","type":"text"} last, and "slot_key":"" to properties.
- script: raw JS (no <script> tags), arrow functions only, no console.log.
- Implement the COMPLETE, robust version of every behavior: handle relation objects, booleans, empty values, loading, and errors in EVERY read and write. Never ship the minimal happy-path version.

## DESIGN DEFAULTS (compact and professional unless the prompt asks otherwise)
- Match the layout to the DATA SHAPE:
  * Text-only fields (names, emails, messages, dates, numbers) → a real, COMPACT <table>: border-collapse:collapse; td padding 10px 14px; font-size 14px; line-height 1.5; thead th 12px uppercase letter-spacing .05em color #6b7280 background #f9fafb; row borders 1px solid #f3f4f6; hover row background #f9fafb.
  * Content includes image fields → cards or media rows (image height 160-200px, object-fit:cover).
  * NEVER reserve space for images/avatars/icons when there is no image field — no empty squares, no min-height blocks.
- No fixed heights on text. Long text: max-width:65ch; overflow-wrap:break-word — the cell stays compact, the text wraps.
- Typography: section title 20-24px bold #111827; body 14-15px #374151; secondary 13px #6b7280. Buttons compact: 6-10px vertical / 12-16px horizontal padding, 14px font, radius 8px.
- Dense lists by default; whitespace-heavy card grids ONLY for cards/gallery/showcase prompts or image content.

## CSS
- Every rule prefixed with the unique class (.cls button {...}; never bare selectors or :root).
- Outer container: background transparent; width:100%; display:flex; justify-content:center; align-items:center. Design (colors/borders/shadows) goes on INNER elements.
- Collections/card grids: display:grid; grid-template-columns:repeat(auto-fit,minmax(min({{cardMinWidth}},100%),1fr)); gap:{{gap}}; width:100%.
- Card images: width:100%; height:200px; object-fit:cover. Cards: display:flex; flex-direction:column; height:100%; buttons pushed down with margin-top:auto.
- Inputs/buttons in cards: width:100%; box-sizing:border-box. Disabled: .cls button:disabled{opacity:.5;cursor:not-allowed}.
- No fixed pixel widths on containers (max-width + width:100%). Flex rows get flex-wrap:wrap. Tables wrapped in <div style="overflow-x:auto;width:100%">.
- Always include, scoped: @media (max-width:768px){ .cls{padding:12px!important;overflow-x:hidden!important} .cls .grid-container{grid-template-columns:1fr!important} .cls .flex-container{flex-direction:column!important} .cls .card{width:100%!important;min-width:unset!important} }

## JAVASCRIPT
- `container` is INJECTED — never declare it. Only container.querySelector, never document.querySelector. Select by descriptive class names.
- Never assign container.innerHTML — write into a child element. Never use inline onclick="" in HTML; attach handlers in the script.
- Action buttons use btn.onclick — NEVER form.onsubmit — unless it is a real <form> flow (then <form onsubmit="return false;"> + e.preventDefault() first line).
- Every async op: disable button + loading text → try/catch → restore in finally. Errors: alert(err.response?.data?.detail || 'Something went wrong.') — the server returns readable 409/422 messages.
- Deletes: if (!confirm('Are you sure you want to delete this item?')) return;
- Empty lists render "No items found". Show "Loading..." in the target container while fetching.

## MUSTACHE (STRICT)
- Only {{var}} and {{{html}}} exist. NO {{#if}}, {{#eq}}, {{#unless}}, no helpers, no loops.
- Conditional classes/content: compute in JS and inject via template literals or classList.
- Every token in aiTemplate MUST exist in properties AND editableProps — and tokens are OWNER SETTINGS ONLY.

## DATA SAFETY
- Row id is row.row_id (never row.id). schemaId is injected — never declare or hardcode it. Lists come back as res.data.rows; total in res.data.total.
- Galleries: typeof g==='string'?JSON.parse(g):(g||[]). Numbers for money: Number(x).toFixed(2).
- Booleans arrive as true/'true'/false/'false' — always compare (v===true||v==='true').
""".strip()

# ------------------------------------------------------------------
# RUNTIME BINDING — always included, before all other modules
# ------------------------------------------------------------------
MODULE_BINDING = """
## RUNTIME BINDING (READ FIRST — violating either rule makes NOTHING run)
The script executes as the BODY of: new Function('container','api','schemaId','properties','Mustache','addToCart')(...)
RULE 1 — THE SCRIPT IS A FUNCTION BODY, NOT A FUNCTION. NEVER wrap the code in (container, api, ...) => { ... } or function(...) { ... } — a wrapper is defined but never invoked, so zero lines execute (empty display, dead buttons). Write top-level statements directly and END the script by calling your entry point, e.g. fetchAndRenderRows();
RULE 2 — NEVER REDECLARE THE INJECTED NAMES.
→ container, api, schemaId, properties, Mustache, addToCart are ALREADY-DEFINED function parameters.
NEVER write `const schemaId = ...`, `let api = ...`, or any const/let/var declaration of these six names — a single redeclaration throws "Identifier 'schemaId' has already been declared" and NOTHING runs (empty display, dead buttons).
Need the id? Just use `schemaId` directly — it already equals properties.schema_id.

## CONNECTING TO EXISTING TABLES (elements here do NOT create tables — they bind to existing ones)
You are given EXISTING_SCHEMAS_ON_WEBSITE: [{name, schema_id, fields:[{id,label,type,related_schema_id?}]}].
1. Pick the schema whose name/fields best match the request ("load data from Inquiries" → the schema named "Inquiries").
2. Set properties.schema_id to that schema's schema_id string. The runtime injects it as `schemaId`.
3. Use that schema's EXACT field ids in every r.data.<id> read and every form input name — never invent field names; if the schema has "inquiry", the column is r.data.inquiry, not r.data.message.
4. SECONDARY tables (multi-table elements): a differently-named const with the literal uuid from the list is allowed: const bookingsSchemaId = '3f2a-...'; api.get(`/custom-data/rows/${bookingsSchemaId}?limit=20`).
5. If NO existing schema matches the request, do not invent one: render '<p>Please create the "<Name>" data table first, then regenerate this element.</p>' and stop.
""".strip()
# ------------------------------------------------------------------
# MODULE: CRUD CORE — API + rendering (complete pattern)
# ------------------------------------------------------------------
MODULE_CRUD = f"""
## DATA API
- Read:   api.get(`/custom-data/rows/${{schemaId}}?skip=${{skip}}&limit=${{limit}}`) → res.data.rows, res.data.total. Single row: append &row_id is NOT supported — fetch list and .find(r=>r.row_id===id).
- Create: api.post(`/custom-data/rows/${{schemaId}}`, {{ data, sitemember_id }})  (server validates required/unique/options → show err.response?.data?.detail)
- Update: api.put(`/custom-data/rows/${{rowId}}`, {{ data: mergedData, sitemember_id }})  — fetch-merge-update ONLY for non-competitive edits. Competitive writes (booking/stock/credits) use ATOMIC.
- Delete: api.delete(`/custom-data/rows/${{rowId}}?sitemember_id=${{smId}}`)
- Search: api.post(`/custom-data/rows/${{schemaId}}/search?skip=0&limit=20`, {{ filters:{{ title:{{ilike:q}}, price:{{'>=':min,'<=':max}}, status:"active" }}, sort_by:"created_at", sort_order:"desc" }})
- Bulk (2+ rows → ONE call, never a loop of posts): api.post(`/custom-data/rows/${{schemaId}}/bulk`, {{ operations: arr.map(d=>({{action:"create", data:d, sitemember_id}})) }})
- Distinct values: api.get(`/custom-data/rows/${{schemaId}}/distinct/${{fieldId}}`) → res.data.values

{_HELPERS_JS}

## RENDERING FETCHED ROWS (complete pattern — adapt columns/markup to the actual fields)
let rows = []; let currentPage = 0; const rowsPerPage = 20; let totalRows = 0; const smId = null; // or currentUserId when user-scoped — ALWAYS declared
const fetchAndRenderRows = async () => {{
  const list = container.querySelector('.list-container');
  list.innerHTML = '<p style="color:#6b7280;font-size:14px">Loading...</p>';
  try {{
    const res = await api.get(`/custom-data/rows/${{schemaId}}?skip=${{currentPage*rowsPerPage}}&limit=${{rowsPerPage}}`);
    rows = res.data.rows; totalRows = res.data.total;
    if (!rows.length) {{ list.innerHTML = '<p style="color:#6b7280;font-size:14px">No items found</p>'; return; }}
    list.innerHTML = `
      <div style="overflow-x:auto;width:100%"><table class="data-table">
        <thead><tr><th>Name</th><th>Email</th><th>Message</th></tr></thead>
        <tbody>${{rows.map(r => `
          <tr>
            <td>${{esc(displayValue(r.data.name))}}</td>
            <td>${{esc(displayValue(r.data.email))}}</td>
            <td class="wrap">${{esc(displayValue(r.data.message))}}</td>
          </tr>`).join('')}}
        </tbody></table></div>`;
    attachEventListeners();
    renderPagination();
  }} catch (e) {{ list.innerHTML = '<p style="color:#b91c1c;font-size:14px">Could not load data.</p>'; }}
}};
EVERY cell goes through relDisplay(f, ...) (falls back to displayValue for non-relations) (relations render as their readable values, booleans as Yes/No, never [object Object]). Image fields render <img src="${{esc(firstValue(r.data.photo))}}" ...> instead of text. If management buttons are wanted, add an Actions column: <td><button class="edit" data-id="${{r.row_id}}">Edit</button><button class="delete" data-id="${{r.row_id}}">Delete</button></td>.
Relation-field cells use relDisplay(f, r.data[f.id]) (defined in the FORMS section) instead of bare displayValue — a "name" relation column shows the name, an "email" relation column the email; unmatched relations (booking slots) fall back to full concatenation.
## EVENT LISTENERS
STATIC buttons that exist in aiTemplate (add-new, refresh, toggles) are wired ONCE at top level right after state — never inside render functions (which may early-return on empty data, leaving them dead). attachEventListeners handles ONLY per-row buttons and runs after every render, never nested in another loop:
const attachEventListeners = () => {{
  container.querySelectorAll('.delete').forEach(btn => btn.onclick = async () => {{
    if (!confirm('Are you sure you want to delete this item?')) return;
    const id = btn.getAttribute('data-id');
    btn.disabled = true; btn.textContent = '...';
    try {{ await api.delete(`/custom-data/rows/${{id}}?sitemember_id=${{smId ?? 'null'}}`); await fetchAndRenderRows(); }}
    catch (err) {{ alert(err.response?.data?.detail || 'Delete failed.'); }}
    finally {{ btn.disabled = false; btn.textContent = 'Delete'; }}
  }});
  container.querySelectorAll('.edit').forEach(btn => btn.onclick = () => {{
    const id = btn.getAttribute('data-id');
    const row = rows.find(r => r.row_id === id);
    if (row) openForm(row);
  }});
}};

## PAGINATION (include when data can exceed one page; skip for small fixed sets)
const renderPagination = () => {{
  const pg = container.querySelector('.pagination');
  if (!pg) return;
  const totalPages = Math.max(1, Math.ceil(totalRows / rowsPerPage));
  if (totalPages <= 1) {{ pg.innerHTML = ''; return; }}   // no controls when everything fits on one page
  pg.innerHTML = `
    <button class="pg-prev" ${{currentPage===0?'disabled':''}}>Previous</button>
    <span style="font-size:13px;color:#6b7280">Page ${{currentPage+1}} of ${{totalPages}}</span>
    <button class="pg-next" ${{currentPage>=totalPages-1?'disabled':''}}>Next</button>`;
  pg.querySelector('.pg-prev').onclick = () => {{ currentPage--; fetchAndRenderRows(); }};
  pg.querySelector('.pg-next').onclick = () => {{ currentPage++; fetchAndRenderRows(); }};
}};

## READ-ONLY IS THE DEFAULT
"show / display / list / get data from X" = READ-ONLY: no edit/delete buttons, no add form, no Actions column.
Include management UI ONLY when the prompt asks to manage/edit/delete/add the data, or implies users maintain their own entries. User-scoped elements count as management.

## OWNERSHIP (sitemember_id)
- Not user-scoped → const smId = null; everywhere.
- PUT/DELETE on a row the USER created → currentUserId (null gives 403). On a SHARED/admin-created row (booking a slot) → null. Rule: match whoever created the row.
- NEVER use the zero UUID "00000000-..." — the server rejects it on public sites.
""".strip()


# ------------------------------------------------------------------
# MODULE: FORMS — complete form generation incl. relations,
# cascading dropdowns, uploads, edit prefill, submit
# ------------------------------------------------------------------
MODULE_FORMS = """
## FORM GENERATION (complete pattern — this is how create/edit forms are built)
Schema fields come from properties.schema_fields: [{id,label,type,related_schema_id?,options?,required?}].
let editingRowId = null;
const inputCls = 'w-full p-2 border rounded-lg border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none';

const buildFieldHTML = (f, initial = {}) => {
  const val = initial[f.id];
  const label = `<label class="block text-sm font-semibold text-gray-700 mb-1">${esc(f.label)}</label>`;
  if (f.type === 'relation')
    return `<div>${label}<select name="${f.id}" data-relation="${f.related_schema_id}" class="${inputCls}" ${f.required?'required':''}><option value="">Loading...</option></select></div>`;
  if (f.type === 'boolean') {
    const isTrue = val === true || val === 'true';
    return `<div>${label}<select name="${f.id}" class="${inputCls}"><option value="true" ${isTrue?'selected':''}>Yes</option><option value="false" ${!isTrue?'selected':''}>No</option></select></div>`;
  }
  if (Array.isArray(f.options) && f.options.length)
    return `<div>${label}<select name="${f.id}" class="${inputCls}">${f.options.map(o=>`<option value="${esc(o)}" ${String(val)===String(o)?'selected':''}>${esc(o)}</option>`).join('')}</select></div>`;
  if (['image','file','gallery'].includes(f.type))
    return `<div>${label}<input type="file" data-upload="${f.id}" ${f.type==='gallery'?'multiple':''} class="${inputCls}"><input type="hidden" name="${f.id}" value="${esc(val ?? '')}">${val?`<p class="text-xs text-gray-500 mt-1">Current file kept unless replaced</p>`:''}</div>`;
  const t = f.type==='date'?'date':(f.type==='number'?'number':(f.type==='email'?'email':'text'));
  return `<div>${label}<input type="${t}" name="${f.id}" value="${esc(val ?? '')}" class="${inputCls}" ${f.required?'required':''}></div>`;
};

const openForm = async (row = null) => {
  editingRowId = row ? (row.row_id || null) : null;
  const fc = container.querySelector('.form-container');
  ## SUBMIT (try/catch wraps ONLY the api call — UI code after it, or a render hiccup shows 'Save failed' for a committed save)
const handleSubmit = async (e) => {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector('button[type="submit"]');
  const data = {};
  form.querySelectorAll('input[name],select[name],textarea[name]').forEach(el => {
    if (el.type === 'file') return;
    data[el.getAttribute('name')] = el.value;
  });
  btn.disabled = true; const prev = btn.textContent; btn.textContent = 'Saving...';
  let saved = false;
  try {
    if (editingRowId) await api.put(`/custom-data/rows/${editingRowId}`, { data, sitemember_id: smId });
    else await api.post(`/custom-data/rows/${schemaId}`, { data, sitemember_id: smId });
    saved = true;
  } catch (err) {
    alert(err.response?.data?.detail || 'Save failed.');
  } finally { btn.disabled = false; btn.textContent = prev; }
  if (!saved) return;
  form.reset();
  container.querySelector('.form-container').classList.add('hidden');
  editingRowId = null;
  try { await fetchAndRenderRows(); } catch (e) {}   // Scenario B; Scenario A: alert('Saved successfully!') instead
};
  fc.innerHTML = `<form class="grid grid-cols-1 md:grid-cols-2 gap-4">
    ${properties.schema_fields.map(f => buildFieldHTML(f, initial)).join('')}
    <button type="submit" class="md:col-span-2 w-full bg-blue-600 text-white font-bold py-2.5 rounded-lg hover:bg-blue-700">${editingRowId ? 'Update' : 'Save'}</button>
  </form>`;
  fc.classList.remove('hidden');
  await populateRelationSelects(fc.querySelector('form'), initial);
  wireUploads(fc.querySelector('form'));
  fc.querySelector('form').onsubmit = handleSubmit;
};

## RELATION LABEL FIELD (makes multi-relation schemas readable)
When a relation field's id/label matches a field in the RELATED schema, label with THAT field only; otherwise concatenate. Define once, use for BOTH table cells and dropdown options:
const relLabelField = (f) => {
  const rel = (properties.all_schemas || []).find(s => String(s.schema_id) === String(f.related_schema_id));
  const m = rel && (rel.fields || []).find(rf => rf.id === f.id || (rf.label || '').toLowerCase() === (f.label || '').toLowerCase());
  return m ? m.id : null;
};
const relDisplay = (f, v) => {
  const lf = relLabelField(f);
  return (lf && v && typeof v === 'object' && v.data) ? displayValue(v.data[lf]) : displayValue(v);
};

## RELATION DROPDOWNS (prefill via extractRowId — prevents [object Object])
const populateRelationSelects = async (form, initial = {}) => {
  for (const sel of form.querySelectorAll('select[data-relation]')) {
    const name = sel.getAttribute('name');
    const f = (properties.schema_fields || []).find(x => x.id === name) || {};
    try {
      const res = await api.get(`/custom-data/rows/${sel.getAttribute('data-relation')}?limit=1000`);
      sel.innerHTML = '<option value="">Select...</option>' +
        res.data.rows.map(r => `<option value="${r.row_id}">${esc(relDisplay(f, r))}</option>`).join('');
      const initId = extractRowId(initial[name]);
      if (initId) sel.value = initId;
    } catch (e) { sel.innerHTML = '<option value="">Failed to load</option>'; }
  }
};
## CASCADING DROPDOWNS (parent → child, e.g. Day → Time Slot)
When one dropdown filters another:
// PARENT: unique labels via distinct (never new Set() client dedup):
const dayValues = (await api.get(`/custom-data/rows/${slotsSchemaId}/distinct/day`)).data.values;
daySelect.innerHTML = '<option value="">Select day</option>' + dayValues.map(d => `<option value="${esc(d)}">${esc(d)}</option>`).join('');
// CHILD: cache all child rows ONCE, filter on parent change:
let slotRows = (await api.get(`/custom-data/rows/${slotsSchemaId}?limit=1000`)).data.rows;
daySelect.onchange = () => {
  const filtered = slotRows.filter(r =>
    String(displayValue(r.data.day)) === daySelect.value &&        // parent match (works for plain values AND relation objects)
    (r.data.available === true || r.data.available === 'true'));    // availability filter when relevant
  timeSelect.innerHTML = '<option value="">Select time</option>' +
    filtered.map(r => `<option value="${r.row_id}">${esc(displayValue(r.data.start_time))} - ${esc(displayValue(r.data.end_time))}</option>`).join('');
};
If the parent field on child rows is itself a relation, compare with extractRowId(r.data.parentField) === parentSelect.value.
The SUBMITTED value is always select.value (a row_id string) — never the label, never an object.

## FILE UPLOADS (inside the form)
const wireUploads = (form) => {
  form.querySelectorAll('input[data-upload]').forEach(fi => fi.onchange = async () => {
    if (!fi.files.length) return;
    const hidden = form.querySelector(`input[name="${fi.getAttribute('data-upload')}"]`);
    fi.disabled = true;
    try {
      if (fi.multiple) {
        const urls = [];
        for (const file of fi.files) { const fd = new FormData(); fd.append('file', file); const up = await api.post('/uploads/', fd); urls.push(up.data ? up.data.url : up.url); }
        hidden.value = JSON.stringify(urls);
      } else {
        const fd = new FormData(); fd.append('file', fi.files[0]);
        const up = await api.post('/uploads/', fd);
        hidden.value = up.data ? up.data.url : up.url;
      }
    } catch (e) { alert('Upload failed.'); }
    finally { fi.disabled = false; }
  });
};

## SUBMIT (values are already strings/row_ids thanks to the patterns above)
const handleSubmit = async (e) => {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector('button[type="submit"]');
  const data = {};
  form.querySelectorAll('input[name],select[name],textarea[name]').forEach(el => {
    if (el.type === 'file') return;
    data[el.getAttribute('name')] = el.value;
  });
  btn.disabled = true; const prev = btn.textContent; btn.textContent = 'Saving...';
  try {
    if (editingRowId) await api.put(`/custom-data/rows/${editingRowId}`, { data, sitemember_id: smId });
    else await api.post(`/custom-data/rows/${schemaId}`, { data, sitemember_id: smId });
    form.reset();
    container.querySelector('.form-container').classList.add('hidden');
    editingRowId = null;
    // Scenario A (public/booking/"don't show data"): alert('Saved successfully!') only.
    // Scenario B (manage/list views): await fetchAndRenderRows();
  } catch (err) {
    alert(err.response?.data?.detail || 'Save failed.');   // surfaces 422 validation + 409 double-booking
  } finally { btn.disabled = false; btn.textContent = prev; }
};
""".strip()


# ------------------------------------------------------------------
# Other capability modules
# ------------------------------------------------------------------
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
  else alert(err.response?.data?.detail || 'Something went wrong.');
}
Likes: increments:{likes:1}. Credits: increments:{credits:-1} with a conditions guard. No manual availability checks anywhere.
""".strip()

MODULE_STATS = """
## STATS & CHART DATA (never aggregate client-side, never fetch-all-to-sum)
- One number: api.post(`/custom-data/rows/${schemaId}/stats`, {field:"amount", operation:"sum", filters:{}}) → res.data.result
- Grouped (charts/leaderboards): api.post(`/custom-data/rows/${schemaId}/stats/grouped`, {group_by:"category", field:"amount", operation:"sum", filters:{}}) → res.data.results = [{group, value}] sorted desc. operation:"count" needs no field.
- Unique values: api.get(`/custom-data/rows/${schemaId}/distinct/day`) → res.data.values
- User-scoped: append ?sitemember_id=${currentUserId}.
- Display: el.textContent = res.data.result (assign, never +=); fetch once, never inside render loops; refetch after bulk saves. Stats are FETCHED DATA — script-rendered, never {{tokens}}.
""".strip()

MODULE_UPSERT = """
## PROFILE / SETTINGS / SINGLE-RECORD-PER-USER
One call creates OR updates — no "profile not found" branching:
await api.post(`/custom-data/rows/${schemaId}/upsert`, {
  match: { sitemember_id: currentUserId },        // or { email: emailValue }
  data:  { username, bio },
  sitemember_id: currentUserId
});
Prefill: const existing = (await api.get(`/custom-data/rows/${schemaId}?sitemember_id=${currentUserId}&limit=1`)).data.rows[0];
if (existing) openForm(existing);  // empty result just means a fresh form — never an error message.
""".strip()

MODULE_USER_SCOPE = """
## USER-SCOPED DATA ("my items", "current user", "their own")
const currentUserId = typeof window !== 'undefined' ? localStorage.getItem('siteMemberId:' + (properties.subdomain || '')) : null;
if (!currentUserId) { container.querySelector('.content').innerHTML = '<p style="font-size:14px;color:#6b7280">Please log in to view your data</p>'; return; }
const smId = currentUserId;
Reads: append ?sitemember_id=${currentUserId} (main list ONLY — never filter relation-dropdown data by user). Writes/deletes: sitemember_id = currentUserId everywhere, including every bulk operation.
User-scoped elements ARE management elements: users maintain their own entries, so edit/delete on their own rows is appropriate even without explicit "edit/delete" words in the prompt.
""".strip()

MODULE_AI_GEN = """
## AI GENERATION (via api.post('/builder/openai', {website_id: properties.website_id, member_id: currentUserId, prompt, system_prompt}))
Pick the mode by destination BEFORE coding: saving rows → FLAT ARRAY; short text display → TEXT; complex UI (scores/panels) → STRUCTURED UI.
AI responses are FETCHED DATA: script-rendered, never {{tokens}}.

ALWAYS strip before parsing (all modes):
let cleanText = aiRes.data.text.replace(/```json/g,'').replace(/```/g,'').replace(/^json\\s*/i,'').replace(/^JSON\\s*/i,'').trim();

FLAT ARRAY MODE — system_prompt = context + THIS EXACT SUFFIX (mandatory):
  " THE SILENCE RULE: Reply ONLY with a flat raw JSON array. Every item = one database row. No nested objects, no wrapper keys, no markdown, no chat. Example: [{\\"field1\\":\\"value\\"}]"
Then fix bare words → cleanText = cleanText.replace(/:\\s*([a-zA-Z]+[a-zA-Z0-9]*)\\s*([,}\\]])/g,(m,w,n)=> (w==='true'||w==='false'||w==='null')?m:`: "${w}"${n}`);
Extract: const jm = cleanText.match(/\\{[\\s\\S]*\\}|\\[[\\s\\S]*\\]/); if(!jm) throw new Error('No parsable data'); const arr = Array.isArray(JSON.parse(jm[0]))?JSON.parse(jm[0]):[JSON.parse(jm[0])];
Save with ONE bulk call, sitemember_id per the ownership rules.

TEXT MODE — system_prompt ends with "Reply with plain text only. No JSON, no markdown, no backticks." Then el.textContent = cleanText. Never JSON.parse plain text.

STRUCTURED UI MODE — count the UI panels first; system_prompt = context + "Return a separate array for each of the N sections shown in the UI — never combine them. Each array item must be an object with title and description fields — never plain strings." + the SILENCE RULE variant ("Reply ONLY with valid raw JSON... First character must be { or [").
NEVER read parsedData by hardcoded key names (models rename keys every run). Use the resilient extractor:
const normalize = a => Array.isArray(a) ? a.map(i => typeof i==='string' ? {title:i,description:''} : i) : [];
const score = Object.values(parsedData).find(v=>typeof v==='number')||0;
const summary = Object.values(parsedData).find(v=>typeof v==='string'&&v.length>100)||'';
const extractArrays = (o,d=0)=>{ if(d>2) return []; const r=[]; for(const [k,v] of Object.entries(o)){ if(Array.isArray(v)&&v.length) r.push({key:k,label:k.replace(/_/g,' ').replace(/\\b\\w/g,c=>c.toUpperCase()),items:normalize(v)}); else if(v&&typeof v==='object'&&!Array.isArray(v)) r.push(...extractArrays(v,d+1)); } return r; };
Render extractArrays(parsedData) as panels; check the element exists before writing. Add website_id to properties; systemPrompt to properties+editableProps if user-editable.
""".strip()

MODULE_CHATBOT = """
## CHATBOT
Decision: questions only → READ-ONLY BOT. Booking/saving/emailing → ACTION-BASED BOT.
NON-NEGOTIABLE MECHANICS (both bots):
1. Send button = btn.onclick (inputs live in a div — form.onsubmit silently never fires).
2. Knowledge base + history go INSIDE system_prompt via buildSystemPrompt() — never as separate context fields (the API ignores them). prompt = latest user message ONLY.
3. Call the API FIRST, push to chatHistory AFTER (user + assistant together). Never slice(0,-1).
4. await loadContext() before every message (fresh rows). Truncate history to last 20 before each call. Always member_id: currentUserId.

let chatHistory = []; let businessContext = '';
const loadContext = async () => { try { const r = await api.get(`/custom-data/rows/${schemaId}?limit=100`); businessContext = r.data.rows.map(x => displayValue(x.data.info) || Object.entries(x.data).map(([k,v])=>`${k}: ${displayValue(v)}`).join(', ')).join('\\n'); } catch(e){ businessContext='No information available.'; } };
const buildSystemPrompt = () => `You are a helpful assistant.\\n\\nKNOWLEDGE BASE (live):\\n${businessContext}\\n\\nCONVERSATION SO FAR:\\n${chatHistory.map(m=>`${m.role}: ${m.content}`).join('\\n')}\\n\\nRULES:\\n- Answer from the knowledge base; summarize freely\\n- Only say you lack the info if it is genuinely absent\\n- Never invent prices/addresses/facts`;

Chat messages are FETCHED DATA: render bubbles in the script (user right/primary, assistant left/gray, esc() every message), auto-scroll the messages div after each append.

ACTION-BASED BOT adds to buildSystemPrompt: mission (collect email ONCE, confirm ONCE, execute immediately on positive confirmation, never re-ask known info) and the EXECUTION PROTOCOL — on confirmation reply ONLY raw JSON:
{"action":"execute_workflow","email":"...","steps":[{"db_action":"create|update|delete","db_target":"schema_id for create / row_id for update+delete","db_payload":{...},"owned":true|false}],"summary":"plain text"}
Executor: create → api.post(`/custom-data/rows/${step.db_target}`,{data:step.db_payload,sitemember_id:step.owned?currentUserId:null});
update → PREFER api.post(`/custom-data/rows/${step.db_target}/atomic`,{conditions:step.db_conditions||{},set_values:step.db_payload,sitemember_id:step.owned?currentUserId:null}) for slot/stock changes (409 = taken); otherwise fetch-merge-PUT;
delete → api.delete(`/custom-data/rows/${step.db_target}?sitemember_id=${step.owned?currentUserId:null}`).
After all steps: optional email via api.post('/builder/send-email',{website_id:properties.website_id,to_email:cmd.email,subject:properties.emailSubject||'Confirmation',content:(properties.emailBody||'')+(cmd.summary||'')}); then push history, render "✅ "+cmd.summary. Non-JSON replies render as normal chat. emailSubject/emailBody in properties+editableProps.
""".strip()

MODULE_CHARTS = """
## DASHBOARD / CHARTS
- Load Chart.js dynamically; ALL chart code inside script.onload:
const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/chart.js'; s.onload = () => { /* all chart code here */ }; container.appendChild(s);
- Wrap each <canvas> in <div style="position:relative;width:100%;max-width:100%;height:300px">. Container: width:100%;overflow-x:hidden.
- Data comes from /stats and /stats/grouped (see STATS) — never fetch all rows to compute totals. Grouped maps directly: labels = results.map(r=>r.group), data = results.map(r=>r.value).
- KPI cards: compact (16-20px padding), 28-32px bold number, 13px gray label — no images/icons unless asked.
- Sanitize fallbacks: parseFloat(String(v).replace(/[^0-9.,-]/g,'').replace(',','.'))||0.
""".strip()

MODULE_ECOMMERCE = """
## E-COMMERCE / CART / CHECKOUT
`addToCart` is INJECTED as the argument after Mustache — never define it, never import it. Guard its absence:
if (typeof addToCart !== 'function') { alert('Cart is not available on this page.'); return; }

## THE CART ITEM CONTRACT (exact shape — the cart dedupes by JSON.stringify of extras/options, so be consistent)
addToCart({
  cartItemId: `${row.row_id}-${Date.now()}`,
  itemId: row.row_id,
  name: displayValue(row.data.name),
  imageUrl: firstValue(row.data.image) || '',
  quantity: Math.max(1, parseInt(qtyInput?.value) || 1),
  unitPrice: Number(displayValue(row.data.price)) || 0,   // MUST be a number — totals break on strings
  selectedExtras: extras,        // array of {name, price:Number} — [] when none, never undefined
  selectedOptions: options       // flat Record<string,string> like {Size:"Large"} — {} when none
});
Compute unitPrice as base + sum of selected extras' prices BEFORE calling, or keep extras priced and base-only unitPrice — pick ONE convention and use it consistently in the component.

## READING SELECTIONS
Never inline onclick="addToCart(...)". Buttons get data-index; listeners attached in JS read from btn.closest('.card'):
const card = btn.closest('.card');
const qtyInput = card.querySelector('.qty');
const options = {}; card.querySelectorAll('select[data-option]').forEach(s => { if (s.value) options[s.getAttribute('data-option')] = s.value; });
const extras = [...card.querySelectorAll('input[data-extra]:checked')].map(c => ({ name: c.getAttribute('data-extra'), price: Number(c.getAttribute('data-price')) || 0 }));

## STOCK & CHECKOUT
- Stock decrement on purchase → ATOMIC endpoint (increments:{stock:-1}, conditions e.g. {in_stock:true}); 409 = out of stock.
- Checkout CTA gets class "checkout-btn"; no custom Stripe calls. Click isolation:
container.addEventListener('click',(e)=>{ if(!e.target.closest('.checkout-btn')){ e.stopImmediatePropagation(); e.preventDefault(); } }, true);
- Product grids MAY be visual (cards with images) — products are the image-field case of the design defaults.
"""
MODULE_EMAIL = """
## EMAIL SENDING (contact/notification flows)
await api.post('/builder/send-email', { website_id: properties.website_id, to_email: emailInput.value, subject: properties.emailSubject || 'Thank you', content: properties.emailBody || '<p>We received your message.</p>' });
Add website_id to properties; emailSubject + emailBody to properties AND editableProps.
""".strip()

MODULE_EXTERNAL_API = """
## EXTERNAL APIs (CORS-blocked services)
Use the proxy — const res = await api.post('/builder/fetch-external', { url, method:'GET'|'POST', headers, body: rawObject /* NEVER JSON.stringify */ });
The real payload is DOUBLE-WRAPPED: always read res.data.data. Auth keys via properties.apiKey (editableProps only if the API needs a key; never hardcode).
External responses are FETCHED DATA: script-rendered, never {{tokens}}.
""".strip()

MODULE_DYNAMIC_PAGES = """
## MASTER → DETAIL PAGES
Master link: const isMainHost = window.location.hostname.includes('zygoflow.com'); const basePath = isMainHost && properties.subdomain ? `/${properties.subdomain}` : ''; then on row click: window.location.href = `${basePath}/detail-page?id=${rowId}`;
Detail page: const rowId = new URLSearchParams(window.location.search).get('id'); guard missing id/row with a friendly message; fetch the list and .find(r=>r.row_id===rowId); map fields to DOM through displayValue()/firstValue() (fetched data — script-rendered, no tokens).
""".strip()


# ------------------------------------------------------------------
# INTENT ROUTER
# ------------------------------------------------------------------
_FORM_WORDS = ["form", "add", "create", "submit", "book", "reserv", "register", "sign up",
               "apply", "order", "edit", "manage", "update", "crud", "admin", "upload",
               "dropdown", "select", "relate", "relation", "profile", "settings", "own"]

_INTENT_MAP = [
    (["chat", "bot", "assistant", "concierge", "support agent"], [MODULE_CHATBOT, MODULE_CRUD]),
    (["chart", "graph", "dashboard", "kpi", "analytic", "leaderboard", "report"], [MODULE_CHARTS, MODULE_STATS, MODULE_CRUD]),
    (["book", "reserv", "slot", "appointment", "stock", "inventory", "credit", "like", "vote", "rsvp"], [MODULE_ATOMIC, MODULE_CRUD, MODULE_FORMS]),
    (["profile", "settings", "preference", "account page", "my account"], [MODULE_UPSERT, MODULE_USER_SCOPE, MODULE_CRUD, MODULE_FORMS]),
    (["my ", "current user", "logged in", "their own", "user-specific", "personal"], [MODULE_USER_SCOPE, MODULE_CRUD, MODULE_FORMS]),
    (["generate", "summariz", "analyz", "write ", "auto-fill", "extract", "score", "ai "], [MODULE_AI_GEN, MODULE_CRUD]),
    (["cart", "checkout", "buy", "purchase", "shop", "price", "product"], [MODULE_ECOMMERCE, MODULE_CRUD]),
    (["upload", "file", "photo", "cv", "avatar", "gallery"], [MODULE_FORMS, MODULE_CRUD]),
    (["email", "notify", "contact form", "newsletter", "subscribe"], [MODULE_EMAIL, MODULE_CRUD, MODULE_FORMS]),
    (["external api", "weather", "fetch from", "third party", "cors"], [MODULE_EXTERNAL_API]),
    (["detail page", "master", "click to open", "product page", "blog post page"], [MODULE_DYNAMIC_PAGES, MODULE_CRUD]),
    (["form", "submit", "save", "table", "list", "track", "manage", "database", "store", "entries",
      "records", "crud", "sum", "total", "count", "show", "display", "get data", "view", "data"], [MODULE_CRUD, MODULE_STATS]),
]


def build_system_prompt(user_prompt: str, base: str = BASE_RULES) -> str:
    """BASE + only the modules this request needs. FORMS auto-added on any write intent."""
    p = (user_prompt or "").lower()
    chosen: List[str] = []
    for keywords, modules in _INTENT_MAP:
        if any(k in p for k in keywords):
            for m in modules:
                if m not in chosen:
                    chosen.append(m)
    if any(w in p for w in _FORM_WORDS) and MODULE_FORMS not in chosen:
        chosen.append(MODULE_FORMS)
    if not chosen:
        chosen = [MODULE_CRUD]
    return base + "\n\n" + MODULE_BINDING + "\n\n" + "\n\n".join(chosen)


# ------------------------------------------------------------------
# LINT + REPAIR (prompt-aware, conservative)
# ------------------------------------------------------------------
_MUSTACHE_COND = re.compile(r"\{\{[#/^]\s*(if|unless|eq|each)\b")
_TOKEN_RE = re.compile(r"\{\{\{?\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}?\}\}")
_MANAGEMENT_WORDS = [
    "edit", "delete", "remove", "manage", "update", "crud", "admin",
    "add", "create", "submit", "form", "book", "reserv", "upload",
    "their own", "own data", "own entries", "track", "save", "todo",
    "cancel", "sign up", "register", "apply", "order",
]
_DISPLAY_WORDS = ["show", "display", "list", "get data", "view", "table of", "see "]

REPAIR_PROMPT = """
You are fixing a generated component. You receive ERRORS TO FIX and the COMPONENT JSON.
Fix ONLY the listed errors. Change nothing else — do not restructure, do not remove working features. Return the complete corrected JSON object with ALL keys you received (never drop keys like schema, automations, schemas_to_create), no markdown, no explanation.
Key rules while fixing:
- {{tokens}} are ONLY for owner settings. Fetched data renders inside the script via template literals into an empty container — remove row-data tokens from aiTemplate rather than adding them to properties.
- Every displayed field value goes through displayValue()/firstValue(); every relation value written to a select/input goes through extractRowId(). Define these helpers at the top of the script if missing.
- Mustache supports only {{var}} and {{{html}}}. `container` is injected. container.querySelector only. Write into child elements, never container.innerHTML.
""".strip()

_INJECTED_PARAMS = ("container", "api", "schemaId", "properties", "Mustache", "addToCart")
_REDECL_LINE = re.compile(
    r"^[ \t]*(?:const|let|var)\s+(?:" + "|".join(_INJECTED_PARAMS) + r")\b\s*=[^;\n]*;?[ \t]*$",
    re.MULTILINE,
)
_WRAPPER_RE = re.compile(
    r"(?:(?:const|let|var)\s+\w+\s*=\s*)?(?:async\s*)?(?:function\s*\w*\s*)?"
    r"\(\s*container\s*,\s*api\s*,\s*schemaId[^)]*\)\s*(?:=>)?\s*\{"
)

def sanitize_injected_params(script: str) -> str:
    """Deterministic repairs: (1) unwrap never-invoked wrappers; (2) strip injected-param
    redeclarations; (3) strip runtime-library redefinitions; (4) declare smId if missing;
    (5) rewrite field-loop cells to relation-aware relDisplay (safe: falls back to displayValue)."""
    if not script:
        return script
    m = _WRAPPER_RE.search(script)
    if m:
        prefix = script[:m.start()]
        open_idx = script.index("{", m.start())
        close_idx = script.rfind("}")
        if close_idx > open_idx:
            body = script[open_idx + 1:close_idx]
            suffix = re.sub(r"^[\s;()]*", "", script[close_idx + 1:])
            script = prefix.rstrip() + "\n" + body.strip() + "\n" + suffix
    script = _REDECL_LINE.sub("", script)
    script = strip_lib_redefinitions(script)
    if re.search(r"\bsmId\b", script) and not re.search(r"\b(?:const|let|var)\s+smId\b", script):
        script = "const smId = null;\n" + script
    script = re.sub(
        r"displayValue\(\s*([A-Za-z_$][\w$]*)\.data\[\s*([A-Za-z_$][\w$]*)\.id\s*\]\s*\)",
        r"relDisplay(\2, \1.data[\2.id])",
        script,
    )
    return script
        
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
    redecl = re.findall(r"\b(?:const|let|var)\s+(container|api|schemaId|properties|Mustache|addToCart)\b", script)
    if redecl:
        errors.append(f"Remove all declarations of {sorted(set(redecl))} — these are injected function parameters; redeclaring any one makes the ENTIRE script fail to compile.")
    
    lib_redefs = re.findall(r"\b(?:const|let|var)\s+(extractRowId|displayValue|firstValue|esc|rowData|relLabelField|relDisplay|populateRelationSelects|wireUploads)\b", script)
    if lib_redefs:
        errors.append(f"Delete your own definitions of {sorted(set(lib_redefs))} — these functions are pre-injected by the platform with the correct behavior; your simplified versions shadow them and break relation/boolean display. Call them, never define them.")
    # save must be followed by a refetch (Scenario B) so the table reflects the change
    if "fetchAndRenderRows" in script:
        for mm in re.finditer(r"api\.(?:post|put)\([`'\"]/custom-data/rows/", script):
            window = script[mm.start():mm.start() + 900]
            if "fetchAndRenderRows" not in window and "alert('Saved successfully" not in window and 'alert("Saved successfully' not in window:
                errors.append(
                    "A save (api.post/api.put on /custom-data/rows) is not followed by a refetch — "
                    "after `saved = true` and the reset/hide steps, call `try { await fetchAndRenderRows(); } catch(e) {}` "
                    "so the table shows the new/edited row (Scenario B). Only pure Scenario A booking forms skip this."
                )
                break
    if _WRAPPER_RE.search(script):
        errors.append("The script is wrapped in a function taking (container, api, schemaId, ...) that is never invoked — remove the wrapper entirely and write the statements at top level, ending with a call to the entry function (e.g. fetchAndRenderRows()).")
    # containers the script queries must exist somewhere (template or script-generated HTML)
    for cls in set(re.findall(r"container\.querySelector(?:All)?\(\s*['\"]\.([A-Za-z0-9_-]+)", script)):
        if cls not in tmpl and not re.search(r"class=[^>]*\b" + re.escape(cls) + r"\b", script):
            errors.append(f"The script queries '.{cls}' but no such element exists in aiTemplate or in script-generated HTML — add <div class=\"{cls}\"></div> to aiTemplate.")
    # every semantic button in the template must be referenced by the script
    for btn_cls in set(re.findall(r"<button[^>]*class=[\"']([A-Za-z0-9_-]+)", tmpl)):
        if btn_cls not in script:
            errors.append(f"aiTemplate has a <button class=\"{btn_cls}\"> the script never wires — add container.querySelector('.{btn_cls}').onclick = ... at TOP LEVEL (outside render functions).")
    if fetches_rows and "${schemaId}" in script and not props.get("schema_id"):
        errors.append("The script uses the injected schemaId but properties.schema_id is missing — set properties.schema_id to the matching schema's uuid from EXISTING_SCHEMAS_ON_WEBSITE.")
    if re.search(r"container\.innerHTML\s*=", script):
        errors.append("Never assign container.innerHTML — write into a child element (add e.g. <div class=\"list-container\"></div> to aiTemplate if missing).")
    if "console.log" in script:
        errors.append("Remove all console.log calls.")
    if re.search(r"onclick\s*=\s*[\"']", tmpl):
        errors.append("Remove inline onclick=\"\" attributes from aiTemplate — attach handlers in the script.")

    # --- object-safety: fetched rows must go through the helpers ---
    if fetches_rows and "displayValue" not in script:
        errors.append(
            "The script reads row data but never calls displayValue()/relDisplay() — these are "
            "provided by the pre-injected runtime library (do NOT redefine them); route every "
            "displayed field through displayValue() (relation cells through relDisplay(f, v)) and "
            "every relation value written to a select/input through extractRowId() — raw "
            "interpolation of r.data.<field> renders [object Object]."
        )

    # --- must actually fetch when asked to display data ---
    if not fetches_rows and any(w in p for w in _DISPLAY_WORDS) and ("table" in p or "data" in p or "entries" in p or "records" in p):
        errors.append("The request asks to display data but the script never calls api.get on /custom-data/rows — add fetchAndRenderRows and call it at the bottom of the script.")

    # --- Mustache rules ---
    if _MUSTACHE_COND.search(tmpl):
        errors.append("Remove Mustache conditionals ({{#if}}/{{#eq}}/{{#each}}...) — compute conditional classes/content in the script.")

    # --- token/content-type discipline ---
    tokens = set(_TOKEN_RE.findall(tmpl)) - {"data", "row_id"}
    missing_props = tokens - set(props.keys())
    if missing_props:
        if fetches_rows:
            errors.append(
                f"Tokens {sorted(missing_props)} are in aiTemplate but not in properties. If they are ROW DATA "
                "fields: REMOVE them from aiTemplate and render the rows inside the script (displayValue(r.data.<field>)) "
                "into an empty container. If they are owner-editable settings, add them to properties AND editableProps."
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
    # convention identifiers must be declared before use
    for ident, fix in [("smId", "const smId = null; // or currentUserId when user-scoped"),
                       ("currentUserId", "const currentUserId = localStorage.getItem('siteMemberId:' + (properties.subdomain || ''));")]:
        if re.search(r"\b" + ident + r"\b", script) and not re.search(r"\b(?:const|let|var)\s+" + ident + r"\b", script):
            errors.append(f"`{ident}` is used but never declared — the whole handler throws ReferenceError. Add to the state block: {fix}")
    # --- prompt-aware: read-only default (conservative — only pure display prompts) ---
    if user_prompt:
        wants_management = any(w in p for w in _MANAGEMENT_WORDS)
        pure_display = any(w in p for w in _DISPLAY_WORDS) and not wants_management
        does_mutation = ("api.delete(`/custom-data" in script or "api.delete('/custom-data" in script
                         or "api.put(`/custom-data" in script or "api.put('/custom-data" in script)
        if fetches_rows and does_mutation and pure_display:
            errors.append(
                "The request only asked to DISPLAY data. Remove edit/delete buttons, forms, and "
                "api.put/api.delete calls — render a read-only list/table. Keep everything else unchanged."
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
- Every NEW {{token}} in aiTemplate needs: a set op for properties.<token>, and a set op replacing the whole "editableProps" array with the appended entry. Tokens are for OWNER SETTINGS only — fetched data is rendered in the script through displayValue()/firstValue(), relations via extractRowId().
- Mustache has NO conditionals. Follow the compact design defaults (dense tables for text data, no phantom image space).
- Preserve the unique class name, the helper functions, and ALL existing behavior you weren't asked to change.
- api usage must follow the API rules appended below (if any).
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
            continue
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
Rules: 5-8 sections; hero first; footer last; cohesive professional palette matching the business; every description self-contained (the section designer sees ONLY it plus the theme).
""".strip()


# ------------------------------------------------------------------
# DATA APP GENERATOR — v4 spec, exported under the same name
# ------------------------------------------------------------------
DATA_APP_PROMPT_V3 = f"""
You are an expert full-stack developer generating a self-contained CRUD data-table component styled with Tailwind CSS.

OUTPUT: one valid JSON object with keys: "name", "schema", "aiTemplate", "properties", "editableProps", "script", "automations".
Implement the COMPLETE, robust version of every behavior below — never the minimal version.

## name
Human-readable, taken directly from the user's prompt.

## schema
Array of {{id, label, type}}. id = lowercase snake_case. Types: text, number, email, date, boolean, image, gallery, file, relation.
- relation fields need "related_schema_id" — when the prompt mentions a concept matching an EXISTING_SCHEMAS_ON_WEBSITE entry, you MUST reuse its schema_id. If a needed related schema does not exist, describe it in "schemas_to_create": [{{"name":"Time Slots","fields":[...]}}] and reference it as "related_schema_id": "PLACEHOLDER_FOR_Time Slots".
- Add server-enforced validation keys where sensible: required(bool), unique(bool), default, min, max, options([...strings] → fixed dropdown). Emails unique for signups; required on essentials; options for status/category fields.

## automations (server-side — REPLACES all client-side cross-table mutation JS)
If creating/updating a row must change ANOTHER table (booking marks a slot unavailable, an order decreases stock), do NOT write JS for it. Emit:
"automations": [
  {{"trigger":"on_create","action_type":"mutate_row","config":{{
     "source_field":"time",
     "conditions":{{"available":true}},
     "set":{{"available":false}},
     "increments":{{}},
     "condition_error":"That slot was just taken — please pick another."
  }}}}
]
source_field = the field in THIS schema holding the related row_id. The server runs it atomically and rejects with 409 if conditions fail — the script just shows err.response?.data?.detail. Emit [] when there are no cross-table effects.

## aiTemplate
- <style> scoped to the given unique_class_name, MUST include:
  .{{cls}} .title {{ color: {{{{titleColor}}}}; }}   .{{cls}} .add-new-btn {{ background-color: {{{{buttonBgColor}}}}; }}
  plus: .{{cls}} .data-table {{ border-collapse:collapse; width:100% }} .{{cls}} .data-table th {{ font-size:12px; text-transform:uppercase; letter-spacing:.05em; color:#6b7280; background:#f9fafb; text-align:left; padding:10px 14px }} .{{cls}} .data-table td {{ padding:10px 14px; font-size:14px; color:#374151; border-bottom:1px solid #f3f4f6 }} .{{cls}} .data-table tr:hover {{ background:#f9fafb }} .{{cls}} .wrap {{ max-width:65ch; overflow-wrap:break-word }}
- Main container: class "p-6 bg-white rounded-xl shadow-lg border border-gray-100".
- Header "flex justify-between items-center mb-6" with <h3 class="text-2xl font-bold title">{{{{title}}}}</h3> and (ONLY if the flow includes creating rows) a button "add-new-btn px-4 py-2 text-white rounded-lg font-semibold" (no bg-* class).
- Empty containers: <div class="form-container mb-8 p-6 bg-gray-50 rounded-xl border border-gray-200 hidden"></div>, <div class="data-display w-full overflow-x-auto"></div>, <div class="pagination-controls mt-6 flex justify-center items-center gap-3"></div>.
- The row markup is built ENTIRELY in the script (no <template> needed): text-only schemas render a compact .data-table; schemas WITH image fields render media rows (flex items-center gap-4 p-4 border rounded-lg, <img class="h-12 w-12 object-cover rounded">). Never reserve image space when there is no image field.
- Edit/delete buttons appear ONLY when the prompt implies management (manage/edit/delete/admin/own entries). Pure booking/submission forms and pure display prompts get none.
- All owner-facing text and colors are {{{{tokens}}}} with entries in properties AND editableProps. Append the slot_key entry last. Row data is NEVER a token.

## script (receives container, api, schemaId, properties, Mustache — container.querySelector ONLY, arrow functions, no console.log)
THE SCRIPT IS A FUNCTION BODY — never wrap it in (container, api, schemaId, ...) => {{...}} or function(...){{...}} (a wrapper is never invoked and nothing runs). Top-level statements execute directly; the last line calls fetchAndRenderRows(). THE RUNTIME LIBRARY BELOW IS PRE-INJECTED — call its functions, never redefine them:
{_HELPERS_JS}

Then, in order:
1. Sync static UI from properties (title text/color, add-button text/bg). const fields = properties.schema_fields || [];
2. State (ALL of these, always — smId is used by every write/delete and omitting it throws ReferenceError):
   let rows = []; let currentPage = 0; const rowsPerPage = 20; let totalRows = 0; let editingRowId = null; const smId = null; // or currentUserId when user-scoped
2b. WIRE STATIC CONTROLS ONCE, AT TOP LEVEL, IMMEDIATELY AFTER STATE — never inside render functions or attachEventListeners (those don't run when the table is empty, leaving the button dead):
   const addBtn = container.querySelector('.add-new-btn');
   if (addBtn) addBtn.onclick = () => {{ editingRowId = null; openForm({{}}); }};
   attachEventListeners() wires ONLY per-row buttons (.edit-btn/.delete-btn) after each render.
   Ownership: user-scoped prompt → const currentUserId = localStorage.getItem('siteMemberId:'+(properties.subdomain||'')); login guard; const smId = currentUserId. Otherwise const smId = null. NEVER the zero admin UUID.
3. fetchAndRenderRows: first line `if (properties.hideData) return;`. GET /custom-data/rows/${{schemaId}}?skip=${{currentPage*rowsPerPage}}&limit=${{rowsPerPage}} (+ `&sitemember_id=${{currentUserId}}` when user-scoped) → rows = res.data.rows; totalRows = res.data.total.
   Text-only schemas: assemble ONE .data-table with <thead> from field labels and one <tr> per row; EVERY cell = esc(relDisplay(f, r.data[f.id])) — relDisplay, not displayValue, so relation columns show their matched field; image fields render <img src="${{esc(firstValue(r.data[f.id]))}}">; long text cells get class "wrap". Empty → "No items found". Then attachEventListeners(); renderPagination().
4. renderPagination into .pagination-controls: Previous/Next ("px-3 py-1 border rounded bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed") + "Page X of Y", disabled at bounds, clicks change currentPage and refetch.
4b. RELATION LABELING (mandatory): define relLabelField(f) — find the related schema in properties.all_schemas by f.related_schema_id, return the id of its field whose id or label matches f's; and relDisplay(f, v) = matched ? displayValue(v.data[matchedId]) : displayValue(v). TABLE CELLS for relation fields and DROPDOWN option labels both use relDisplay. Edit prefill: openForm's initial = (row && row.data) ? row.data : (row || {{}}). Submit: try/catch wraps ONLY the api call; success-path UI (reset/hide/refetch) runs after it.
5. FORM — build with this exact machinery:
   buildFieldHTML(f, initial): relation → <select name data-relation=related_schema_id> (options async); boolean → Yes/No select preselected via (val===true||val==='true'); f.options → fixed select; image/file/gallery → file input with data-upload + hidden input[name] holding the URL (gallery: multiple, JSON array string); else typed <input> with value="${{esc(initial[f.id] ?? '')}}". Inputs: "w-full p-2 border rounded-lg border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none"; labels: "block text-sm font-semibold text-gray-700 mb-1"; form: "grid grid-cols-1 md:grid-cols-2 gap-4"; submit: "md:col-span-2 w-full bg-blue-600 text-white font-bold py-2.5 rounded-lg hover:bg-blue-700".
   populateRelationSelects(form, initial): for each select[data-relation], GET /custom-data/rows/${{relId}}?limit=1000, options = rows.map(r => `<option value="${{r.row_id}}">${{esc(displayValue(r))}}</option>`), then sel.value = extractRowId(initial[name]) — THIS extractRowId call is mandatory (resolved relation objects otherwise render [object Object] / fail to preselect).
   CASCADING (parent → child, e.g. Day → Time): parent options from GET /custom-data/rows/${{relId}}/distinct/<field> (never Set() dedup); cache child rows once (limit=1000); parentSelect.onchange filters cached children — plain parent values compare String(displayValue(r.data.day)) === parentSelect.value, relation parents compare extractRowId(r.data.parent) === parentSelect.value; when the schema has availability, also filter (r.data.available===true||r.data.available==='true'); child option labels concatenate readable values (`${{esc(displayValue(r.data.start_time))}} - ${{esc(displayValue(r.data.end_time))}}`); submitted value = child select.value (a row_id).
   wireUploads(form): input[data-upload].onchange uploads via api.post('/uploads/', formData) with disabled state, writes URL(s) into the sibling hidden input (gallery: JSON.stringify array).
6. handleSubmit: e.preventDefault(); build data from all input[name]/select[name]/textarea[name] (skip type=file — hidden inputs carry URLs). EXACT control flow: disable submit btn; let saved=false; try {{ editingRowId ? await api.put(`/custom-data/rows/${{editingRowId}}`, {{data, sitemember_id: smId}}) : await api.post(`/custom-data/rows/${{schemaId}}`, {{data, sitemember_id: smId}}); saved=true; }} catch(err) {{ alert(err.response?.data?.detail || 'Save failed'); }} finally {{ re-enable btn }}; if(!saved) return; THEN OUTSIDE the try: form.reset(); hide .form-container; editingRowId=null; Scenario B: try {{ await fetchAndRenderRows(); }} catch(e) {{}}. The try/catch wraps ONLY the api call — putting reset/refetch inside it shows 'Save failed' for saves that succeeded. PRIVACY: Scenario A (public/booking/"don't show data") → alert success + reset + hide, never fetchAndRenderRows. Default = B.
7. Edit (management only): .edit-btn click → const target = rows.find(r=>r.row_id===id); editingRowId = id; openForm(rowData(target)) — rowData() is MANDATORY here (passing the raw row leaves every input empty); relation prefill happens inside populateRelationSelects. Delete: confirm() → loading → DELETE /custom-data/rows/${{id}}?sitemember_id=${{smId ?? 'null'}} → fetchAndRenderRows(). Skip step 7 entirely when no management buttons exist.

## Minimal shape example (structure only — the script implements everything above):
{{"name":"Booking System","schema":[{{"id":"name","label":"Name","type":"text","required":true}},{{"id":"email","label":"Email","type":"email","required":true}},{{"id":"time","label":"Time Slot","type":"relation","related_schema_id":"<existing-uuid>"}}],"automations":[{{"trigger":"on_create","action_type":"mutate_row","config":{{"source_field":"time","conditions":{{"available":true}},"set":{{"available":false}},"condition_error":"That slot was just taken."}}}}],"aiTemplate":"<style>...</style><div class=...>...</div>","properties":{{"title":"Book a Slot","addButtonText":"New Booking","titleColor":"#111827","buttonBgColor":"#3b82f6","slot_key":""}},"editableProps":[{{"key":"title","label":"Title","type":"text"}},{{"key":"addButtonText","label":"Add Button Text","type":"text"}},{{"key":"titleColor","label":"Title Color","type":"color"}},{{"key":"buttonBgColor","label":"Button Color","type":"color"}},{{"key":"slot_key","label":"⚡ Agent Slot Key","type":"text"}}],"script":"..."}}
""".strip()