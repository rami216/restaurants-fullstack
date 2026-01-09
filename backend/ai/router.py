#backend/ai/router/.py
import os, json, re, traceback
from uuid import UUID
from fastapi import APIRouter, HTTPException,Depends,Body
from pydantic import BaseModel, Field
from openai import OpenAI, OpenAIError
from typing import Dict, Any, List, Optional
import re

from sqlalchemy import select
from config import AI_DEFAULT_MODEL
from ai.billing import track_ai_usage
from auth.auth_handler import get_current_active_user
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db
from models import User
from models import CustomDataSchema
from website_builder.custom_data_router import SchemaField

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

**2. Styling:**
    - All CSS must be in a single <style> tag.
    - Use mustache tokens {{...}} for all editable style values.
    - **OUTER CONTAINER RULES (CRITICAL):**
        - The main container <div> (using the `unique_class_name`) MUST have `background: transparent;` and `width: 100%;` by default.
        - To ensure horizontal centering within the section, the main container MUST use: `display: flex; justify-content: center; align-items: center;`.
        - DO NOT apply borders, backgrounds, or shadows to this main container <div> unless the user specifically asks for a "card" or "box". 
        - Apply the primary design (e.g., {{buttonBgColor}}, borders, shadows) directly to the specific internal element (e.g., the <button> or <a> tag) so the element looks like it is floating naturally on the section background.
    - **You MUST expose editables for the following visual controls (when relevant):**
        - **Colors:** element background color, text color, link color, hover/active accents, border color.
        - **Borders:** border width, border style, border radius.
        - **Spacing:** padding and/or gap for internal elements.
        - **Typography:** font size(s), font weight(s), line-height, text alignment.
        - **Effects & Motion:** box-shadow (at least one), transition speed/easing.
    - If the element has distinct sections, provide separate tokens (e.g., `titleBgColor`, `contentBgColor`).
    - **CRITICAL SCOPING SUB-RULE:** Every single CSS rule MUST be prefixed with the `unique_class_name` to prevent styles from leaking.
        - **Correct:** `.ai-element-12345 button { background-color: {{buttonColor}}; }`
        - **Incorrect:** `button { background-color: {{buttonColor}}; }`
        - **Incorrect:** `:root { ... }`
    - CSS must be concise, scoped, and visually polished by default.

**3.  Interactivity (`script` key):**
    - Provide a JavaScript string that adds event listeners to the HTML.
    - The script will be executed inside a function that receives `container` as an argument.
    - Use `container.querySelector('.your-class')` to find and manipulate elements.
    - **DO NOT** wrap your code in a `<script>` tag. Provide only the raw JavaScript.
    - **STRICT RULE:** DO NOT include `alert()`, `console.log()`, or any placeholder popups. If no specific logic is requested, the script key should be an empty string "".
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

#region generatesection
SECTION_GENERATOR_SYSTEM_PROMPT = """
You are an expert layout and style designer creating a complete website section.
Your task is to generate a single valid JSON object based on a user's prompt.

Your output MUST be a valid JSON object containing TWO top-level keys: "properties" and "subsections".

**CRITICAL RULES FOR YOUR OUTPUT:**
1.  **`properties` Key:** This object is for the PARENT SECTION.
    - It MUST contain layout properties like `display`, `flexDirection`, `justifyContent`, `alignItems`, and `gap`.
    - It MUST also contain a nested `style` object for all visual styles like `backgroundColor`, `padding`, and `backgroundImage`.
2.  **`subsections` Key:** This must be an array of one or more subsection objects, each with their own `properties` and `elements`.
3.  **Content:** Fill all elements with relevant placeholder content that matches the user's prompt. Make the content interesting and visually appealing.
4.  **Styling:** Use modern and clean design principles. All CSS properties in `style` objects must be in camelCase (e.g., `backgroundColor`).

**Example Prompt:** "A dark hero section with a centered title and a call-to-action button."
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
      "padding": "6rem 2rem",
      "borderRadius": "16px"
    }
  },
  "subsections": [
    {
      "properties": { "style": { "textAlign": "center", "maxWidth": "600px" } },
      "elements": [
        {
          "element_type": "TEXT",
          "properties": { "content": "<h1>Innovative Solutions for a Digital World</h1><p>We build amazing web experiences.</p>", "style": { "fontSize": "3rem", "color": "#FFFFFF" } },
          "aiPayload": null
        },
        {
          "element_type": "BUTTON",
          "properties": { "text": "Get Started", "style": { "backgroundColor": "#3b82f6", "color": "#FFFFFF", "padding": "1rem 2rem", "borderRadius": "8px", "fontSize": "1rem", "marginTop": "2rem" } },
          "aiPayload": null
        }
      ]
    }
  ]
}
""".strip()

class GenerateSectionRequest(BaseModel):
    prompt: str
    website_id: UUID | str

@router.post("/generate-ai-section")
async def generate_ai_section(
    body: GenerateSectionRequest,
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
                {"role": "system", "content": SECTION_GENERATOR_SYSTEM_PROMPT},
                {"role": "user",   "content": body.prompt},
            ],
            temperature=0.6,
            max_tokens=4096,
        )

        payload = json.loads(resp.choices[0].message.content)
        if "properties" not in payload or "subsections" not in payload:
            raise HTTPException(status_code=500, detail="AI returned an invalid structure.")
            
        # --- AI Usage Tracking Logic ---
        usage = getattr(resp, "usage", None)
        prompt_tokens = int(getattr(usage, "prompt_tokens", 0) or 0)
        completion_tokens = int(getattr(usage, "completion_tokens", 0) or 0)
        model_used = getattr(resp, "model", AI_DEFAULT_MODEL)

        await track_ai_usage(
            db=db,
            website_id=body.website_id,
            user_id=user.id,
            model=model_used,
            feature="generate_section",
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            meta={"prompt_len": len(body.prompt or "")}
        )
        # --- End of Usage Tracking ---

        return payload

    except HTTPException:
        raise
    except Exception as e:
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"AI section generation failed: {e}")


#endregion generatesection

#region data_app_element

# ✅ 1. ADD THIS NEW, ADVANCED PROMPT FOR THE DATA APP GENERATOR
# DATA_APP_GENERATOR_PROMPT = """
# You are an expert full-stack developer creating a single, self-contained, interactive CRUD data table element.

# Your output MUST be a valid JSON object with SEVEN keys: "name", "schema", "aiTemplate", "properties", "editableProps", "script", and "displayTemplate".

# ---
# ### **CRITICAL RULES FOR YOUR OUTPUT**

# 1.  **`name`**: A short, human-readable name for this data table (e.g., "Team Members").

# 2.  **`schema`**: An array of objects defining the database fields. Each object must have `id`, `label`, and `type`.

# 3.  **`aiTemplate`**: The main HTML structure. It MUST include a `<style>` tag, a container for the data rows, a container for the form, and an "Add New" button. It must also contain a `<template id="displayTemplate">` tag which will hold the `displayTemplate`.

