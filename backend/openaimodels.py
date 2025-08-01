import os
from dotenv import load_dotenv
import openai

# 1) Load .env
load_dotenv()
openai.api_key = os.getenv("OPENAI_API_KEY")
if not openai.api_key:
    raise ValueError("OPENAI_API_KEY not set in environment or .env")

def list_models():
    # 2) Fetch the models page
    resp = openai.models.list()

    # 3a) If the response has a .data list, use it; otherwise, iterate
    models = getattr(resp, "data", None)
    if models is None:
        models = list(resp)

    # 4) Print their IDs
    model_ids = [m.id for m in models]
    print("Available models:", model_ids)

if __name__ == "__main__":
    list_models()
