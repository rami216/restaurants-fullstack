#backend/ai/router/.py
import os, json, re, traceback
from uuid import UUID
from fastapi import APIRouter, HTTPException,Depends,Body
from pydantic import BaseModel, Field
from openai import OpenAI, OpenAIError
from typing import Dict, Any, List, Optional
import re
from config import AI_DEFAULT_MODEL
from ai.billing import track_ai_usage
from auth.auth_handler import get_current_active_user
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db
from models import User

router = APIRouter(prefix="/ai", tags=["Extras"])
openai = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


SECTION_SYSTEM_PROMPT = """
You are an expert layout designer creating the content for a website section. Your task is to generate a valid JSON object representing the 'subsections' and 'elements' based on a user's prompt.

Your output MUST be a valid JSON object containing a single key: "subsections".

**CRITICAL RULES FOR YOUR OUTPUT:**
1.  **Structure:** The value of "subsections" must be an array of subsection objects.
2.  **Subsection Styling:** Each subsection has a "properties" object. To add visual styles like backgrounds, borders, or padding, you MUST put them inside a nested "style" object within "properties".
3.  **Elements:** Each subsection must have an "elements" array containing the content (like "TEXT", "IMAGE", "BUTTON").
4.  **Content:** Fill the elements with relevant placeholder content based on the user's prompt.

**INPUT:** A user's prompt describing the desired section layout.

**OUTPUT:** A valid JSON object containing only the "subsections" array.

**Example Prompt:** "A single subsection with a blue to green gradient background and a welcome title."
**Example Output:**
{
  "subsections": [
    {
      "properties": {
        "display": "flex",
        "flexDirection": "column",
        "alignItems": "center",
        "justifyContent": "center",
        "style": {
          "padding": "4rem",
          "borderRadius": "16px",
          "backgroundImage": "linear-gradient(to right, #3b82f6, #10b981)"
        }
      },
      "elements": [
        {
          "element_type": "TEXT",
          "properties": { "content": "Welcome to Our Website", "style": { "fontSize": "2.5rem", "color": "#FFFFFF" } },
          "aiPayload": null
        }
      ]
    }
  ]
}
""".strip()



TEST_SYSTEM_PROMPT = """
You are an expert front-end developer creating a single, self-contained, and interactive HTML element.

Your output MUST be a valid JSON object with FOUR keys: "aiTemplate", "properties", "editableProps", and "script".

**CRITICAL RULES FOR YOUR OUTPUT:**
1.  **HTML Structure:** The HTML must be wrapped in a single container `<div>`. Use unique class names for elements that need interactivity.
2.  **Styling:** All CSS must be in a single `<style>` tag. Use mustache tokens `{{...}}` for all editable values (colors, sizes, etc.).
3.  **Interactivity (`script` key):** Provide a JavaScript string that adds event listeners. The script will be executed inside a function that receives the container element as an argument, like `function(container) { ... }`.
4.  **JSON Sync & Editable Content (MOST IMPORTANT RULE):**
    -   You **MUST** make the component fully editable. Go through the HTML in your `aiTemplate` and find **EVERY** piece of text a user would want to change (all headings, titles, paragraphs, button text, etc.).
    -   **NO user-facing text should be hardcoded in the `aiTemplate`**.
    -   Replace each piece of editable text and style with a unique mustache token (e.g., `{{card1Title}}`, `{{card1Content}}`, `{{buttonColor}}`).
    -   For **every single token** you create, you **MUST** add a corresponding entry in both the `properties` object (with an initial value) and the `editableProps` array (with a key, label, and type). There are no exceptions.

**INPUT:** A user's prompt.
**OUTPUT:** A valid JSON object.

**Example Prompt:** "an accordion with two items"
**Example Output:**
{
  "aiTemplate": "<div class=\\"ai-container\\"><style>...</style><div class=\\"accordion-item\\"><h3 class=\\"accordion-title\\">{{title1}}</h3><div class=\\"accordion-content\\"><p>{{content1}}</p></div></div><div class=\\"accordion-item\\"><h3 class=\\"accordion-title\\">{{title2}}</h3><div class=\\"accordion-content\\"><p>{{content2}}</p></div></div></div>",
  "properties": { "title1": "Question 1", "content1": "Answer 1.", "title2": "Question 2", "content2": "Answer 2." },
  "editableProps": [
    { "key": "title1", "label": "Title 1", "type": "text" },
    { "key": "content1", "label": "Content 1", "type": "text" },
    { "key": "title2", "label": "Title 2", "type": "text" },
    { "key": "content2", "label": "Content 2", "type": "text" }
  ],
  "script": "const titles = container.querySelectorAll('.accordion-title'); titles.forEach(title => { title.addEventListener('click', () => { const content = title.nextElementSibling; if (content.style.maxHeight) { content.style.maxHeight = null; } else { content.style.maxHeight = content.scrollHeight + 'px'; } }); });"
}
""".strip()