# 4.  **`displayTemplate`**: A Mustache/HTML template for ONE data row. It MUST be a `<tr>` element and include edit/delete buttons with a `data-row-id="{{row_id}}"`.

# 5.  **Styling & Editable Properties (`properties`, `editableProps`)**:
#     -   You MUST make the component's styling fully editable (colors, fonts, borders, spacing).
#     -   All style values in the `<style>` tag and all user-facing text in the `aiTemplate` and `formTemplate` MUST use mustache tokens (e.g., `{{buttonTextColor}}`, `{{formTitle}}`).
#     -   For EVERY token, you MUST add a corresponding entry in both the `properties` object (with a default value) and the `editableProps` array (with a key, label, and type).
#     -   **CRITICAL SCOPING RULE:** You will be given a `unique_class_name`. **Every single CSS rule** in the `<style>` tag **MUST** be prefixed with this class name to prevent styles from leaking.

# 6.  **`script`**: A complete, raw JavaScript string to make the element interactive.
#     -   It is executed in a function that receives `(container, api, schemaId)`.
#     -   It MUST handle fetching, rendering, adding, updating, AND deleting data.
#     -   API Calls to Use:
#         -   Fetch all rows: `api.get(`/custom-data/rows/${schemaId}`)`
#         -   Add: `api.post(`/custom-data/rows/${schemaId}`, { data })`
#         -   Update: `api.put(`/custom-data/rows/{ROW_ID}`, { data })`
#         -   Delete: `api.delete(`/custom-data/rows/{ROW_ID}`)`
#     -   It MUST update the display instantly without a page refresh.
#     -   It MUST use function expressions (e.g., `const myFunc = () => {}`).

# ---
# **INPUT:** A user's prompt and a `unique_class_name`.
# **OUTPUT:** A single, valid JSON object that follows all rules.
# """.strip()

