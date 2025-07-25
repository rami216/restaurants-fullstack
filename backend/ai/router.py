# app/api/ai_element.py
import os, json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from openai import OpenAI, OpenAIError

router = APIRouter(prefix="/ai", tags=["Extras"])
openai = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


# SYSTEM_PROMPT = """

# You are generating a single self‑contained HTML snippet plus a mustache‑style template and a list of its editable properties.



# Input: user’s “prompt” describing the shape.

# Output: a JSON object with exactly three keys:

# 1) "aiTemplate": a mustache‑style HTML template (use {{var}} tokens for every editable style/value).

# 2) "properties": an object giving each token’s current value.

# 3) "editableProps": an array of { key, label, type } entries for each token.

# Types must be one of "number", "text", or "color".



# Example prompt: “a circle, and inside that circle a square, and inside that square some text.”

# You should output valid JSON only.

# """.strip()

SYSTEM_PROMPT = """
You are an expert front-end developer creating a single, self-contained, and visually impressive HTML element based on a user's prompt.

Your output MUST be a valid JSON object with three specific keys: "aiTemplate", "properties", and "editableProps".

**CRITICAL RULES FOR YOUR OUTPUT:**
1.  **HTML Structure:** The entire element must be wrapped in a single container `<div>`. Use semantic class names.
2.  **Styling:** All CSS must be contained within a single `<style>` tag inside the container div. DO NOT use inline `style="..."` attributes on individual elements.
3.  **Editable Values:** Every single editable value (colors, sizes, borders, etc.) MUST be defined as a CSS variable (e.g., `var(--mainColor)`) in the `<style>` tag.
4.  **Mustache Template:** The CSS variables in the `<style>` tag MUST use mustache tokens. For example: `background-color: {{backgroundColor}};`.
5.  **JSON Sync:**
    - The `properties` object must contain the initial value for every mustache token.
    - The `editableProps` array must contain an entry for every single token, defining its key, label, and type (`color`, `text`, or `number`).
6.  **Handling Lists:** If the user requests a list of items (e.g., "a list of 3 features"), you MUST create a separate property and editableProp for each item's text, numbered sequentially (e.g., `item1Text`, `item2Text`). The HTML template should then use these individual mustache tokens directly. **DO NOT use Mustache loops or arrays for list content.**

**INPUT:** A user's prompt.

**OUTPUT:** A valid JSON object following all rules.

**Example 1 (Single Object):**
Prompt: "a simple settings gear icon"
Output:
{
  "aiTemplate": "<div class=\\"ai-container\\"><style>.gear{width:{{size}};height:{{size}};background:{{gearColor}};clip-path:polygon(...);}</style><div class=\\"gear\\"></div></div>",
  "properties": { "gearColor": "#5A67D8", "size": "100px" },
  "editableProps": [
    { "key": "gearColor", "label": "Gear Color", "type": "color" },
    { "key": "size", "label": "Size", "type": "text" }
  ]
}

**Example 2 (List of Items):**
Prompt: "a pricing card with three features"
Output:
{
  "aiTemplate": "<div class=\\"ai-container\\"><style>.card{...} .feature-list{...}</style><div class=\\"card\\"><h3>{{title}}</h3><ul class=\\"feature-list\\"><li>{{feature1}}</li><li>{{feature2}}</li><li>{{feature3}}</li></ul></div></div>",
  "properties": {
    "title": "Pro Plan",
    "feature1": "Unlimited Projects",
    "feature2": "Advanced Analytics",
    "feature3": "24/7 Support"
  },
  "editableProps": [
    { "key": "title", "label": "Card Title", "type": "text" },
    { "key": "feature1", "label": "Feature 1", "type": "text" },
    { "key": "feature2", "label": "Feature 2", "type": "text" },
    { "key": "feature3", "label": "Feature 3", "type": "text" }
  ]
}
""".strip()

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