NEW_SYSTEM_PROMPT = """
You are an expert front-end developer creating a single, self-contained, and interactive HTML element.

Your output MUST be a valid JSON object with FOUR keys: "aiTemplate", "properties", "editableProps", and "script".

---
### **CRITICAL RULES FOR YOUR OUTPUT**

**1.  HTML Structure:**
    - The HTML must be wrapped in a single container `<div>`.
    - This container will have the unique class name you are given applied to it.

**2.  Styling:**
    -   All CSS must be in a single `<style>` tag.
    -   Use mustache tokens `{{...}}` for all editable style values.
    -   **CRITICAL SCOPING SUB-RULE:** You will be given a `unique_class_name`. **Every single CSS rule** you write **MUST** be prefixed with this class name to prevent styles from leaking.
        -   **Correct:** `.ai-element-12345 button { background-color: {{buttonColor}}; }`
        -   **Incorrect:** `button { background-color: {{buttonColor}}; }`
        -   **Incorrect:** `:root { ... }`

**3.  Interactivity (`script` key):**
    - Provide a JavaScript string that adds event listeners to the HTML.
    - The script will be executed inside a function that receives `container` as an argument.
    - Use `container.querySelector('.your-class')` to find and manipulate elements.
    - **DO NOT** wrap your code in a `<script>` tag. Provide only the raw JavaScript.
    - **IMPORTANT JAVASCRIPT SYNTAX RULE:** If you need to define any helper functions, you **MUST** use **function expressions** (arrow functions are best), not function declarations.
      - **Correct:** `const myFunc = () => { /* logic */ };`
      - **Incorrect:** `function myFunc() { /* logic */ };`

**4.  JSON Sync & Editable Content (MOST IMPORTANT RULE):**
    -   You **MUST** make the component fully editable. Go through the HTML in your `aiTemplate` and find **EVERY** piece of text a user would want to change (all headings, titles, paragraphs, button text, etc.).
    -   **NO user-facing text should be hardcoded in the `aiTemplate`**.
    -   Replace each piece of editable text and style with a unique mustache token (e.g., `{{card1Title}}`, `{{card1Content}}`, `{{buttonColor}}`).
    -   For **every single token** you create, you **MUST** add a corresponding entry in both the `properties` object (with an initial value) and the `editableProps` array (with a key, label, and type). There are no exceptions.

---
**INPUT:** A user's prompt and a `unique_class_name`.
**OUTPUT:** A valid JSON object.

**Example Prompt:** "an accordion with two items"
**Example `unique_class_name`:** `.ai-accordion-12345`
**Example Output:**
{
  "aiTemplate": "<div class=\\"ai-accordion-12345\\"><style>.ai-accordion-12345 .accordion-item { border-bottom: 1px solid {{borderColor}}; }</style><div class=\\"accordion-item\\"><h3 class=\\"accordion-title\\">{{title1}}</h3><div class=\\"accordion-content\\"><p>{{content1}}</p></div></div><div class=\\"accordion-item\\"><h3 class=\\"accordion-title\\">{{title2}}</h3><div class=\\"accordion-content\\"><p>{{content2}}</p></div></div></div>",
  "properties": { "title1": "Question 1", "content1": "Answer 1.", "title2": "Question 2", "content2": "Answer 2.", "borderColor": "#dddddd" },
  "editableProps": [
    { "key": "title1", "label": "Title 1", "type": "text" },
    { "key": "content1", "label": "Content 1", "type": "text" },
    { "key": "title2", "label": "Title 2", "type": "text" },
    { "key": "content2", "label": "Content 2", "type": "text" },
    { "key": "borderColor", "label": "Border Color", "type": "color" }
  ],
  "script": "const titles = container.querySelectorAll('.accordion-title'); titles.forEach(title => { title.addEventListener('click', () => { const content = title.nextElementSibling; if (content.style.maxHeight) { content.style.maxHeight = null; } else { content.style.maxHeight = content.scrollHeight + 'px'; } }); });"
}

""".strip()