TEST_1_DATA_APP_GENERATOR_PROMPT = """
You are an expert full-stack developer creating a single, self-contained, interactive CRUD data table element using Tailwind CSS for a professional, modern UI.

Your output MUST be a valid JSON object with SIX keys: "name", "schema", "aiTemplate", "properties", "editableProps", and "script".

---
### **CRITICAL RULES FOR YOUR OUTPUT**

1.  **Analyze Existing Schemas for Relationships (MOST IMPORTANT RULE):**
    -   You will be provided a list of `EXISTING_SCHEMAS_ON_WEBSITE`.
    -   When a user's prompt mentions a concept that matches an existing schema (e.g., prompt is "create a list of employees with their department" and a "Departments" schema exists), you **MUST** create a relational field.
    -   To create a relation, the field in your `schema` output must have:
        -   `"type": "relation"`
        -   `"related_schema_id": "the_uuid_of_the_existing_schema"`
    -   If the prompt describes a new concept with no matching existing schema, you should use standard types like "text", "number", etc.

2.  **`name`**: A short, human-readable name for this data table. **This MUST be based directly on the user's prompt** (e.g., if the prompt asks for a "User Management System", the name MUST be "User Management System").

3.  **`schema`**: An array of objects defining the database fields. Each must have `id`, `label`, and `type`. The `id` must be a single lowercase word (e.g., 'job_title') suitable for a JavaScript object key. Use the relationship rule above where applicable.

4.  **`aiTemplate`**: The main HTML structure. It MUST include:
    -   A `<style>` tag for all CSS, scoped using the `unique_class_name`.
    -   A main container with Tailwind classes: `p-6 bg-white rounded-xl shadow-lg border border-gray-100`.
    -   A header `div` with class `flex justify-between items-center mb-6`.
    -   A static main title `<h3>` or `<h2>` with class `text-2xl font-bold text-gray-800`.
    -   A static "Add New" button with a class of `add-new-btn px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all active:scale-95`.
    -   An **EMPTY** container for the form: `<div class="form-container mb-8 p-6 bg-gray-50 rounded-xl border border-gray-200 hidden"></div>`.
    -   An **EMPTY** container for displaying the data: `<div class="data-display space-y-3 w-full overflow-x-auto"></div>`.
    -   An **EMPTY** container for pagination controls: `<div class="pagination-controls mt-6 flex justify-center gap-2"></div>`.
    -   A `<template id="displayTemplate">`.
    -   **Visibility Mode:** If the user prompt asks to "hide data", "not load data", "private", or "form only", you MUST add the Tailwind class `hidden` to the `.data-display` and `.pagination-controls` div containers inside the `aiTemplate` string.

5. **`displayTemplate`**: A Mustache/HTML template for ONE data item.
    -   It MUST be a `div` with class: `flex items-center justify-between p-4 bg-white border border-gray-100 rounded-lg hover:shadow-md transition-shadow`.
    -   For regular fields, you **MUST** use `{{data.field_id}}` inside a `div` with class `flex-1`.
    -   **CRITICAL:** For relational fields (e.g., a field with id 'project'), you **MUST** access the nested data correctly. Look at the `EXISTING_SCHEMAS_ON_WEBSITE` context to find the exact field `id` from the related schema to display (e.g., if the project schema has a field with id `project_title`, you MUST use `{{data.project.data.project_title}}`).
    -   It **MUST** include edit/delete buttons in a `div` with class `flex gap-2`. Buttons must have `data-row-id="{{row_id}}"`. Use classes: `edit-btn px-3 py-1 text-blue-600 hover:bg-blue-50 rounded` and `delete-btn px-3 py-1 text-red-600 hover:bg-red-50 rounded`.

6.  **Styling & Editable Properties (`properties`, `editableProps`)**:
    -   Make the component's styling fully editable.
    -   All style values and user-facing text (like titles and buttons) MUST use mustache tokens.
    -   For EVERY token, add a corresponding entry in `properties` and `editableProps`.
    -   **CRITICAL SCOPING RULE:** Every CSS rule **MUST** be prefixed with the given `unique_class_name`.
    -   **Mode Toggle:** You MUST add a property `"hideData": true` to the `properties` object if the user asked to hide the list, otherwise set it to `false`. Add a corresponding entry in `editableProps` with type `boolean`.

7.  **`script`**: A complete, raw JavaScript string that makes the element interactive.
    -   It is executed in a function that receives `(container, api, schemaId, properties, Mustache)`.
    -   State Management: It MUST manage state for currentPage (0-indexed), rowsPerPage (e.g., 20), and totalRows.
    -   **Initial Load Guard:** The script MUST check `if (properties.hideData) return;` at the very beginning of the `fetchAndRenderRows` function and before calling it at the bottom of the script to prevent private data from loading.
    -   **Accessing the Schema:** You **MUST** get the schema from `properties.schema_fields`.
    -   **Form Generation (STYLING CRITICAL):** The script **MUST** dynamically generate a `<form>` and its input fields inside the `form-container`.
        -   The `<form>` element MUST have class: `grid grid-cols-1 md:grid-cols-2 gap-4`.
        -   Every `<label>` created MUST have class: `block text-sm font-semibold text-gray-700 mb-1`.
        -   Every `<input>` and `<select>` created MUST have class: `w-full p-2 border rounded-lg border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none transition-all`.
        -   The `submitBtn` created MUST have class: `md:col-span-2 w-full bg-blue-600 text-white font-bold py-2.5 rounded-lg hover:bg-blue-700 transition-colors mt-2`.
        -   For fields with `type: "relation"`, it **MUST** generate a `<select>` dropdown.
        -   It must then make a separate API call to fetch the rows for the `related_schema_id` to populate the dropdown's `<option>` elements.
        -   **ULTRA-CRITICAL SCRIPT RULE:** The script must populate the dropdown dynamically. It must:
                1.  Find the related schema's definition within the `properties.all_schemas` context provided to the script.
                2.  From that schema's `fields` array, find the `id` of the first field that is of `type: "text"` or `type: "email"`. This will be the `displayKey`.
                3.  Fetch all rows for the `related_schema_id`.
                4.  When creating each `<option>`, the `textContent` **MUST** be set using the dynamic `displayKey` found in step 2 (e.g., `option.textContent = relatedRow.data[displayKey]`).
                5.  The `value` for the `<option>` must be the `row_id`.
                -   **DO NOT** use `if/else` blocks to hardcode the display key. The logic must be fully dynamic and general-purpose.
        -   **Relation Exception:** Even if `properties.hideData` is true, the script **MUST** still execute the code that fetches relational data from other tables to populate dropdowns, otherwise the form will be broken.
    -   **Data Submission:** On form submit, it **MUST** use `new FormData(form)` and `Object.fromEntries()` to reliably collect all data.
        -   **Submission Success Feedback:** After a successful `api.post`, the script MUST check `if (properties.hideData)`. If true, replace the `form-container` content with: `'<div class="p-4 text-green-600 font-bold text-center">Thank you! Your submission was successful.</div>'`. If false, hide the form and re-fetch rows as usual.
    -   It MUST handle the full CRUD lifecycle, including populating the form correctly for editing.
    -   API Calls to Use:
        -   **Fetch Paginated Rows:** `api.get(\`/custom-data/rows/${schemaId}?skip=\${currentPage * rowsPerPage}&limit=\${rowsPerPage}\`)`. The response is `{ "rows": [], "total": 0 }`.
        -   **Add New Row:** `api.post(\`/custom-data/rows/${schemaId}\`, { data, sitemember_id })` (where `sitemember_id` can be null)
        -   **Update Row:** `api.put(\`/custom-data/rows/{ROW_ID}\`, { data, sitemember_id })` (where `sitemember_id` can be null)
        -   **Delete Row:** `api.delete(\`/custom-data/rows/{ROW_ID}\`)`. If a `sitemember_id` exists, it MUST be added as a query parameter like `?sitemember_id={MEMBER_ID}`. Do not add the parameter at all if the ID is null.
    -   Pagination Logic:
        -  It MUST render "Previous" and "Next" buttons inside a .pagination-controls container.
        -  Buttons MUST be disabled when on the first or last page.
        -  Pagination buttons MUST use classes: `px-3 py-1 border rounded bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed`.
        -  Clicking the buttons **MUST** update the `currentPage` state and re-fetch the data.
        
    -   It MUST use function expressions (e.g., `const myFunc = () => {}`).

---
**INPUT:** A user's prompt and a `unique_class_name`.
**OUTPUT:** A single, valid JSON object.

**Example Prompt:** "Private Inquiry form. Don't load existing inquiries."
**Example `unique_class_name`:** `.ai-inquiry-123`
**Example Output:**
{
  "name": "Private Inquiry Form",
  "schema": [
    { "id": "name", "label": "Name", "type": "text" },
    { "id": "type", "label": "Inquiry Type", "type": "relation", "related_schema_id": "existing-uuid" }
  ],
  "aiTemplate": "<style>.ai-inquiry-123 h3 { color: {{titleColor}}; }</style><div class=\\"p-6 bg-white rounded-xl shadow-lg border border-gray-100\\"><div class=\\"flex justify-between items-center mb-6\\"><h3 class=\\"text-2xl font-bold\\">{{title}}</h3><button class=\\"add-new-btn px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition\\">{{addButtonText}}</button></div><div class=\\"form-container mb-8 p-6 bg-gray-50 rounded-xl border border-gray-200 hidden\\"></div><div class=\\"data-display space-y-3 hidden\\"></div><div class=\\"pagination-controls hidden\\"></div></div><template id=\\"displayTemplate\\"><div>{{data.name}}</div></template>",
  "properties": {
    "title": "Send Inquiry",
    "addButtonText": "Add Inquiry",
    "hideData": true,
    "titleColor": "#111827"
  },
  "editableProps": [
    { "key": "title", "label": "Title", "type": "text" },
    { "key": "hideData", "label": "Hide Data List", "type": "boolean" }
  ],
  "script": "const formContainer = container.querySelector('.form-container'); const addButton = container.querySelector('.add-new-btn'); const schema = properties.schema_fields; const fetchAndRenderRows = async () => { if (properties.hideData) return; try { const res = await api.get(\`/custom-data/rows/\${schemaId}?skip=0&limit=20\`); /* render rows... */ } catch (err) {} }; const generateForm = async (initialData = {}) => { formContainer.classList.remove('hidden'); formContainer.innerHTML = ''; const form = document.createElement('form'); form.className = 'grid grid-cols-1 md:grid-cols-2 gap-4'; for (const field of schema) { const fieldWrapper = document.createElement('div'); const label = document.createElement('label'); label.className = 'block text-sm font-semibold text-gray-700 mb-1'; label.textContent = field.label; fieldWrapper.appendChild(label); if (field.type === 'relation') { const select = document.createElement('select'); select.className = 'w-full p-2 border rounded-lg'; select.name = field.id; const relatedSchemaId = field.related_schema_id; const allSchemas = properties.all_schemas; const relatedSchema = allSchemas.find(s => s.schema_id === relatedSchemaId); if (relatedSchema) { const displayKey = relatedSchema.fields.find(f => f.type === 'text' || f.type === 'email')?.id || relatedSchema.fields[0].id; const res = await api.get(\`/custom-data/rows/\${relatedSchemaId}?limit=1000\`); res.data.rows.forEach(r => { const opt = document.createElement('option'); opt.value = r.row_id; opt.textContent = r.data[displayKey]; select.appendChild(opt); }); } fieldWrapper.appendChild(select); } else { const input = document.createElement('input'); input.className = 'w-full p-2 border rounded-lg'; input.name = field.id; input.type = field.type; input.value = initialData[field.id] || ''; fieldWrapper.appendChild(input); } form.appendChild(fieldWrapper); } const submitBtn = document.createElement('button'); submitBtn.className = 'md:col-span-2 w-full bg-blue-600 text-white py-2.5 rounded-lg'; submitBtn.type = 'submit'; submitBtn.textContent = 'Submit'; form.appendChild(submitBtn); form.addEventListener('submit', async (e) => { e.preventDefault(); const data = Object.fromEntries(new FormData(e.target)); try { await api.post(\`/custom-data/rows/\${schemaId}\`, { data, sitemember_id: null }); if (properties.hideData) { formContainer.innerHTML = '<div class=\\"p-4 text-green-600 font-bold text-center\\">Thank you! Your submission was successful.</div>'; } else { await fetchAndRenderRows(); formContainer.classList.add('hidden'); } } catch (err) {} }); formContainer.appendChild(form); }; addButton.addEventListener('click', () => generateForm()); if (!properties.hideData) fetchAndRenderRows();"
}
""".strip()
DATA_APP_GENERATOR_PROMPT = """
You are an expert full-stack developer creating a single, self-contained, interactive CRUD data table element using Tailwind CSS for a professional, modern UI.

Your output MUST be a valid JSON object with SIX keys: "name", "schema", "aiTemplate", "properties", "editableProps", and "script".

---
### **CRITICAL RULES FOR YOUR OUTPUT**

1.  **Analyze Existing Schemas for Relationships (MOST IMPORTANT RULE):**
    -   You will be provided a list of `EXISTING_SCHEMAS_ON_WEBSITE`.
    -   When a user's prompt mentions a concept that matches an existing schema (e.g., prompt is "create a list of employees with their department" and a "Departments" schema exists), you **MUST** create a relational field.
    -   To create a relation, the field in your `schema` output must have:
        -   `"type": "relation"`
        -   `"related_schema_id": "the_uuid_of_the_existing_schema"`
    -   If the prompt describes a new concept with no matching existing schema, you should use standard types like "text", "number", etc.

2.  **`name`**: A short, human-readable name for this data table. **This MUST be based directly on the user's prompt** (e.g., if the prompt asks for a "User Management System", the name MUST be "User Management System").

3.  **`schema`**: An array of objects defining the database fields. Each must have `id`, `label`, and `type`. The `id` must be a single lowercase word (e.g., 'job_title') suitable for a JavaScript object key. Use the relationship rule above where applicable.

4.  **`aiTemplate`**: The main HTML structure. It MUST include:
    -   A `<style>` tag for all CSS, scoped using the `unique_class_name`.
    -   A main container with Tailwind classes: `p-6 bg-white rounded-xl shadow-lg border border-gray-100`.
    -   A header `div` with class `flex justify-between items-center mb-6`.
    -   A static main title `<h3>` or `<h2>` with class `text-2xl font-bold text-gray-800`.
    -   A static "Add New" button with a class of `add-new-btn px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all active:scale-95`.
    -   An **EMPTY** container for the form: `<div class="form-container mb-8 p-6 bg-gray-50 rounded-xl border border-gray-200 hidden"></div>`.
    -   An **EMPTY** container for displaying the data: `<div class="data-display space-y-3 w-full overflow-x-auto"></div>`.
    -   An **EMPTY** container for pagination controls: `<div class="pagination-controls mt-6 flex justify-center gap-2"></div>`.
    -   A `<template id="displayTemplate">`.

5. **`displayTemplate`**: A Mustache/HTML template for ONE data item.
    -   It MUST be a `div` with class: `flex items-center justify-between p-4 bg-white border border-gray-100 rounded-lg hover:shadow-md transition-shadow`.
    -   For regular fields, you **MUST** use `{{data.field_id}}` inside a `div` with class `flex-1`.
    -   **CRITICAL:** For relational fields (e.g., a field with id 'project'), you **MUST** access the nested data correctly. Look at the `EXISTING_SCHEMAS_ON_WEBSITE` context to find the exact field `id` from the related schema to display (e.g., if the project schema has a field with id `project_title`, you MUST use `{{data.project.data.project_title}}`).
    -   It **MUST** include edit/delete buttons in a `div` with class `flex gap-2`. Buttons must have `data-row-id="{{row_id}}"`. Use classes: `edit-btn px-3 py-1 text-blue-600 hover:bg-blue-50 rounded` and `delete-btn px-3 py-1 text-red-600 hover:bg-red-50 rounded`.

6.  **Styling & Editable Properties (`properties`, `editableProps`)**:
    -   Make the component's styling fully editable.
    -   All style values and user-facing text (like titles and buttons) MUST use mustache tokens.
    -   For EVERY token, add a corresponding entry in `properties` and `editableProps`.
    -   **CRITICAL SCOPING RULE:** Every CSS rule **MUST** be prefixed with the given `unique_class_name`.

7.  **`script`**: A complete, raw JavaScript string that makes the element interactive.
    -   It is executed in a function that receives `(container, api, schemaId, properties, Mustache)`.
    -   State Management: It MUST manage state for currentPage (0-indexed), rowsPerPage (e.g., 20), and totalRows.
    -   **Accessing the Schema:** You **MUST** get the schema from `properties.schema_fields`.
    -   **Form Generation (STYLING CRITICAL):** The script **MUST** dynamically generate a `<form>` and its input fields inside the `form-container`.
        -   The `<form>` element MUST have class: `grid grid-cols-1 md:grid-cols-2 gap-4`.
        -   Every `<label>` created MUST have class: `block text-sm font-semibold text-gray-700 mb-1`.
        -   Every `<input>` and `<select>` created MUST have class: `w-full p-2 border rounded-lg border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none transition-all`.
        -   The `submitBtn` created MUST have class: `md:col-span-2 w-full bg-blue-600 text-white font-bold py-2.5 rounded-lg hover:bg-blue-700 transition-colors mt-2`.
        -   For fields with `type: "relation"`, it **MUST** generate a `<select>` dropdown.
        -   It must then make a separate API call to fetch the rows for the `related_schema_id` to populate the dropdown's `<option>` elements.
        -   **ULTRA-CRITICAL SCRIPT RULE:** The script must populate the dropdown dynamically. It must:
                1.  Find the related schema's definition within the `properties.all_schemas` context provided to the script.
                2.  From that schema's `fields` array, find the `id` of the first field that is of `type: "text"` or `type: "email"`. This will be the `displayKey`.
                3.  Fetch all rows for the `related_schema_id`.
                4.  When creating each `<option>`, the `textContent` **MUST** be set using the dynamic `displayKey` found in step 2 (e.g., `option.textContent = relatedRow.data[displayKey]`).
                5.  The `value` for the `<option>` must be the `row_id`.
                -   **DO NOT** use `if/else` blocks to hardcode the display key. The logic must be fully dynamic and general-purpose.
    -   **Data Submission:** On form submit, it **MUST** use `new FormData(form)` and `Object.fromEntries()` to reliably collect all data.
    -   It MUST handle the full CRUD lifecycle, including populating the form correctly for editing.
    -   API Calls to Use:
        -   **Fetch Paginated Rows:** `api.get(`/custom-data/rows/${schemaId}?skip=${currentPage * rowsPerPage}&limit=${rowsPerPage}`)`. The response is `{ "rows": [], "total": 0 }`.
        -   **Add New Row:** `api.post(`/custom-data/rows/${schemaId}`, { data, sitemember_id })` (where `sitemember_id` can be null)
        -   **Update Row:** `api.put(`/custom-data/rows/{ROW_ID}`, { data, sitemember_id })` (where `sitemember_id` can be null)
        -   **Delete Row:** `api.delete(`/custom-data/rows/{ROW_ID}`)`. If a `sitemember_id` exists, it MUST be added as a query parameter like `?sitemember_id={MEMBER_ID}`. Do not add the parameter at all if the ID is null.
    -   Pagination Logic:
        -  It MUST render "Previous" and "Next" buttons inside a .pagination-controls container.
        -  Buttons MUST be disabled when on the first or last page.
        -  Pagination buttons MUST use classes: `px-3 py-1 border rounded bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed`.
        -  Clicking the buttons **MUST** update the `currentPage` state and re-fetch the data.
        
    -   It MUST use function expressions (e.g., `const myFunc = () => {}`).

---
**INPUT:** A user's prompt and a `unique_class_name`.
**OUTPUT:** A single, valid JSON object.

**Example Prompt:** "A contact list table with fields for name and email."
**Example `unique_class_name`:** `.ai-contact-list-12345`
**Example Output:**
{
  "name": "Contact List",
  "schema": [
    { "id": "name", "label": "Name", "type": "text" },
    { "id": "email", "label": "Email", "type": "email" }
  ],
  "aiTemplate": "<style>.ai-contact-list-12345 h3 { color: {{titleColor}}; } .ai-contact-list-12345 .add-new-btn { margin-bottom: 1rem; }</style><div class=\\"p-6 bg-white rounded-xl shadow-lg border border-gray-100\\"><div class=\\"flex justify-between items-center mb-6\\"><h3 class=\\"text-2xl font-bold\\">{{title}}</h3><button class=\\"add-new-btn px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition\\">{{addButtonText}}</button></div><div class=\\"form-container mb-8 p-6 bg-gray-50 rounded-xl border border-gray-200 hidden\\"></div><div class=\\"data-display space-y-3 w-full overflow-x-auto\\"></div><div class=\\"pagination-controls mt-6 flex justify-center gap-2\\"></div></div><template id=\\"displayTemplate\\"><div class=\\"flex items-center justify-between p-4 bg-white border border-gray-100 rounded-lg hover:shadow-md transition-shadow\\"><div class=\\"flex-1\\"><p class=\\"font-bold text-gray-900\\">{{data.name}}</p><p class=\\"text-sm text-gray-500\\">{{data.email}}</p></div><div class=\\"flex gap-2\\"><button class=\\"edit-btn px-3 py-1 text-blue-600 hover:bg-blue-50 rounded\\" data-row-id=\\"{{row_id}}\\">Edit</button><button class=\\"delete-btn px-3 py-1 text-red-600 hover:bg-red-50 rounded\\" data-row-id=\\"{{row_id}}\\">Delete</button></div></div></template>",
  "properties": {
    "title": "Contact List",
    "addButtonText": "Add Contact",
    "titleColor": "#111827",
    "borderColor": "#e5e7eb",
    "buttonBgColor": "#3b82f6"
  },
  "editableProps": [
    { "key": "title", "label": "Title", "type": "text" },
    { "key": "addButtonText", "label": "Add Button Text", "type": "text" },
    { "key": "titleColor", "label": "Title Color", "type": "color" },
    { "key": "borderColor", "label": "Border Color", "type": "color" },
    { "key": "buttonBgColor", "label": "Button Color", "type": "color" }
  ],
  "script": "const formContainer = container.querySelector('.form-container'); const dataDisplay = container.querySelector('.data-display'); const paginationControls = container.querySelector('.pagination-controls'); const addButton = container.querySelector('.add-new-btn'); const displayTemplate = container.querySelector('#displayTemplate').innerHTML; let currentRows = []; let editingRowId = null; const schema = properties.schema_fields; let currentPage = 0; const rowsPerPage = 20; let totalRows = 0; const generateForm = async (initialData = {}) => { formContainer.style.display = 'block'; formContainer.innerHTML = ''; const form = document.createElement('form'); form.className = 'grid grid-cols-1 md:grid-cols-2 gap-4'; for (const field of schema) { const fieldWrapper = document.createElement('div'); const label = document.createElement('label'); label.className = 'block text-sm font-semibold text-gray-700 mb-1'; label.textContent = field.label; fieldWrapper.appendChild(label); if (field.type === 'relation') { const select = document.createElement('select'); select.className = 'w-full p-2 border rounded-lg border-gray-300 bg-white'; select.name = field.id; select.required = true; const defaultOption = document.createElement('option'); defaultOption.textContent = `Select ${field.label}`; defaultOption.value = ''; select.appendChild(defaultOption); const relatedSchemaId = field.related_schema_id; const allSchemas = properties.all_schemas; const relatedSchema = allSchemas.find(s => s.schema_id === relatedSchemaId); if (relatedSchema) { const displayKey = relatedSchema.fields.find(f => f.type === 'text' || f.type === 'email')?.id || relatedSchema.fields[0].id; const res = await api.get(`/custom-data/rows/${relatedSchemaId}?limit=1000`); res.data.rows.forEach(relatedRow => { const option = document.createElement('option'); option.value = relatedRow.row_id; option.textContent = relatedRow.data[displayKey] || relatedRow.row_id; select.appendChild(option); }); } select.value = initialData[field.id] || ''; fieldWrapper.appendChild(select); } else { const input = document.createElement('input'); input.className = 'w-full p-2 border rounded-lg border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none'; input.name = field.id; input.type = field.type; input.required = true; input.value = initialData[field.id] || ''; fieldWrapper.appendChild(input); } form.appendChild(fieldWrapper); } const submitBtn = document.createElement('button'); submitBtn.className = 'md:col-span-2 w-full bg-blue-600 text-white font-bold py-2.5 rounded-lg hover:bg-blue-700 transition-colors mt-2'; submitBtn.type = 'submit'; submitBtn.textContent = editingRowId ? 'Update' : 'Save'; form.appendChild(submitBtn); form.addEventListener('submit', handleFormSubmit); formContainer.appendChild(form); }; const handleFormSubmit = async (e) => { e.preventDefault(); const form = e.target; const formData = new FormData(form); const data = Object.fromEntries(formData.entries()); const sitemember_id = localStorage.getItem(`siteMemberId:your-subdomain`); try { if (editingRowId) { await api.put(`/custom-data/rows/${editingRowId}`, { data, sitemember_id }); } else { await api.post(`/custom-data/rows/${schemaId}`, { data, sitemember_id }); } await fetchAndRenderRows(); formContainer.innerHTML = ''; formContainer.style.display = 'none'; editingRowId = null; } catch (err) { console.error('Failed to save data:', err); } }; const renderRows = () => { dataDisplay.innerHTML = ''; currentRows.forEach(row => { const div = document.createElement('div'); div.innerHTML = Mustache.render(displayTemplate, row); dataDisplay.appendChild(div); }); }; const renderPagination = () => { paginationControls.innerHTML = ''; const totalPages = Math.ceil(totalRows / rowsPerPage); if (totalPages <= 1) return; const prevButton = document.createElement('button'); prevButton.className = 'px-3 py-1 border rounded bg-white hover:bg-gray-50 disabled:opacity-50'; prevButton.textContent = 'Previous'; prevButton.disabled = currentPage === 0; prevButton.addEventListener('click', () => { if (currentPage > 0) { currentPage--; fetchAndRenderRows(); } }); const nextButton = document.createElement('button'); nextButton.className = 'px-3 py-1 border rounded bg-white hover:bg-gray-50 disabled:opacity-50'; nextButton.textContent = 'Next'; nextButton.disabled = currentPage >= totalPages - 1; nextButton.addEventListener('click', () => { if (currentPage < totalPages - 1) { currentPage++; fetchAndRenderRows(); } }); paginationControls.appendChild(prevButton); paginationControls.appendChild(nextButton); }; const fetchAndRenderRows = async () => { try { const response = await api.get(`/custom-data/rows/${schemaId}?skip=${currentPage * rowsPerPage}&limit=${rowsPerPage}`); const { rows, total } = response.data; currentRows = rows; totalRows = total; renderRows(); renderPagination(); } catch (err) { console.error('Failed to fetch data:', err); } }; dataDisplay.addEventListener('click', async (e) => { const editBtn = e.target.closest('.edit-btn'); if (editBtn) { editingRowId = editBtn.dataset.rowId; const rowToEdit = currentRows.find(r => r.row_id === editingRowId); if (rowToEdit) { await generateForm(rowToEdit.data); } } const deleteBtn = e.target.closest('.delete-btn'); if (deleteBtn) { const rowId = deleteBtn.dataset.rowId; if (confirm('Are you sure?')) { const sitemember_id = localStorage.getItem(`siteMemberId:your-subdomain`); let url = `/custom-data/rows/${rowId}`; if (sitemember_id) { url += `?sitemember_id=${sitemember_id}`; } await api.delete(url); fetchAndRenderRows(); } } }); addButton.addEventListener('click', () => { editingRowId = null; generateForm(); }); fetchAndRenderRows();"
}
""".strip()

