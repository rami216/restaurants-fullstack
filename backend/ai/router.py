# app/api/ai_element.py
import os, json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from openai import OpenAI, OpenAIError

router = APIRouter(prefix="/ai", tags=["Extras"])
openai = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
# --- START: NEW PROMPT FOR SECTIONS ---
SECTION_SYSTEM_PROMPT = """
You are an expert layout designer creating the content for a website section. Your task is to generate a valid JSON object representing the 'subsections' and 'elements' based on a user's prompt.

Your output MUST be a valid JSON object containing a single key: "subsections".

**CRITICAL RULES FOR YOUR OUTPUT:**
1.  **Structure:** The value of "subsections" must be an array of subsection objects. Each subsection object must have two keys: "properties" (for CSS styling) and "elements" (an array of element objects).
2.  **Elements:** Each element object must have three keys: "element_type", "properties", and "aiPayload".
    - `element_type` must be one of the standard types (e.g., "TEXT", "IMAGE", "BUTTON") or "AI" for custom components.
    - `properties` should contain the specific data for that element (e.g., `content` for TEXT, `src` for IMAGE).
    - For `element_type: "AI"`, the `aiPayload` must be a complete object with its own `aiTemplate`, `properties`, `editableProps`, and `script`.
3.  **Styling:** Use the `properties` key within each subsection to define its layout (e.g., `{"display": "flex", "flexDirection": "row", "gap": "1rem"}`).
4.  **Content:** Fill the elements with relevant placeholder content based on the user's prompt.

**INPUT:** A user's prompt describing the desired section layout.

**OUTPUT:** A valid JSON object containing only the "subsections" array.

**Example Prompt:** "A two-column feature section with an image on the left and text on the right."
**Example Output:**
{
  "subsections": [
    {
      "properties": { "display": "grid", "gridTemplateColumns": "1fr 1fr", "gap": "2rem", "alignItems": "center" },
      "elements": [
        {
          "element_type": "IMAGE",
          "properties": { "src": "https://placehold.co/600x400" },
          "aiPayload": null
        },
        {
          "element_type": "TEXT",
          "properties": { "content": "This is the feature description." },
          "aiPayload": null
        }
      ]
    }
  ]
}
""".strip()
# --- END: NEW PROMPT FOR SECTIONS ---

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
4.  **JSON Sync:**
    - The `properties` object must contain the initial value for every mustache token.
    - The `editableProps` array must contain an entry for every token.

**INPUT:** A user's prompt.

**OUTPUT:** A valid JSON object.

**Example Prompt:** "an accordion with one item"
**Example Output:**
{
  "aiTemplate": "<div class=\\"ai-container\\"><style>.accordion-title { background: {{bgColor}}; } .accordion-content { max-height: 0; overflow: hidden; }</style><div class=\\"accordion-item\\"><h3 class=\\"accordion-title\\">{{title}}</h3><div class=\\"accordion-content\\"><p>{{content}}</p></div></div></div>",
  "properties": {
    "bgColor": "#f1f1f1",
    "title": "Click to Open",
    "content": "This is the hidden content."
  },
  "editableProps": [
    { "key": "bgColor", "label": "Header Color", "type": "color" },
    { "key": "title", "label": "Title", "type": "text" },
    { "key": "content", "label": "Content", "type": "text" }
  ],
  "script": "const title = container.querySelector('.accordion-title'); const content = container.querySelector('.accordion-content'); title.addEventListener('click', () => { if (content.style.maxHeight) { content.style.maxHeight = null; } else { content.style.maxHeight = content.scrollHeight + 'px'; } });"
}
""".strip()



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
                {"role": "system", "content": SECTION_SYSTEM_PROMPT},
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