ELEMENT_GENERATOR_PROMPT_FROM_GPT5 = """
You are an expert front-end developer creating a single, self-contained, and interactive HTML element.

Your output MUST be a valid JSON object with FOUR keys: "aiTemplate", "properties", "editableProps", and "script".

---
### **CRITICAL RULES FOR YOUR OUTPUT**

**1.  HTML Structure:**
    - The HTML must be wrapped in a single container `<div>`.
    - This container will have the unique class name you are given applied to it.

**2.  Styling:**
    - All CSS must be in a single `<style>` tag.
    - Use mustache tokens `{{...}}` for all editable style values.
    - **You MUST expose editables for the following visual controls (when relevant to the element):**
        - **Colors:** global/background color, text color, link color, hover/active/focus color accents, border color.
        - **Borders:** border width, border style, border radius (outer), and (if applicable) inner section radii.
        - **Spacing:** padding and/or gap for containers and key sections (titles/headers vs content/body).
        - **Typography:** font size(s) for titles and content, font weight(s), line-height, text alignment.
        - **Effects & Motion:** box-shadow (at least one), transition speed/easing used by hover/focus/expand effects.
    - If the element has **distinct sections** (e.g., title/header vs. content/body), provide **separate tokens** for their backgrounds and text colors and, where useful, their padding and radii (e.g., `titleBgColor`, `titleTextColor`, `contentBgColor`, `contentTextColor`, `titlePadding`, `contentPadding`, `titleRadius`, `contentRadius`).
    - **CRITICAL SCOPING SUB-RULE:** You will be given a `unique_class_name`. **Every single CSS rule** you write **MUST** be prefixed with this class name to prevent styles from leaking.
        - **Correct:** `.ai-element-12345 button { background-color: {{buttonColor}}; }`
        - **Incorrect:** `button { background-color: {{buttonColor}}; }`
        - **Incorrect:** `:root { ... }`
    - CSS must be concise and scoped, but visually polished by default.

**3.  Interactivity (`script` key):**
    - Provide a JavaScript string that adds event listeners to the HTML.
    - The script will be executed inside a function that receives `container` as an argument.
    - Use `container.querySelector('.your-class')` to find and manipulate elements.
    - **DO NOT** wrap your code in a `<script>` tag. Provide only the raw JavaScript.
    - **IMPORTANT JAVASCRIPT SYNTAX RULE:** If you need to define any helper functions, you **MUST** use **function expressions** (arrow functions are best), not function declarations.
      - **Correct:** `const myFunc = () => { /* logic */ };`
      - **Incorrect:** `function myFunc() { /* logic */ };`

**4.  JSON Sync & Editable Content (MOST IMPORTANT RULE):**
    - You **MUST** make the component fully editable. Go through the HTML in your `aiTemplate` and find **EVERY** piece of text a user would want to change (all headings, titles, paragraphs, button text, etc.).
    - **NO user-facing text should be hardcoded in the `aiTemplate`**.
    - Replace each piece of editable text and style with a unique mustache token (e.g., `{{card1Title}}`, `{{card1Content}}`, `{{buttonColor}}`).
    - For **every single token** you create, you **MUST** add a corresponding entry in both the `properties` object (with an initial value) and the `editableProps` array (with a key, label, and type). There are no exceptions.

---
**INPUT:** A user's prompt and a `unique_class_name`.
**OUTPUT:** A valid JSON object.

**Example Prompt:** "an accordion with two items"
**Example `unique_class_name`:** `.ai-accordion-12345`
**Example Output:**
{
  "aiTemplate": "<div class=\\"ai-accordion-12345\\"><style>.ai-accordion-12345{background:{{bgColor}};color:{{textColor}}}.ai-accordion-12345 .accordion-item{border-bottom:1px solid {{borderColor}};padding:{{itemPadding}}}.ai-accordion-12345 .accordion-title{background:{{titleBgColor}};color:{{titleTextColor}};padding:{{titlePadding}};border-radius:{{titleRadius}};font-size:{{titleFontSize}};font-weight:{{titleFontWeight}};text-align:{{titleAlign}};transition:{{transitionSpeed}}}.ai-accordion-12345 .accordion-content{background:{{contentBgColor}};color:{{contentTextColor}};padding:{{contentPadding}};border-radius:{{contentRadius}};font-size:{{contentFontSize}};line-height:{{contentLineHeight}};box-shadow:{{boxShadow}};transition:{{transitionSpeed}}}</style><div class=\\"accordion-item\\"><h3 class=\\"accordion-title\\">{{title1}}</h3><div class=\\"accordion-content\\"><p>{{content1}}</p></div></div><div class=\\"accordion-item\\"><h3 class=\\"accordion-title\\">{{title2}}</h3><div class=\\"accordion-content\\"><p>{{content2}}</p></div></div></div>",
  "properties": {
    "title1":"Question 1","content1":"Answer 1.","title2":"Question 2","content2":"Answer 2.",
    "bgColor":"#ffffff","textColor":"#111111","borderColor":"#e2e8f0",
    "itemPadding":"12px",
    "titleBgColor":"#f7f7f9","titleTextColor":"#0f172a","titlePadding":"12px 14px","titleRadius":"8px","titleFontSize":"16px","titleFontWeight":"600","titleAlign":"left",
    "contentBgColor":"#ffffff","contentTextColor":"#334155","contentPadding":"12px 14px","contentRadius":"8px","contentFontSize":"14px","contentLineHeight":"1.6",
    "boxShadow":"0 4px 14px rgba(0,0,0,0.08)","transitionSpeed":"all 200ms ease"
  },
  "editableProps": [
    { "key":"title1","label":"Title 1","type":"text" },
    { "key":"content1","label":"Content 1","type":"text" },
    { "key":"title2","label":"Title 2","type":"text" },
    { "key":"content2","label":"Content 2","type":"text" },

    { "key":"bgColor","label":"Global Background","type":"color" },
    { "key":"textColor","label":"Global Text Color","type":"color" },
    { "key":"borderColor","label":"Border Color","type":"color" },

    { "key":"itemPadding","label":"Item Padding","type":"text" },

    { "key":"titleBgColor","label":"Title Background","type":"color" },
    { "key":"titleTextColor","label":"Title Text Color","type":"color" },
    { "key":"titlePadding","label":"Title Padding","type":"text" },
    { "key":"titleRadius","label":"Title Border Radius","type":"text" },
    { "key":"titleFontSize","label":"Title Font Size","type":"text" },
    { "key":"titleFontWeight","label":"Title Font Weight","type":"text" },
    { "key":"titleAlign","label":"Title Text Align","type":"text" },

    { "key":"contentBgColor","label":"Content Background","type":"color" },
    { "key":"contentTextColor","label":"Content Text Color","type":"color" },
    { "key":"contentPadding","label":"Content Padding","type":"text" },
    { "key":"contentRadius","label":"Content Border Radius","type":"text" },
    { "key":"contentFontSize","label":"Content Font Size","type":"text" },
    { "key":"contentLineHeight","label":"Content Line Height","type":"text" },

    { "key":"boxShadow","label":"Box Shadow","type":"text" },
    { "key":"transitionSpeed","label":"Transition Speed","type":"text" }
  ],
  "script": "const titles = container.querySelectorAll('.accordion-title'); titles.forEach(title => { title.addEventListener('click', () => { const content = title.nextElementSibling; if (content.style.maxHeight) { content.style.maxHeight = null; } else { content.style.maxHeight = content.scrollHeight + 'px'; } }); });"
}

""".strip()
NEW_ELEMENT_GENERATOR_PROMPT_FROM_GPT5 = """
You are an expert front-end developer creating a single, self-contained, and interactive HTML element.

Your output MUST be a valid JSON object with FOUR keys: "aiTemplate", "properties", "editableProps", and "script".

---
### **CRITICAL RULES FOR YOUR OUTPUT**

**1.  HTML Structure:**
    - The HTML must be wrapped in a single container `<div>`.
    - This container will have the unique class name you are given applied to it.

**2.  Styling:**
    - All CSS must be in a single `<style>` tag.
    - Use mustache tokens `{{...}}` for all editable style values.
    - **You MUST expose editables for ALL visual controls** (colors, borders, spacing, typography, effects, motion) for every element you create — whether it is a UI component, a game, an animation, or any other type of element.
    - If the element has distinct sections (e.g., title/header vs. content/body), provide **separate tokens** for their backgrounds, text colors, paddings, and radii.
    - **CRITICAL SCOPING RULE:** Every single CSS rule you write MUST be prefixed with the given unique class name to prevent styles from leaking.
    - CSS must be concise, scoped, and visually polished.

**3.  Interactivity (`script` key):**
    - Provide a JavaScript string that adds event listeners and logic for all interactions.
    - The script will be executed inside a function that receives `container` as an argument.
    - Use `container.querySelector(...)` or `container.querySelectorAll(...)` for selections.
    - **DO NOT** wrap code in `<script>` tags — only provide raw JavaScript.
    - Use arrow functions or function expressions, NOT function declarations.

**4.  Editable Content & Properties:**
    - **EVERY user-facing text or style value must use a mustache token** (e.g., `{{buttonText}}`, `{{bgColor}}`).
    - For every token, you MUST:
        1. Provide a default value in `properties`.
        2. Add an entry in `editableProps` with key, label, and type.
    - This applies to ALL elements, including games, animations, and UI widgets.

**5.  SPECIAL RULES FOR GAMES OR COMPLEX INTERACTIVE ELEMENTS:**
    - If the prompt requests a game or other interactive experience, create a **fully functional, playable, and self-contained** version.
    - Implement all required mechanics in JavaScript — no placeholders or incomplete logic.
    - Include clear visual feedback for user actions (e.g., collisions, score updates, win/loss states).
    - Expose gameplay-related parameters as editable tokens (speed, difficulty, object size, spawn rate, lives, etc.) in addition to normal style editables.
    - All visuals and gameplay logic must be scoped to the container class.

---
**INPUT:** A user's prompt and a `unique_class_name`.
**OUTPUT:** A valid JSON object as described.
""".strip()


#region test section prompt
TEST_SECTION_SYSTEM_PROMPT = """
You are an expert layout and style designer creating a complete website section.
Your task is to generate a single valid JSON object based on a user's prompt.

Your output MUST be a valid JSON object containing TWO top-level keys: "properties" and "subsections".

**CRITICAL RULES FOR YOUR OUTPUT:**
1.  **`properties` Key:** This object is for the PARENT SECTION.
    - It MUST contain layout properties like `display`, `flexDirection`, `justifyContent`, and `gap`.
    - It MUST also contain a nested `style` object for all visual styles like `backgroundColor`, `padding`, and `backgroundImage` for gradients.
2.  **`subsections` Key:** This must be an array of subsection objects, each with their own `properties` and `elements`.
3.  **Content:** Fill all elements with relevant placeholder content.

**Example Prompt:** "A dark hero section with a centered title."
**Example Output:**
{
  "properties": {
    "display": "flex",
    "flexDirection": "column",
    "alignItems": "center",
    "justifyContent": "center",
    "gap": "1.5rem",
    "style": {
      "backgroundColor": "#111827",
      "padding": "6rem 2rem"
    }
  },
  "subsections": [
    {
      "properties": { "style": { "textAlign": "center" } },
      "elements": [
        {
          "element_type": "TEXT",
          "properties": { "content": "Welcome to Our Website", "style": { "fontSize": "3rem", "color": "#FFFFFF" } },
          "aiPayload": null
        }
      ]
    }
  ]
}
""".strip()