# --- THE CORRECTED FUNCTION AND MODELS ---
class GenerateDataAppRequest(BaseModel):
    prompt: str
    website_id: UUID
    unique_class_name: str

class AIResponseSchema(BaseModel):
    name: str
    schema_fields: List[SchemaField] = Field(..., alias="schema")
    ai_template: str = Field(..., alias="aiTemplate")
    properties: Dict[str, Any]
    editable_props: List[Dict[str, Any]] = Field(..., alias="editableProps")
    script: str

@router.post("/generate-data-app-element")
async def generate_data_app_element(
    body: GenerateDataAppRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user)
):
    try:
        # Step 1: Fetch existing schemas for the AI's context
        schema_result = await db.execute(
            select(CustomDataSchema)
            .where(CustomDataSchema.website_id == body.website_id)
        )
        existing_schemas = schema_result.scalars().all()
        schemas_for_prompt = [{"name": s.name, "schema_id": str(s.schema_id), "fields": s.fields} for s in existing_schemas]

        user_content = (
            f'PROMPT: "{body.prompt}"\n\n'
            f'UNIQUE_CLASS_NAME: `.{body.unique_class_name}`\n\n'
            f'EXISTING_SCHEMAS_ON_WEBSITE: {json.dumps(schemas_for_prompt)}'
        )

        # Step 2: Call OpenAI with the full context
        resp = openai.chat.completions.create(
            model=AI_DEFAULT_MODEL,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": TEST_1_DATA_APP_GENERATOR_PROMPT},
                {"role": "user", "content": user_content},
            ],
            temperature=0.5,
            max_tokens=4096,
        )
        
        payload = json.loads(resp.choices[0].message.content)

        # Step 3: Process the AI's instructions to create one or more schemas
        schemas_to_create = payload.get("schemas_to_create", [])
        element_to_generate = payload.get("element_to_generate")

        if not element_to_generate or not schemas_to_create:
            # Fallback for old prompt format for safety
            if "schema" in payload:
                 schemas_to_create = [payload]
                 element_to_generate = payload
            else:
                raise HTTPException(status_code=500, detail="AI response was missing required structure.")

        created_schemas_map = {}
        final_schema_id = None
        final_schema_data = None

        for schema_data in schemas_to_create:
            # Handle both old and new schema formats
            schema_fields = schema_data.get("schema_fields") or schema_data.get("schema", [])
            for field in schema_fields:
                if field.get("type") == "relation":
                    placeholder = field.get("related_schema_id")
                    if placeholder in created_schemas_map:
                        field["related_schema_id"] = created_schemas_map[placeholder]
            
            sanitized_fields = []
            for field in schema_fields:
                field_dict = field
                if 'related_schema_id' in field_dict and isinstance(field_dict.get('related_schema_id'), UUID):
                    field_dict['related_schema_id'] = str(field_dict['related_schema_id'])
                sanitized_fields.append(field_dict)

            new_schema = CustomDataSchema(
                website_id=body.website_id,
                name=schema_data["name"],
                fields=sanitized_fields
            )
            db.add(new_schema)
            await db.commit()
            await db.refresh(new_schema)
            
            placeholder_key = f"PLACEHOLDER_FOR_{schema_data['name']}"
            created_schemas_map[placeholder_key] = str(new_schema.schema_id)
            final_schema_id = new_schema.schema_id
            final_schema_data = schema_data
        
        # Step 4: Prepare the final properties, including the 'all_schemas' context
        all_schemas_result = await db.execute(
            select(CustomDataSchema)
            .where(CustomDataSchema.website_id == body.website_id)
        )
        all_schemas = all_schemas_result.scalars().all()
        all_schemas_for_script = [{"name": s.name, "schema_id": str(s.schema_id), "fields": s.fields} for s in all_schemas]

        final_properties = element_to_generate["properties"]
        final_properties["schema_id"] = str(final_schema_id)
        final_properties["originalType"] = "DATA_TABLE"
        
        final_schema_fields = final_schema_data.get("schema_fields") or final_schema_data.get("schema", [])
        final_properties["schema_fields"] = final_schema_fields
        final_properties["all_schemas"] = all_schemas_for_script

        final_payload = {
            "aiTemplate": f'<div class="{body.unique_class_name}">{element_to_generate["aiTemplate"]}</div>',
            "properties": final_properties,
            "editableProps": element_to_generate["editableProps"],
            "script": element_to_generate["script"],
        }
        
        # Step 5: Track usage
        usage = getattr(resp, "usage", None)
        prompt_tokens = int(getattr(usage, "prompt_tokens", 0) or 0)
        completion_tokens = int(getattr(usage, "completion_tokens", 0) or 0)
        model_used = getattr(resp, "model", AI_DEFAULT_MODEL)
        
        await track_ai_usage(
            db=db,
            website_id=body.website_id,
            user_id=user.id,
            model=model_used,
            feature="generate_data_app",
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            meta={"prompt_len": len(body.prompt)}
        )

        return final_payload

    except Exception as e:
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"AI Data App generation failed: {e}")












