# app/api/ai_element.py
import os, json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from openai import OpenAI, OpenAIError
from typing import Dict, Any, List, Optional
import re

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

SYSTEM_PROMPT = """
You are an expert front-end developer creating a single, self-contained, and interactive HTML element.

Your output MUST be a valid JSON object with FOUR keys: "aiTemplate", "properties", "editableProps", and "script".

**CRITICAL RULES FOR YOUR OUTPUT:**
1.  **HTML Structure:** The HTML must be wrapped in a single container `<div>`. Use unique class names for elements that need interactivity.
2.  **Styling:** All CSS must be in a single `<style>` tag. Use mustache tokens `{{...}}` for all editable values (colors, sizes, etc.).
3.  **Interactivity (`script` key):**
    - Provide a JavaScript string that adds event listeners to the HTML.
    - The script will be executed inside a function that receives the container element as an argument, like `function(container) { ... }`.
    - Use `container.querySelector('.your-class')` to find and manipulate elements.
    - **DO NOT** wrap your code in a `<script>` tag. Provide only the raw JavaScript.
    
     - ### **IMPORTANT JAVASCRIPT SYNTAX RULE:** - If you need to define any helper functions, you **MUST** use **function expressions** (arrow functions are best), not function declarations.
    - **Correct:** `const myFunc = () => { /* logic */ };`
    - **Incorrect:** `function myFunc() { /* logic */ };`
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

# @router.post("/generate-ai-element")
# async def generate_ai_element(body: GenerateRequest):
#     try:
#         resp = openai.chat.completions.create(
#             model="gpt-4o-mini", # Swapped to a more recent model name
#             response_format={"type": "json_object"},
#             messages=[
#                 {"role": "system", "content": SYSTEM_PROMPT},
#                 {"role": "user",   "content": body.prompt},
#             ],
#             temperature=0.2,
#             max_tokens=4095,
#         )
#         content = resp.choices[0].message.content
#         payload = json.loads(content)

#         # ✨ --- ADDED: Clean the script field --- ✨
#         if "script" in payload and isinstance(payload["script"], str):
#             # Search for content inside a <script> tag
#             match = re.search(r"<script.*?>([\s\S]*?)</script>", payload["script"])
#             if match:
#                 # If found, replace the value with the extracted raw JS
#                 payload["script"] = match.group(1).strip()
#         # ✨ --- End of cleaning logic --- ✨

#     except (OpenAIError, json.JSONDecodeError, KeyError) as e:
#         raise HTTPException(500, f"Generation failed: {e}")

#     return payload

class GenerateRequestForElement(BaseModel):
    prompt: str
    unique_class_name: str
    
@router.post("/generate-ai-element")
async def generate_ai_element(body: GenerateRequestForElement):
    try:
        # --- Includes the unique_class_name for the AI ---
        user_content = (
            f'PROMPT: "{body.prompt}"\n\n'
            f'UNIQUE_CLASS_NAME: `.{body.unique_class_name}`'
        )

        resp = openai.chat.completions.create(
            model="gpt-4o",
            response_format={ "type": "json_object" },
            messages=[
                {"role": "system", "content": NEW_SYSTEM_PROMPT},
                {"role": "user",   "content": user_content},
            ],
            temperature=0.2,
            max_tokens=4096,
        )
        content = resp.choices[0].message.content
        payload = json.loads(content)

        # --- Includes the script cleaning safety check ---
        if "script" in payload and isinstance(payload.get("script"), str):
            match = re.search(r"<script.*?>([\s\S]*?)</script>", payload["script"])
            if match:
                payload["script"] = match.group(1).strip()
        
    except (OpenAIError, json.JSONDecodeError, KeyError) as e:
        raise HTTPException(500, f"Page generation failed: {e}")

    return payload


#endregion generateelement
@router.post("/generate-ai-section")
async def generate_ai_section(body: GenerateRequest):
    try:
        resp = openai.chat.completions.create(
            model="gpt-4o",
            response_format={ "type": "json_object" },
            messages=[
                {"role": "system", "content": TEST_SECTION_SYSTEM_PROMPT},
                {"role": "user",   "content": body.prompt},
            ],
            temperature=0.8, # Higher temperature for more creative layouts
            max_tokens=4096,
        )
        content = resp.choices[0].message.content
        payload = json.loads(content)
    except (OpenAIError, json.JSONDecodeError) as e:
        raise HTTPException(500, f"Generation failed: {e}")
    return payload
  
  
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
# REFINE_MASTER_PROMPT = """
# You are an expert front-end component editor. Your job is to modify and repair a component's state based on a user's request.
# You will receive the user's prompt and a JSON object containing the component's current state.

# Your output MUST be a single, complete, valid JSON object with the fully updated state.

# **CRITICAL RULES:**

# 1.  **Repair Hardcoded Text (IMPORTANT)**: If you receive a component where the `aiTemplate` contains user-facing text, but the `properties` and `editableProps` for that text are missing, you **MUST** fix it. Extract the hardcoded text, replace it with a `{{mustache}}` variable in the `aiTemplate`, and add the corresponding entries to `properties` and `editableProps`.

