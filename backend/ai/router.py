# app/api/ai_element.py
import os, json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from openai import OpenAI, OpenAIError

router = APIRouter(prefix="/ai", tags=["Extras"])
openai = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

SYSTEM_PROMPT = """
You are generating a single self‑contained HTML snippet plus a mustache‑style template and a list of its editable properties.

Input: user’s “prompt” describing the shape.
Output: a JSON object with exactly three keys:
1) "aiTemplate": a mustache‑style HTML template (use {{var}} tokens for every editable style/value).
2) "properties": an object giving each token’s current value.
3) "editableProps": an array of { key, label, type } entries for each token.
Types must be one of "number", "text", or "color".

Example prompt: “a circle, and inside that circle a square, and inside that square some text.”
You should output valid JSON only.
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