#endregion

#region generateelement
class GenerateRequest(BaseModel):
    prompt: str
    website_id: UUID | str
#

class GenerateRequestForElement(BaseModel):
    prompt: str
    unique_class_name: str
    website_id: UUID | str

@router.post("/generate-ai-element")
async def generate_ai_element(
    body: GenerateRequestForElement,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    try:
        # Guard: validate website_id exists
        if not body.website_id:
            raise HTTPException(400, "website_id is required")

        user_content = (
            f'PROMPT: "{body.prompt}"\n\n'
            f'UNIQUE_CLASS_NAME: `.{body.unique_class_name}`'
        )

        resp = openai.chat.completions.create(
            model=AI_DEFAULT_MODEL,                  # e.g. "gpt-4o"
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": ELEMENT_GENERATOR_PROMPT_FROM_GPT5},
                {"role": "user",   "content": user_content},
            ],
            temperature=0.2,
            max_tokens=4096,
        )

        # v1 SDK: usage is an object; model is on resp.model
        usage = getattr(resp, "usage", None)
        prompt_tokens = int(getattr(usage, "prompt_tokens", 0) or 0)
        completion_tokens = int(getattr(usage, "completion_tokens", 0) or 0)
        model_used = getattr(resp, "model", AI_DEFAULT_MODEL)

        content = resp.choices[0].message.content
        payload = json.loads(content)

        # strip <script> wrapper if present
        if isinstance(payload.get("script"), str):
            m = re.search(r"<script.*?>([\s\S]*?)</script>", payload["script"])
            if m:
                payload["script"] = m.group(1).strip()

        # Track usage (expects UUID + int user_id)
        await track_ai_usage(
            db=db,
            website_id=body.website_id,             # keep as UUID
            user_id=user.id,                         # your users.id is INTEGER
            model=model_used,
            feature="generate_element",
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            meta={"unique_class_name": body.unique_class_name},
        )

        return payload

    except HTTPException:
        raise
    except Exception as e:
        # print full traceback to your server console so you see the real error
        import traceback; traceback.print_exc()
        raise HTTPException(500, f"generate-ai-element failed: {e}")

#region gpt5 
# client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"), timeout=60)  # set timeout on the client
# MODEL = "gpt-5-nano"
# def _strip_script_wrapper(payload: dict) -> dict:
#     """If payload['script'] contains a <script>...</script> wrapper, remove it and keep only the inner JS."""
#     if "script" in payload and isinstance(payload.get("script"), str):
#         match = re.search(r"<script.*?>([\s\S]*?)</script>", payload["script"])
#         if match:
#             payload["script"] = match.group(1).strip()
#     return payload

# def _extract_json_loose(s: str) -> dict:
#     """
#     Fallback extractor when the model returns plain text:
#     - strips ```json fences
#     - pulls the LAST {...} block
#     - json.loads it
#     """
#     s = (s or "").strip()
#     if not s:
#         raise ValueError("Model returned empty text.")
#     if s.startswith("```"):
#         s = re.sub(r"^```(?:json)?\s*", "", s)
#         s = re.sub(r"\s*```$", "", s)
#     if not s.lstrip().startswith("{"):
#         m = re.search(r"\{[\s\S]*\}\s*$", s)
#         if not m:
#             raise ValueError("No JSON object found in model output.")
#         s = m.group(0)
#     return json.loads(s)

# def _assemble_text(resp) -> str:
#     """Prefer assembling from parts, then fall back to resp.output_text."""
#     parts = []
#     for item in (getattr(resp, "output", None) or []):
#         for c in (getattr(item, "content", None) or []):
#             if getattr(c, "type", "") == "output_text":
#                 t = getattr(c, "text", "") or ""
#                 if t.strip():
#                     parts.append(t)
#     text = ("".join(parts) or (getattr(resp, "output_text", None) or "")).strip()
#     return text

# @router.post("/generate-ai-element")
# async def generate_ai_element(body: GenerateRequestForElement):
#     try:
#         user_content = (
#             f'PROMPT: "{body.prompt}"\n\n'
#             f'UNIQUE_CLASS_NAME: .{body.unique_class_name}'
#         )

#         # GPT-5 reasoning-style call: no temperature, no max tokens
#         resp = client.responses.create(
#             model=MODEL,
#             instructions=ELEMENT_GENERATOR_PROMPT_FROM_GPT5 +
#                 "\n\nReturn ONLY a single valid JSON object. No explanations or markdown.",
#             input=user_content,
#             max_output_tokens=16000
            
#         )

#         text = _assemble_text(resp)
#         if not text:
#             # Dump once for debugging, then bail with a clear error
#             try:
#                 print("[GPT5 RAW RESPONSE]", resp.model_dump_json(indent=2)[:8000], flush=True)
#             except Exception:
#                 print("[GPT5 RAW RESPONSE - no dump]", str(resp)[:1000], flush=True)
#             raise ValueError("Empty response text from model.")

#         payload = _extract_json_loose(text)
#         payload = _strip_script_wrapper(payload)
#         return payload

#     except Exception as e:
#         import traceback
#         traceback.print_exc()
#         raise HTTPException(status_code=500, detail=f"Page generation failed: {e}")
      
#endregion gpt5
  #region refining element

# class RefineRequest(BaseModel):
#     prompt: str
#     full_template: str         # may contain <style>…</style>, HTML, <script>…</script>
#     unique_class_name: str


# REFINE_SYSTEM_PROMPT = """
# You are a combined HTML, CSS, and JavaScript editor.
# You will receive:
#   • A **user prompt** describing exactly what they want (structure, style, or behavior).
#   • The **full existing template**, which may include:
#     - A `<style>` block
#     - The HTML markup
#     - `<script>` tags with JavaScript interactivity