#region new generateview

VIEW_ONLY_GENERATOR_PROMPT = """
You are an expert front-end developer creating a READ-ONLY component to display data from an existing data source.

Your output MUST be a valid JSON object with FIVE keys: "name_to_find", "aiTemplate", "properties", "editableProps", and "script".

---
### **CRITICAL RULES FOR YOUR OUTPUT**

1.  **`name_to_find`**: The EXACT name of the data schema to find and display, extracted from the user's prompt (e.g., "User Management System").

2.  **`aiTemplate`**: The main HTML structure. It MUST include:
    -   A `<style>` tag for all CSS.
    -   A static main title `<h3>` or `<h2>`.
    -   An **EMPTY** container for displaying the data (e.g., `<div class="data-display"></div>`).
    -   An EMPTY container for pagination controls (e.g., <div class="pagination-controls"></div>).
    -   A `<template id="displayTemplate">`.
    -   **DO NOT** include an "Add New" button or a form container.

3.  displayTemplate: A Mustache/HTML template for ONE data item.
    - The API sends a row object with this structure: {"row_id": "...", "data": {"field_id": "value"}}.
    - For regular fields, you MUST use {{data.field_id}}.
    - CRITICAL: For relational fields (e.g., a field with id 'project'), the data object will contain a nested object. You MUST access this nested data correctly. Look at the SCHEMA_OF_DATA_TO_DISPLAY context to find the exact field id from the related schema to display (e.g., {{data.project.data.project_title}}).
    - DO NOT include edit or delete buttons.

4.  **Styling & Editable Properties (`properties`, `editableProps`)**:
    -   Make the component's styling fully editable.
    -   All style values and user-facing text (like titles) MUST use mustache tokens.
    -   For EVERY token, add a corresponding entry in `properties` and `editableProps`.
    -   **CRITICAL SCOPING RULE:** Every CSS rule **MUST** be prefixed with the given `unique_class_name`.

5.  **`script`**: A complete, raw JavaScript string that makes the element interactive.
    -   It is executed in a function that receives `(container, api, schemaId, properties, Mustache)`.
    -   State Management: It MUST manage state for currentPage (0-indexed), rowsPerPage (e.g., 20), and totalRows.
    -   It must ONLY fetch and render data.
    -   API Calls to Use:
        -   Fetch Paginated Rows: api.get(/custom-data/rows/schemaId?skip={currentPage * rowsPerPage}&limit=${rowsPerPage}). The response is { "rows": [], "total": 0 }.
    -   Pagination Logic:
            - It MUST render "Previous" and "Next" buttons inside the .pagination-controls container.
            - Buttons MUST be disabled when on the first or last page.
            - Clicking the buttons MUST update the currentPage state and re-fetch the data.
    -   It MUST use function expressions (e.g., `const myFunc = () => {}`).

---
**INPUT:** A user's prompt and a `unique_class_name`.
**OUTPUT:** A single, valid JSON object.

**Example Prompt:** "Show a list of our contacts."
**Example `unique_class_name`:** `.ai-contact-view-12345`
**Example Output:**
{
  "name_to_find": "Contact List",
  "aiTemplate": "<style>.ai-contact-view-12345 h3 { color: {{titleColor}}; } .ai-contact-view-12345 .pagination-controls button { margin: 0 5px; }</style><h3>{{title}}</h3><div class=\\"data-display\\"></div><div class=\\"pagination-controls\\"></div><template id=\\"displayTemplate\\"><div><span><strong>{{data.name}}</strong> ({{data.email}})</span></div></template>",
  "properties": { "title": "Our Contacts", "titleColor": "#333333" },
  "editableProps": [ { "key": "title", "label": "Title", "type": "text" }, { "key": "titleColor", "label": "Title Color", "type": "color" } ],
  "script": "const dataDisplay = container.querySelector('.data-display'); const paginationControls = container.querySelector('.pagination-controls'); const displayTemplate = container.querySelector('#displayTemplate').innerHTML; let currentPage = 0; const rowsPerPage = 20; let totalRows = 0; const fetchAndRenderRows = async () => { try { const response = await api.get(`/custom-data/rows/${schemaId}?skip=${currentPage * rowsPerPage}&limit=${rowsPerPage}`); const { rows, total } = response.data; totalRows = total; dataDisplay.innerHTML = ''; rows.forEach(row => { const div = document.createElement('div'); div.innerHTML = Mustache.render(displayTemplate, row); dataDisplay.appendChild(div); }); renderPagination(); } catch (err) { console.error('Failed to fetch data:', err); } }; const renderPagination = () => { paginationControls.innerHTML = ''; const totalPages = Math.ceil(totalRows / rowsPerPage); if (totalPages <= 1) return; const prevButton = document.createElement('button'); prevButton.textContent = 'Previous'; prevButton.disabled = currentPage === 0; prevButton.addEventListener('click', () => { if (currentPage > 0) { currentPage--; fetchAndRenderRows(); } }); const nextButton = document.createElement('button'); nextButton.textContent = 'Next'; nextButton.disabled = currentPage >= totalPages - 1; nextButton.addEventListener('click', () => { if (currentPage < totalPages - 1) { currentPage++; fetchAndRenderRows(); } }); paginationControls.appendChild(prevButton); paginationControls.appendChild(nextButton); }; fetchAndRenderRows();"
}

""".strip()

