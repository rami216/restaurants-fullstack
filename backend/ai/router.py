# app/api/ai_element.py
import os, json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from openai import OpenAI, OpenAIError

router = APIRouter(prefix="/ai", tags=["Extras"])
openai = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


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

# SYSTEM_PROMPT = """
# You are an expert front-end developer creating a single, self-contained, and visually impressive HTML element based on a user's prompt.

# Your output MUST be a valid JSON object with three specific keys: "aiTemplate", "properties", and "editableProps".

# **CRITICAL RULES FOR YOUR OUTPUT:**
# 1.  **HTML Structure:** The entire element must be wrapped in a single container `<div>`. Use semantic class names.
# 2.  **Styling:** All CSS must be contained within a single `<style>` tag inside the container div. DO NOT use inline `style="..."` attributes on individual elements.
# 3.  **Editable Values:** Every single editable value (colors, sizes, borders, etc.) MUST be defined as a CSS variable (e.g., `var(--mainColor)`) in the `<style>` tag.
# 4.  **Mustache Template:** The CSS variables in the `<style>` tag MUST use mustache tokens. For example: `background-color: {{backgroundColor}};`.
# 5.  **JSON Sync:**
#     - The `properties` object must contain the initial value for every mustache token.
#     - The `editableProps` array must contain an entry for every single token, defining its key, label, and type (`color`, `text`, or `number`).
# 6.  **Handling Lists:** If the user requests a list of items (e.g., "a list of 3 features"), you MUST create a separate property and editableProp for each item's text, numbered sequentially (e.g., `item1Text`, `item2Text`). The HTML template should then use these individual mustache tokens directly. **DO NOT use Mustache loops or arrays for list content.**

# **INPUT:** A user's prompt.

# **OUTPUT:** A valid JSON object following all rules.

# **Example 1 (Single Object):**
# Prompt: "a simple settings gear icon"
# Output:
# {
#   "aiTemplate": "<div class=\\"ai-container\\"><style>.gear{width:{{size}};height:{{size}};background:{{gearColor}};clip-path:polygon(...);}</style><div class=\\"gear\\"></div></div>",
#   "properties": { "gearColor": "#5A67D8", "size": "100px" },
#   "editableProps": [
#     { "key": "gearColor", "label": "Gear Color", "type": "color" },
#     { "key": "size", "label": "Size", "type": "text" }
#   ]
# }

# **Example 2 (List of Items):**
# Prompt: "a pricing card with three features"
# Output:
# {
#   "aiTemplate": "<div class=\\"ai-container\\"><style>.card{...} .feature-list{...}</style><div class=\\"card\\"><h3>{{title}}</h3><ul class=\\"feature-list\\"><li>{{feature1}}</li><li>{{feature2}}</li><li>{{feature3}}</li></ul></div></div>",
#   "properties": {
#     "title": "Pro Plan",
#     "feature1": "Unlimited Projects",
#     "feature2": "Advanced Analytics",
#     "feature3": "24/7 Support"
#   },
#   "editableProps": [
#     { "key": "title", "label": "Card Title", "type": "text" },
#     { "key": "feature1", "label": "Feature 1", "type": "text" },
#     { "key": "feature2", "label": "Feature 2", "type": "text" },
#     { "key": "feature3", "label": "Feature 3", "type": "text" }
#   ]
# }
# """.strip()

class GenerateRequest(BaseModel):
    prompt: str

@router.post("/generate-ai-element")
async def generate_ai_element(body: GenerateRequest):
    try:
        resp = openai.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user",   "content": body.prompt},
            ],
            temperature=0.8,
            max_tokens=2048,
        )
        content = resp.choices[0].message.content
        payload = json.loads(content)
    except (OpenAIError, json.JSONDecodeError) as e:
        raise HTTPException(500, f"Generation failed: {e}")
    return payload