# Your job is to return a single, complete updated snippet that:
# 1. Implements everything the user asked (e.g. “hide all answers by default and make each question expandable”).
# 2. Preserves unrelated parts of the original (don’t break other buttons, don’t drop other scripts).
# 3. Modifies or adds **both** CSS and JS as needed.
# 4. Returns the full `<style>…</style>`, the updated HTML, and any `<script>…</script>`.

# **Return ONLY the updated snippet**, no Markdown fences or explanations.
# """.strip()


# @router.post("/refine-element")
# async def refine_element(body: RefineRequest):
#     try:
#         user_content = (
#             f"PROMPT: \"{body.prompt}\"\n\n"
#             f"EXISTING_TEMPLATE:\n```html\n{body.full_template}\n```\n\n"
#             f"UNIQUE_CLASS_NAME: `{body.unique_class_name}`"
#         )
#         resp = openai.chat.completions.create(
#             model="gpt-4o",
#             messages=[
#                 {"role": "system",  "content": REFINE_SYSTEM_PROMPT},
#                 {"role": "user",    "content": user_content},
#             ],
#             temperature=0.25
#         )
#         raw = resp.choices[0].message.content.strip()
#         clean = re.sub(r"^```[^\n]*\n", "", raw)    
#         clean = re.sub(r"\n```$", "", clean)    
#     except (OpenAIError, json.JSONDecodeError) as e:
#         raise HTTPException(500, f"Refine-element failed: {e}")

#     return {"template": clean}
# second approach 
# class RefineRequest(BaseModel):
#     prompt: str
#     full_template: str
#     unique_class_name: str

# class RefineResponse(BaseModel):
#     template: str
#     script: Optional[str]

# REFINE_SYSTEM_PROMPT = """
# You are a combined HTML, CSS, and JavaScript editor.
# You will receive:
#   • A user prompt describing exactly what they want.
#   • The full existing template, which may include:
#     - A <style> block
#     - HTML markup
#     - <script> tags
#   • A unique class name for scoping.

# Return ONLY the updated snippet—any <style>…</style>, HTML, and <script>…</script>.
# """.strip()

# @router.post("/refine-element", response_model=RefineResponse)
# async def refine_element(body: RefineRequest):
#     try:
#         # assemble the user prompt
#         user_content = (
#             f"PROMPT: \"{body.prompt}\"\n\n"
#             f"EXISTING_TEMPLATE:\n```html\n{body.full_template}\n```\n\n"
#             f"UNIQUE_CLASS_NAME: `{body.unique_class_name}`"
#         )

#         # call OpenAI
#         resp = openai.chat.completions.create(
#             model="gpt-4o",
#             messages=[
#                 {"role": "system", "content": REFINE_SYSTEM_PROMPT},
#                 {"role": "user",   "content": user_content},
#             ],
#             temperature=0.2,
#         )
#         raw = resp.choices[0].message.content

#         # 1) strip any ```html fences
#         cleaned = re.sub(r"^```(?:html)?\s*\n?", "", raw)
#         cleaned = re.sub(r"\n?```$", "", cleaned)

#         # 2) extract <script> blocks
#         script_re   = r"<script[\s\S]*?</script>"
#         scripts     = re.findall(script_re, cleaned)
#         template_only = re.sub(script_re, "", cleaned).strip()
#         script_only   = "\n".join(scripts) if scripts else None

#     except (OpenAIError, re.error) as e:
#         raise HTTPException(500, f"Refine-element failed: {e}")

#     return RefineResponse(template=template_only, script=script_only)

# third approach
# class RefineRequest(BaseModel):
#     prompt: str
#     full_template: str
#     unique_class_name: str
#     properties: Dict[str, Any] = Field(default_factory=dict)
#     editableProps: List[Dict[str, Any]] = Field(default_factory=list)

# class RefineResponse(BaseModel):
#     template: str          # HTML + <style> only
#     script: Optional[str]  # JS only
#     properties: Dict[str, Any]
#     editableProps: List[Dict[str, Any]]

# REFINE_SYSTEM_PROMPT = """
# You are a combined HTML, CSS, and JavaScript editor.
# You will receive:
#   • A user prompt describing exactly what they want.
#   • The full existing template (HTML + <style> + possibly <script> tags).
#   • A unique class name for scoping.

# Return ONLY the updated snippet—any <style>…</style>, HTML—and return any
# <script>…</script> blocks separately. Do not wrap your answer in Markdown.
# """.strip()

# @router.post("/refine-element", response_model=RefineResponse)
# async def refine_element(body: RefineRequest):
#     try:
#         # 1) Build the Chat prompt
#         user_content = (
#             f'PROMPT: "{body.prompt}"\n\n'
#             f"EXISTING_TEMPLATE:\n```html\n{body.full_template}\n```\n\n"
#             f"UNIQUE_CLASS_NAME: `{body.unique_class_name}`"
#         )

#         # 2) Call the LLM
#         resp = openai.chat.completions.create(
#             model="gpt-4o-mini",  # or "gpt-4o"
#             messages=[
#                 {"role": "system",  "content": REFINE_SYSTEM_PROMPT},
#                 {"role": "user",    "content": user_content},
#             ],
#             temperature=0.2,
#         )
#         raw = resp.choices[0].message.content

#         # 3) Strip any triple-backtick fences
#         cleaned = re.sub(r"^```(?:html)?\s*\n?", "", raw)
#         cleaned = re.sub(r"\n?```$", "", cleaned)

#         # 4) Pull out script content and remove the tags from the template
#         # Regex to find the full script blocks
#         full_script_re = r"<script[\s\S]*?</script>"
        
#         # Regex to capture only the content *inside* the script tags
#         script_content_re = r"<script.*?>([\s\S]*?)</script>"

#         # Find and join only the JS content from the capturing group
#         script_contents = re.findall(script_content_re, cleaned)
#         script_only = "\n".join(c.strip() for c in script_contents).strip() or None

#         # Remove the full script blocks to create the template
#         template_only = re.sub(full_script_re, "", cleaned).strip()

#     except (OpenAIError, re.error) as e:
#         raise HTTPException(500, f"Refine-element failed: {e}")

#     # 5) Echo back properties/editableProps unchanged
#     return RefineResponse(
#         template=template_only,
#         script=script_only,
#         properties=body.properties,
#         editableProps=body.editableProps,
#     )

# forth approach

# class RefineRequest(BaseModel):
#     prompt: str
#     full_template: str
#     unique_class_name: str
#     properties: Dict[str, Any] = Field(default_factory=dict)
#     editableProps: List[Dict[str, Any]] = Field(default_factory=list)

# class RefineResponse(BaseModel):
#     template: str          # HTML + <style> only
#     script: Optional[str]  # JS only
#     properties: Dict[str, Any]
#     editableProps: List[Dict[str, Any]]