# --- NEW PYDANTIC MODELS AND ENDPOINT FOR VIEW-ONLY ---
class GenerateViewOnlyRequest(BaseModel):
    prompt: str
    website_id: UUID
    unique_class_name: str

class AIViewOnlyResponseSchema(BaseModel):
    name_to_find: str
    ai_template: str = Field(..., alias="aiTemplate")
    properties: Dict[str, Any]
    editable_props: List[Dict[str, Any]] = Field(..., alias="editableProps")
    script: str

@router.post("/generate-view-only-element")
async def generate_view_only_element(
    body: GenerateViewOnlyRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user)
):
    try:
        # Step 1: Find the schema name and the schema itself from the database.
        # This part requires a preliminary AI call to extract the name.
        name_finder_prompt = f"From the following prompt, extract the exact name of the data source the user wants to display. For example, if the prompt is 'show a list of our Team Members', you must extract 'Team Members'. Respond with JSON with a single key 'name_to_find'.\n\nPROMPT: \"{body.prompt}\""
        
        name_resp = openai.chat.completions.create(
            model=AI_DEFAULT_MODEL,
            response_format={"type": "json_object"},
            messages=[{"role": "system", "content": "You are a helpful assistant that extracts information."}, {"role": "user", "content": name_finder_prompt}],
            temperature=0.0
        )
        name_payload = json.loads(name_resp.choices[0].message.content)
        name_to_find = name_payload.get("name_to_find")

        if not name_to_find:
            raise HTTPException(status_code=400, detail="Could not determine the data source name from your prompt.")

        result = await db.execute(
            select(CustomDataSchema)
            .where(CustomDataSchema.website_id == body.website_id)
            .where(CustomDataSchema.name == name_to_find)
        )
        existing_schema = result.scalars().first()

        if not existing_schema:
            raise HTTPException(status_code=404, detail=f"Data source '{name_to_find}' not found.")
            
        # ✅ **THE FIX YOU REQUESTED**
        # Step 2: Create the user_content for the main AI call, now including the schema.
        user_content = (
            f'PROMPT: "{body.prompt}"\n\n'
            f'UNIQUE_CLASS_NAME: `.{body.unique_class_name}`\n\n'
            f'SCHEMA_OF_DATA_TO_DISPLAY: {json.dumps(existing_schema.fields)}'
        )

        # Step 3: Call the main generator with the complete information.
        resp = openai.chat.completions.create(
            model=AI_DEFAULT_MODEL,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": VIEW_ONLY_GENERATOR_PROMPT},
                {"role": "user", "content": user_content},
            ],
            temperature=0.5,
            max_tokens=4096,
        )
        
        payload = json.loads(resp.choices[0].message.content)

        if isinstance(payload.get("script"), str):
            m = re.search(r"<script.*?>([\s\S]*?)</script>", payload["script"])
            if m:
                payload["script"] = m.group(1).strip()
        
        ai_response = AIViewOnlyResponseSchema(**payload)

        # Step 4: Assemble the final payload.
        final_properties = ai_response.properties
        final_properties["schema_id"] = str(existing_schema.schema_id)
        final_properties["originalType"] = "DATA_VIEW"

        final_payload = {
            "aiTemplate": f'<div class="{body.unique_class_name}">{ai_response.ai_template}</div>',
            "properties": final_properties,
            "editableProps": ai_response.editable_props,
            "script": ai_response.script,
        }
        
        usage = getattr(resp, "usage", None)
        prompt_tokens = int(getattr(usage, "prompt_tokens", 0) or 0)
        completion_tokens = int(getattr(usage, "completion_tokens", 0) or 0)
        model_used = getattr(resp, "model", AI_DEFAULT_MODEL)
        
        await track_ai_usage(
            db=db,
            website_id=body.website_id,
            user_id=user.id,
            model=model_used,
            feature="generate_data_app_view_only",
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            meta={"prompt_len": len(body.prompt)}
        )
        
        return final_payload

    except Exception as e:
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"AI View-Only generation failed: {e}")