#     * **Example of a BROKEN input you must fix:**
#     * `aiTemplate`: "<h3>Welcome to Beirut!</h3>"
#     * `properties`: {}
#     * `editableProps`: []
#     * **Your FIXED output should be:**
#     * `aiTemplate`: "<h3>{{headline}}</h3>"
#     * `properties`: { "headline": "Welcome to Beirut!" }
#     * `editableProps`: [{ "key": "headline", "label": "Headline", "type": "text" }]

# 2.  **Preserve Existing Data**: If the `editableProps` array is NOT empty, your highest priority is to preserve it. Do not add or remove props unless the user asks. When changing a color or font, modify the value in the `properties` object, NOT by hardcoding it.

# 3.  **Special Rule for Forms (Correct Position)**: If the component is a form, pay special attention to the `properties.fields` array which defines its structure. **Do not add, remove, or alter the items in this array** unless the user's prompt is explicitly about adding, removing, or changing a specific form field. Focus style changes on the `properties.style` or `properties.submitButton.style` objects.

# 4.  **Apply User's Prompt**: After repairing the component and reviewing the special rules, apply the user's requested change to the now-correct component state.

# 5.  **Final Output**: Return the complete, updated JSON object.
# """.strip()
# REFINE_MASTER_PROMPT = """
# You are an expert front-end component editor. Your job is to modify and repair a component's state based on a user's request.
# You will receive the user's prompt and a JSON object containing the component's current state.

# Your output MUST be a single, complete, valid JSON object with the fully updated state.

# **CRITICAL RULES:**

# 1.  **Dynamic Template Rule (MOST IMPORTANT)**: The `aiTemplate` MUST be dynamically linked to the `properties` object. When you modify a value in `properties` (e.g., `properties.style.color`), you **MUST** ensure the `aiTemplate` correctly uses the corresponding `{{mustache}}` token (e.g., `style="color: {{style.color}}"`). **Never hardcode style values in the template if a property for it exists.**

# 2.  **Repair Hardcoded Text**: If the `aiTemplate` contains user-facing text that is not in `properties`, you **MUST** fix it by creating the necessary `properties` and `editableProps`.

# 3.  **Preserve Editor Fields**: If the `editableProps` array is NOT empty, you MUST preserve it. Do not add or remove props unless the user explicitly asks.

# 4.  **Special Rule for Forms**: Be extra careful with the `properties.fields` array. Do not alter it unless the user prompt is specifically about changing the form's fields.

# 5.  **Apply User's Prompt**: After ensuring the component state is correct and dynamically linked, apply the user's requested change.

# 6.  **Final Output**: Return the complete, updated JSON object.
# """.strip()



@router.post("/refine-element", response_model=Dict[str, Any])
async def refine_element(body: RefineStateRequest):
    try:
        user_content = (
            f"USER_PROMPT: \"{body.prompt}\"\n\n"
            f"CURRENT_COMPONENT_STATE:\n```json\n{json.dumps(body.currentState, indent=2)}\n```"
        )

        resp = openai.chat.completions.create(
            model="gpt-4o",
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": REFINE_MASTER_PROMPT},
                {"role": "user",   "content": user_content},
            ],
            temperature=0.2,
        )

        content = resp.choices[0].message.content
        payload = json.loads(content)
        return payload

    except (OpenAIError, json.JSONDecodeError, KeyError) as e:
        raise HTTPException(500, f"Refine-element failed: {e}")


  #endregion
  
  
  #region refinesection
  
  # --- START: REFINE SECTION FEATURE ---

# 1. Pydantic model for the request
class RefineSectionRequest(BaseModel):
    prompt: str
    section_json: Dict[str, Any]

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
async def refine_ai_section(body: RefineSectionRequest):
    try:
        user_content = f"PROMPT: \"{body.prompt}\"\n\nCURRENT SECTION JSON:\n{json.dumps(body.section_json, indent=2)}"
        
        resp = openai.chat.completions.create(
            model="gpt-4o",
            response_format={ "type": "json_object" },
            messages=[
                {"role": "system", "content": REFINE_SECTION_SYSTEM_PROMPT},
                {"role": "user",   "content": user_content},
            ],
            temperature=0.5,
            max_tokens=4096,
        )
        payload = json.loads(resp.choices[0].message.content)
    except (OpenAIError, json.JSONDecodeError) as e:
        raise HTTPException(500, f"Section refinement failed: {e}")
    return payload

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
async def generate_ai_page(body: GenerateRequest):
    try:
        resp = openai.chat.completions.create(
            model="gpt-4o",
            response_format={ "type": "json_object" },
            messages=[
                {"role": "system", "content": PAGE_SYSTEM_PROMPT},
                {"role": "user",   "content": body.prompt},
            ],
            temperature=0.4,
            max_tokens=4096,
        )
        payload = json.loads(resp.choices[0].message.content)
    except (OpenAIError, json.JSONDecodeError) as e:
        raise HTTPException(500, f"Page generation failed: {e}")
    return payload

# --- END: NEW PAGE GENERATION FEATURE ---


#endregion pagegenerator