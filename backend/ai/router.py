# app/api/ai_element.py
import os, json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
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



# TEST_SYSTEM_PROMPT_previous = """
# You are an expert front-end developer creating a single, self-contained, and interactive HTML element.

# Your output MUST be a valid JSON object with FOUR keys: "aiTemplate", "properties", "editableProps", and "script".

# **CRITICAL RULES FOR YOUR OUTPUT:**
# 1.  **HTML Structure:** The HTML must be wrapped in a single container `<div>`. Use unique class names for elements that need interactivity.
# 2.  **Styling:** All CSS must be in a single `<style>` tag. Use mustache tokens `{{...}}` for all editable values (colors, sizes, etc.).
# 3.  **Interactivity (`script` key):** Provide a JavaScript string that adds event listeners. The script will be executed inside a function that receives the container element as an argument, like `function(container) { ... }`.
# 4.  **JSON Sync & Editable Content (MOST IMPORTANT RULE):**
#     -   You **MUST** make the component fully editable. Go through the HTML in your `aiTemplate` and find **EVERY** piece of text a user would want to change (all headings, titles, paragraphs, button text, etc.).
#     -   **NO user-facing text should be hardcoded in the `aiTemplate`**.
#     -   Replace each piece of editable text and style with a unique mustache token (e.g., `{{card1Title}}`, `{{card1Content}}`, `{{buttonColor}}`).
#     -   For **every single token** you create, you **MUST** add a corresponding entry in both the `properties` object (with an initial value) and the `editableProps` array (with a key, label, and type). There are no exceptions.

# **INPUT:** A user's prompt.
# **OUTPUT:** A valid JSON object.

# **Example Prompt:** "an accordion with two items"
# **Example Output:**
# {
#   "aiTemplate": "<div class=\\"ai-container\\"><style>...</style><div class=\\"accordion-item\\"><h3 class=\\"accordion-title\\">{{title1}}</h3><div class=\\"accordion-content\\"><p>{{content1}}</p></div></div><div class=\\"accordion-item\\"><h3 class=\\"accordion-title\\">{{title2}}</h3><div class=\\"accordion-content\\"><p>{{content2}}</p></div></div></div>",
#   "properties": { "title1": "Question 1", "content1": "Answer 1.", "title2": "Question 2", "content2": "Answer 2." },
#   "editableProps": [
#     { "key": "title1", "label": "Title 1", "type": "text" },
#     { "key": "content1", "label": "Content 1", "type": "text" },
#     { "key": "title2", "label": "Title 2", "type": "text" },
#     { "key": "content2", "label": "Content 2", "type": "text" }
#   ],
#   "script": "const titles = container.querySelectorAll('.accordion-title'); titles.forEach(title => { title.addEventListener('click', () => { const content = title.nextElementSibling; if (content.style.maxHeight) { content.style.maxHeight = null; } else { content.style.maxHeight = content.scrollHeight + 'px'; } }); });"
# }
# """.strip()
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

class GenerateRequest(BaseModel):
    prompt: str

@router.post("/generate-ai-element")
async def generate_ai_element(body: GenerateRequest):
    try:
        resp = openai.chat.completions.create(
            model="gpt-4.1-mini",
            response_format={ "type": "json_object" },
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user",   "content": body.prompt},
            ],
            temperature=0.2, # <-- LOWER THIS VALUE
            max_tokens=4095,
        )
        content = resp.choices[0].message.content
        payload = json.loads(content)
    except (OpenAIError, json.JSONDecodeError) as e:
        raise HTTPException(500, f"Generation failed: {e}")
    return payload

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

class RefineRequest(BaseModel):
    prompt: str
    full_template: str
    unique_class_name: str

class RefineResponse(BaseModel):
    template: str
    script: Optional[str]

REFINE_SYSTEM_PROMPT = """
You are a combined HTML, CSS, and JavaScript editor.
You will receive:
  • A user prompt describing exactly what they want.
  • The full existing template, which may include:
    - A <style> block
    - HTML markup
    - <script> tags
  • A unique class name for scoping.

Return ONLY the updated snippet—any <style>…</style>, HTML, and <script>…</script>.
""".strip()

@router.post("/refine-element", response_model=RefineResponse)
async def refine_element(body: RefineRequest):
    try:
        # assemble the user prompt
        user_content = (
            f"PROMPT: \"{body.prompt}\"\n\n"
            f"EXISTING_TEMPLATE:\n```html\n{body.full_template}\n```\n\n"
            f"UNIQUE_CLASS_NAME: `{body.unique_class_name}`"
        )

        # call OpenAI
        resp = openai.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": REFINE_SYSTEM_PROMPT},
                {"role": "user",   "content": user_content},
            ],
            temperature=0.2,
        )
        raw = resp.choices[0].message.content

        # 1) strip any ```html fences
        cleaned = re.sub(r"^```(?:html)?\s*\n?", "", raw)
        cleaned = re.sub(r"\n?```$", "", cleaned)

        # 2) extract <script> blocks
        script_re   = r"<script[\s\S]*?</script>"
        scripts     = re.findall(script_re, cleaned)
        template_only = re.sub(script_re, "", cleaned).strip()
        script_only   = "\n".join(scripts) if scripts else None

    except (OpenAIError, re.error) as e:
        raise HTTPException(500, f"Refine-element failed: {e}")

    return RefineResponse(template=template_only, script=script_only)

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
            temperature=0.8,
            max_tokens=4096,
        )
        payload = json.loads(resp.choices[0].message.content)
    except (OpenAIError, json.JSONDecodeError) as e:
        raise HTTPException(500, f"Page generation failed: {e}")
    return payload

# --- END: NEW PAGE GENERATION FEATURE ---


#endregion pagegenerator