#region refine_data_app
REFINE_DATA_APP_PROMPT = """
You are an expert full-stack developer, and your task is to refine an interactive data-driven component based on user feedback.
You will be given the user's prompt, the current JSON state of the component, and a list of all existing schemas on the website.

Your output MUST be a single, complete, valid JSON object representing the fully updated state.

**CRITICAL RULES:**
1.  **Use Context for Relationships:** When the user's prompt involves a related table (e.g., "show the project's due date"), you **MUST** use the `EXISTING_SCHEMAS_ON_WEBSITE` context to find the exact field IDs of the related schema and modify the `displayTemplate` or `script` accordingly.
2.  **Preserve Core Structure**: DO NOT change the `schema_id` or the `schema_fields` in the `properties` object. The database schema is fixed.
3.  **Apply User's Prompt**:
    -   For visual changes (colors, fonts, layout), modify the CSS in the `aiTemplate` and update the corresponding values in the `properties` object.
    -   For functional changes (e.g., "change the edit button to an icon"), modify the `aiTemplate` and the `script` accordingly.
    -   For text changes (e.g., "change the title to 'Manage Employees'"), update the value in the `properties` object.
4.  **Return the Complete Object**: Your final output must be the entire, valid JSON object for the component, including `aiTemplate`, `properties`, `editableProps`, and `script`.
""".strip()

