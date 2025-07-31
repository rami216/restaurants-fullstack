# app/api/ai_element.py
import os, json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from openai import OpenAI, OpenAIError
from typing import Dict, Any

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


# PREVIOUS_WORKING_SYSTEM_PROMPT = """
# You are an expert front-end developer creating a single, self-contained, and interactive HTML element.

# Your output MUST be a valid JSON object with FOUR keys: "aiTemplate", "properties", "editableProps", and "script".

# **CRITICAL RULES FOR YOUR OUTPUT:**
# 1.  **HTML Structure:** The HTML must be wrapped in a single container `<div>`. Use unique class names for elements that need interactivity.
# 2.  **Styling:** All CSS must be in a single `<style>` tag. Use mustache tokens `{{...}}` for all editable values (colors, sizes, etc.).
# 3.  **Interactivity (`script` key):**
#     - Provide a JavaScript string that adds event listeners to the HTML.
#     - The script will be executed inside a function that receives the container element as an argument, like `function(container) { ... }`.
#     - Use `container.querySelector('.your-class')` to find and manipulate elements.
#     - **DO NOT** wrap your code in a `<script>` tag. Provide only the raw JavaScript.
# 4.  **JSON Sync:**
#     - The `properties` object must contain the initial value for every mustache token.
#     - The `editableProps` array must contain an entry for every token.

# **INPUT:** A user's prompt.

# **OUTPUT:** A valid JSON object.

# **Example Prompt:** "an accordion with one item"
# **Example Output:**
# {
#   "aiTemplate": "<div class=\\"ai-container\\"><style>.accordion-title { background: {{bgColor}}; } .accordion-content { max-height: 0; overflow: hidden; }</style><div class=\\"accordion-item\\"><h3 class=\\"accordion-title\\">{{title}}</h3><div class=\\"accordion-content\\"><p>{{content}}</p></div></div></div>",
#   "properties": {
#     "bgColor": "#f1f1f1",
#     "title": "Click to Open",
#     "content": "This is the hidden content."
#   },
#   "editableProps": [
#     { "key": "bgColor", "label": "Header Color", "type": "color" },
#     { "key": "title", "label": "Title", "type": "text" },
#     { "key": "content", "label": "Content", "type": "text" }
#   ],
#   "script": "const title = container.querySelector('.accordion-title'); const content = container.querySelector('.accordion-content'); title.addEventListener('click', () => { if (content.style.maxHeight) { content.style.maxHeight = null; } else { content.style.maxHeight = content.scrollHeight + 'px'; } });"
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
                {"role": "system", "content": TEST_SYSTEM_PROMPT},
                {"role": "user",   "content": body.prompt},
            ],
            temperature=0.4,
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
class CssGenRequest(BaseModel):
    prompt: str
    html_context: str

CSS_GEN_SYSTEM_PROMPT = """
You are an expert CSS generator. Your task is to write a small snippet of CSS code based on a user's prompt and the provided HTML.

You will receive a user's prompt and the HTML of the element to be styled.
Your task is to write ONLY the CSS rule needed to achieve the user's request.
Do not include <style> tags or explanations. Just the raw CSS.
Example Prompt: "make the card glow on hover"
Example HTML: `<div class="card">...</div>`
Your Response: `.card:hover { box-shadow: 0 0 15px 5px rgba(138, 43, 226, 0.7); }`
""".strip()

@router.post("/generate-element-css")
async def generate_element_css(body: CssGenRequest):
    try:
        user_content = f"PROMPT: \"{body.prompt}\"\n\nHTML CONTEXT:\n```{body.html_context}```"
        resp = openai.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": CSS_GEN_SYSTEM_PROMPT},
                {"role": "user",   "content": user_content},
            ]
        )
        css_snippet = resp.choices[0].message.content.strip().replace("```css", "").replace("```", "")
    except (OpenAIError, json.JSONDecodeError) as e:
        raise HTTPException(500, f"CSS generation failed: {e}")
    return {"css": css_snippet}




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