# REFINE_SYSTEM_PROMPT = """
# You are a combined HTML, CSS, and JavaScript editor.
# You will receive:
#   • A user prompt describing exactly what they want.
#   • The full existing template (HTML + <style> + possibly <script> tags).
#   • A unique class name for scoping.

# Return ONLY the updated snippet—any <style>…</style>, HTML—and return any
# <script>…</script> blocks separately. Do not wrap your answer in Markdown.
# """.strip()

# @router.post("/refine-element", response_model=RefineResponse)
# async def refine_element(body: RefineRequest):
#     try:
#         # 1) Build the Chat prompt
#         user_content = (
#             f'PROMPT: "{body.prompt}"\n\n'
#             f"EXISTING_TEMPLATE:\n```html\n{body.full_template}\n```\n\n"
#             f"UNIQUE_CLASS_NAME: `{body.unique_class_name}`"
#         )

#         # 2) Call the LLM
#         resp = openai.chat.completions.create(
#             model="gpt-4o-mini",  # or "gpt-4o"
#             messages=[
#                 {"role": "system",  "content": REFINE_SYSTEM_PROMPT},
#                 {"role": "user",    "content": user_content},
#             ],
#             temperature=0.2,
#         )
#         raw = resp.choices[0].message.content

#         # 3) Strip any triple-backtick fences
#         cleaned = re.sub(r"^```(?:html)?\s*\n?", "", raw)
#         cleaned = re.sub(r"\n?```$", "", cleaned)

#         # 4) Pull out script content and remove tags from the template
#         # Regex to find the full script blocks for removal
#         full_script_re = r"<script[\s\S]*?</script>"
        
#         # Regex to capture only the content *inside* the script tags
#         script_content_re = r"<script.*?>([\s\S]*?)</script>"

#         # Find and join only the JS content from the capturing group
#         script_contents = re.findall(script_content_re, cleaned)
#         script_only = "\n".join(c.strip() for c in script_contents).strip() or None

#         # Remove the full script blocks to create the template
#         template_only = re.sub(full_script_re, "", cleaned).strip()

#     except (OpenAIError, re.error) as e:
#         raise HTTPException(500, f"Refine-element failed: {e}")

#     # 5) Echo back properties/editableProps unchanged
#     return RefineResponse(
#         template=template_only,
#         script=script_only,
#         properties=body.properties,
#         editableProps=body.editableProps,
#     )

# fifth approach
# class RefineRequest(BaseModel):
#     prompt: str
#     full_template: str
#     unique_class_name: str
#     properties: Dict[str, Any] = Field(default_factory=dict)
#     editableProps: List[Dict[str, Any]] = Field(default_factory=list)

# class RefineResponse(BaseModel):
#     template: str          # HTML + <style> only
#     script: Optional[str]  # JS only
#     properties: Dict[str, Any]
#     editableProps: List[Dict[str, Any]]


# REFINE_SYSTEM_PROMPT = """
# You are an expert HTML, CSS, and JavaScript editor. Your task is to modify an existing HTML snippet based on a user's request.

# Return ONLY the updated snippet. The HTML, <style>, and <script> should all be in a single block.

# **CRITICAL RULES:**

# 1.  **HTML Restructuring for Animations**: To animate individual letters or words, you **MUST** first restructure the HTML by wrapping each character in its own `<span>` tag.
#     * **Example:** `<h3>Hello</h3>` MUST become `<h3><span class="char">H</span><span class="char">e</span><span class="char">l</span><span class="char">l</span><span class="char">o</span></h3>`.

# 2.  **Write Corresponding CSS**: You **MUST** write the necessary CSS, including `@keyframes` and staggered `animation-delay`, to animate the new `<span>` elements.

# 3.  **Keep Everything In Sync**: The HTML structure, CSS animations, and any necessary JavaScript **MUST** work together perfectly.

# 4.  **Preserve Existing Mustache Tokens**: Do not remove `{{...}}` tokens from the template if the user is only asking to change a color or font size that is already a variable.

# 5.  **Editing Text Inside a Variable (NEW RULE)**: If a user asks to add formatting to text that is currently a `{{variable}}` (e.g., making a word bold), you **MUST** replace the variable with the new, static rich text. This "bakes" the text into the template.
#     * **Example Template Contains:** `<h2>{{pageTitle}}</h2>`
#     * **User Asks:** "make the word Title bold in 'My Title'"
#     * **Your Response Should Contain:** `<h2>My <b>Title</b></h2>` (The `{{pageTitle}}` token is replaced).

# You will receive a user prompt, the existing template, and a unique class name for scoping your CSS rules.
# """.strip()

# @router.post("/refine-element", response_model=RefineResponse)
# async def refine_element(body: RefineRequest):
#     try:
#         # 1) Build the Chat prompt
#         user_content = (
#             f'PROMPT: "{body.prompt}"\n\n'
#             f"EXISTING_TEMPLATE:\n```html\n{body.full_template}\n```\n\n"
#             f"UNIQUE_CLASS_NAME: `{body.unique_class_name}`"
#         )

#         # 2) Call the LLM
#         resp = openai.chat.completions.create(
#             model="gpt-4o",  # Using a more powerful model is recommended for complex tasks
#             messages=[
#                 {"role": "system",  "content": REFINE_SYSTEM_PROMPT},
#                 {"role": "user",    "content": user_content},
#             ],
#             temperature=0.2,
#         )
#         raw = resp.choices[0].message.content

#         # 3) Strip any triple-backtick fences
#         cleaned = re.sub(r"^```(?:html)?\s*\n?", "", raw)
#         cleaned = re.sub(r"\n?```$", "", cleaned)

#         # 4) Pull out script content and remove tags from the template
#         full_script_re = r"<script[\s\S]*?</script>"
#         script_content_re = r"<script.*?>([\s\S]*?)</script>"

#         script_contents = re.findall(script_content_re, cleaned)
#         script_only = "\n".join(c.strip() for c in script_contents).strip() or None

#         template_only = re.sub(full_script_re, "", cleaned).strip()

#     except (OpenAIError, re.error) as e:
#         raise HTTPException(500, f"Refine-element failed: {e}")

#     # 5) Echo back properties/editableProps unchanged
#     return RefineResponse(
#         template=template_only,
#         script=script_only,
#         properties=body.properties,
#         editableProps=body.editableProps,
#     )

#sixth approach

class RefineStateRequest(BaseModel):
    prompt: str
    currentState: Dict[str, Any]
    website_id: UUID | str