@router.post("/refine-data-app-element", response_model=Dict[str, Any])
async def refine_data_app_element(
    body: RefineStateRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    try:
        if not body.website_id:
            raise HTTPException(status_code=400, detail="website_id is required")

        # --- STEP 1: FETCH EXISTING SCHEMAS FOR CONTEXT ---
        schema_result = await db.execute(
            select(CustomDataSchema)
            .where(CustomDataSchema.website_id == body.website_id)
        )
        existing_schemas = schema_result.scalars().all()
        schemas_for_prompt = [{"name": s.name, "schema_id": str(s.schema_id), "fields": s.fields} for s in existing_schemas]

        # --- STEP 2: BUILD THE CONTEXT-AWARE USER PROMPT ---
        user_content = (
            f'USER_PROMPT: "{body.prompt}"\n\n'
            f'CURRENT_COMPONENT_STATE:\n```json\n{json.dumps(body.currentState, indent=2)}\n```\n\n'
            f'EXISTING_SCHEMAS_ON_WEBSITE: {json.dumps(schemas_for_prompt)}'
        )

        # --- STEP 3: CALL OPENAI ---
        resp = openai.chat.completions.create(
            model=AI_DEFAULT_MODEL,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": REFINE_DATA_APP_PROMPT},
                {"role": "user", "content": user_content},
            ],
            temperature=0.2,
        )

        payload = json.loads(resp.choices[0].message.content)
        
        # --- (Usage tracking remains the same) ---
        usage = getattr(resp, "usage", None)
        prompt_tokens = int(getattr(usage, "prompt_tokens", 0) or 0)
        completion_tokens = int(getattr(usage, "completion_tokens", 0) or 0)
        model_used = getattr(resp, "model", AI_DEFAULT_MODEL)
        
        await track_ai_usage(
            db=db,
            website_id=body.website_id,
            user_id=user.id,
            model=model_used,
            feature="refine_data_app",
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            meta={"state_keys": list((body.currentState or {}).keys())[:10]},
        )

        return payload

    except Exception as e:
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Data App refinement failed: {e}")