REFINE_MASTER_PROMPT = """
You are an expert front-end component editor. Your job is to modify and repair a component's state based on a user's request.
You will receive the user's prompt and a JSON object containing the component's current state.

Your output MUST be a single, complete, valid JSON object with the fully updated state.

**CRITICAL RULES:**

1.  **Repair Hardcoded Text (IMPORTANT)**: If you receive a component where the `aiTemplate` contains user-facing text, but the `properties` and `editableProps` for that text are missing, you **MUST** fix it. Extract the hardcoded text, replace it with a `{{mustache}}` variable in the `aiTemplate`, and add the corresponding entries to `properties` and `editableProps`.

    * **Example of a BROKEN input you must fix:**
    * `aiTemplate`: "<h3>Welcome to Beirut!</h3>"
    * `properties`: {}
    * `editableProps`: []
    * **Your FIXED output should be:**
    * `aiTemplate`: "<h3>{{headline}}</h3>"
    * `properties`: { "headline": "Welcome to Beirut!" }
    * `editableProps`: [{ "key": "headline", "label": "Headline", "type": "text" }]

2.  **Preserve Existing Data**: If the `editableProps` array is NOT empty, your highest priority is to preserve it. Do not add or remove props unless the user asks. When changing a color or font, modify the value in the `properties` object, NOT by hardcoding it.

3.  **Apply User's Prompt**: After repairing the component (if necessary), apply the user's requested change to the now-correct component state.

4.  **Final Output**: Return the complete, updated JSON object.
5.  **Special Rule for Forms : If the component is a form, pay special attention to the `properties.fields` array which defines its structure. **Do not add, remove, or alter the items in this array** unless the user's prompt is explicitly about adding, removing, or changing a specific form field. Focus style changes on the `properties.style` or `properties.submitButton.style` objects.
""".strip()




@router.post("/refine-element", response_model=Dict[str, Any])
async def refine_element(
    body: RefineStateRequest,                     # has: prompt, currentState, website_id
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    try:
        # Guard: need website_id to log usage against a real website
        if not body.website_id:
            raise HTTPException(status_code=400, detail="website_id is required")

        user_content = (
            f'USER_PROMPT: "{body.prompt}"\n\n'
            f"CURRENT_COMPONENT_STATE:\n```json\n{json.dumps(body.currentState, indent=2)}\n```"
        )

        resp = openai.chat.completions.create(
            model=AI_DEFAULT_MODEL,                # same model you use elsewhere
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": REFINE_MASTER_PROMPT},
                {"role": "user",   "content": user_content},
            ],
            temperature=0.2,
        )

        # Extract usage & model just like in generate-ai-element
        usage = getattr(resp, "usage", None)
        prompt_tokens = int(getattr(usage, "prompt_tokens", 0) or 0)
        completion_tokens = int(getattr(usage, "completion_tokens", 0) or 0)
        model_used = getattr(resp, "model", AI_DEFAULT_MODEL)

        # Parse JSON content
        payload = json.loads(resp.choices[0].message.content)

        # Optional: normalize/clean any script field, like you do elsewhere
        if isinstance(payload.get("script"), str):
            m = re.search(r"<script.*?>([\s\S]*?)</script>", payload["script"])
            if m:
                payload["script"] = m.group(1).strip()

        # Track usage (UUID website_id + INTEGER user.id)
        await track_ai_usage(
            db=db,
            website_id=body.website_id,
            user_id=user.id,
            model=model_used,
            feature="refine_element",
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            meta={"state_keys": list((body.currentState or {}).keys())[:10]},
        )

        return payload

    except HTTPException:
        raise
    except (json.JSONDecodeError, KeyError) as e:
        raise HTTPException(status_code=500, detail=f"refine-element failed to parse model output: {e}")
    except Exception as e:
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"refine-element failed: {e}")


  #endregion
  
  
  #region refinesection
  
  # --- START: REFINE SECTION FEATURE ---

# 1. Pydantic model for the request
class RefineSectionRequest(BaseModel):
    prompt: str
    section_json: Dict[str, Any]
    website_id: UUID | str

# 2. System prompt for the AI
REFINE_SECTION_SYSTEM_PROMPT = """
You are an AI assistant that modifies a complete JSON object for a website section.
Your single most important rule is to **start with the user's provided JSON and return the complete, modified version of it.**

**CRITICAL RULES:**
1.  You will be given the `CURRENT SECTION JSON`. Use it as your starting point.
2.  **DO NOT DELETE ANY DATA** unless the user explicitly asks you to. Preserve all existing keys like `section_id`, `subsections`, `elements`, and their properties.
3.  Apply the user's requested change. For visual styles of the main section, modify the `properties.style` object. For subsections, modify their respective `style` objects.
4.  Your final output **MUST BE THE ENTIRE, COMPLETE, MODIFIED JSON OBJECT** for the section. Do not return partial data.
""".strip()

# 3. The API endpoint function
@router.post("/refine-ai-section")
async def refine_ai_section(
    body: RefineSectionRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    try:
        if not body.website_id:
            raise HTTPException(status_code=400, detail="website_id is required")

        user_content = (
            f'PROMPT: "{body.prompt}"\n\n'
            f"CURRENT SECTION JSON:\n{json.dumps(body.section_json, indent=2)}"
        )

        resp = openai.chat.completions.create(
            model=AI_DEFAULT_MODEL,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": REFINE_SECTION_SYSTEM_PROMPT},
                {"role": "user",   "content": user_content},
            ],
            temperature=0.5,
            max_tokens=4096,
        )

        # ---- parse model output
        payload = json.loads(resp.choices[0].message.content)

        # ---- usage tracking (OBJECT, not dict)
        usage = getattr(resp, "usage", None)
        prompt_tokens     = int(getattr(usage, "prompt_tokens", 0) or 0)
        completion_tokens = int(getattr(usage, "completion_tokens", 0) or 0)
        model_used        = getattr(resp, "model", AI_DEFAULT_MODEL)

        await track_ai_usage(
            db=db,
            website_id=body.website_id,
            user_id=user.id,
            model=model_used,
            feature="refine_section",
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            meta={"section_keys": list((body.section_json or {}).keys())[:10]},
        )

        return payload

    except (json.JSONDecodeError,) as e:
        raise HTTPException(status_code=500, detail=f"refine-ai-section JSON parse failed: {e}")
    except HTTPException:
        raise
    except Exception as e:
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"refine-ai-section failed: {e}")

# --- END: REFINE SECTION FEATURE ---


#region pagegenerator
# --- START: NEW PAGE GENERATION FEATURE ---

PAGE_SYSTEM_PROMPT = """
You are an expert website designer. Your task is to generate the JSON for a complete webpage layout based on a user's prompt.

You must return a JSON object with a single top-level key: "sections".
The value of "sections" must be an array of section objects.

**CRITICAL RULES:**
1.  **Think Logically:** Structure the page logically. For an "About Us" page, you might generate a hero section, a mission statement section, a team members section, and a contact footer.
2.  **Use Correct Section JSON Structure:** Each object in the "sections" array MUST be a complete section. A section has two top-level keys: `"properties"` and `"subsections"`.
    -   The **`properties`** object is for the parent section. It MUST contain layout properties like `display`, `flexDirection`, `justifyContent`, and a nested **`style`** object for all visual styles like `backgroundColor`, `padding`, and `backgroundImage`.
    -   The **`subsections`** key must be an array of subsection objects, which contain their own `properties` and `elements`.
    CRITICAL STYLE RULE: Inside any "style" object, all CSS property keys MUST be in camelCase format (e.g., backgroundColor, borderRadius, WebkitBackgroundClip).
    **Here is an example of a single, valid section object:**
    ```json
    {
      "properties": {
        "display": "flex",
        "flexDirection": "column",
        "alignItems": "center",
        "justifyContent": "center",
        "gap": "1.5rem",
        "style": {
          "backgroundColor": "#111827",
          "padding": "6rem 2rem"
        }
      },
      "subsections": [
        {
          "properties": { "style": { "textAlign": "center" } },
          "elements": [
            {
              "element_type": "TEXT",
              "properties": { "content": "Welcome to Our Website", "style": { "fontSize": "3rem", "color": "#FFFFFF" } },
              "aiPayload": null
            }
          ]
        }
      ]
    }
    ```
3.  **Vary the Designs:** Make each section in the array visually distinct and appropriate for its purpose.
4.  **Return a Full Array:** The "sections" key must contain an array of 2 to 4 complete section objects.

**INPUT:** A user's prompt (e.g., "A contact page for a modern tech company").

**OUTPUT:** A valid JSON object containing only the "sections" array.
""".strip()
# PAGE_SYSTEM_PROMPT = """
# You are an expert website designer. Your task is to generate the JSON for a complete webpage layout based on a user's prompt. You will be given a list of standard components and a special, powerful "AI" component.

# You MUST return a JSON object with a single top-level key: "sections".

# ---
# ### **CORE JSON STRUCTURE RULES**

# 1.  **Structure:** The JSON must follow the `sections` -> `subsections` -> `elements` hierarchy.
# 2.  **Styling:** All CSS styles MUST be in a nested `"style"` object, and all CSS property keys MUST be in camelCase format (e.g., `backgroundColor`).
# 3.  **Component Choice:** You should **prefer to use the standard element types** listed below for simple content like text, buttons, and images. They are reliable. Use the powerful `"AI"` element type **only when you need to create a custom, interactive, or visually unique component** that is not on the standard list.

# ---
# ### **AVAILABLE ELEMENT TYPES**

# You **MUST ONLY** use the `element_type` values from the list below. Do not invent new types.

# **--- STANDARD COMPONENTS (USE THESE FIRST) ---**

# **1. `TEXT` Element:** For headings and paragraphs.
#    - **JSON Structure:** `{ "element_type": "TEXT", "properties": { "content": "HTML content here", "style": { ... } } }`

# **2. `BUTTON` Element:** For clickable calls to action.
#    - **JSON Structure:** `{ "element_type": "BUTTON", "properties": { "text": "Button Text", "style": { ... } } }`

# **3. `IMAGE` Element:** For displaying images. Use professional placeholders from Pexels or Unsplash.
#    - **JSON Structure:** `{ "element_type": "IMAGE", "properties": { "src": "image_url", "alt": "description", "style": { ... } } }`

# **4. `LIST` Element:** For simple bulleted lists.
#    - **JSON Structure:** `{ "element_type": "LIST", "properties": { "items": ["Item 1", "Item 2"] } }`

# **--- ADVANCED COMPONENT (USE FOR CUSTOM/COOL STUFF) ---**

# **5. `AI` Element:** Use this for anything custom, interactive, or visually complex (e.g., testimonial sliders, animated counters, unique cards with hover effects).
#    - When you use `element_type: "AI"`, you must generate a complete `aiPayload` object.
#    - **CRITICAL RULE:** The `aiPayload` MUST make all text and styles fully editable using `{{mustache}}` tokens, `properties`, and `editableProps`.
#    - **JSON Structure & Example:**
#      ```json
#      {
#        "element_type": "AI",
#        "properties": {},
#        "aiPayload": {
#          "aiTemplate": "<div class=\\"custom-card\\"><style>.custom-card { background: {{bgColor}}; padding: 1rem; }</style><h3>{{title}}</h3></div>",
#          "script": null,
#          "properties": { "title": "My Custom Card", "bgColor": "#EEE" },
#          "editableProps": [
#            { "key": "title", "label": "Title", "type": "text" },
#            { "key": "bgColor", "label": "Background", "type": "color" }
#          ]
#        }
#      }
#      ```

# ---
# **INPUT:** A user's prompt for a webpage.

# **OUTPUT:** A valid JSON object containing the "sections" array, using a smart mix of the valid standard and AI elements defined above.
# """.strip()




@router.post("/generate-ai-page")
async def generate_ai_page(
    body: GenerateRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    try:
        if not body.website_id:
            raise HTTPException(status_code=400, detail="website_id is required")

        resp = openai.chat.completions.create(
            model=AI_DEFAULT_MODEL,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": PAGE_SYSTEM_PROMPT},
                {"role": "user",   "content": body.prompt},
            ],
            temperature=0.4,
            max_tokens=4096,
        )

        payload = json.loads(resp.choices[0].message.content)

        usage = getattr(resp, "usage", None)
        prompt_tokens     = int(getattr(usage, "prompt_tokens", 0) or 0)
        completion_tokens = int(getattr(usage, "completion_tokens", 0) or 0)
        model_used        = getattr(resp, "model", AI_DEFAULT_MODEL)

        await track_ai_usage(
            db=db,
            website_id=body.website_id,
            user_id=user.id,
            model=model_used,
            feature="generate_page",
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            meta={"prompt_len": len(body.prompt or "")},
        )

        return payload

    except (json.JSONDecodeError,) as e:
        raise HTTPException(status_code=500, detail=f"generate-ai-page JSON parse failed: {e}")
    except HTTPException:
        raise
    except Exception as e:
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"generate-ai-page failed: {e}")

# --- END: NEW PAGE GENERATION FEATURE ---


#endregion pagegenerator  