# ai/utils.py
import openai as openai_lib
import anthropic
from website_builder.models import Website
from fastapi import HTTPException

def get_ai_client(website, provider_override=None):
    provider = provider_override or website.preferred_ai_provider or "openai"
    
    if provider == "openai":
        if not website.user_openai_key:
            raise HTTPException(400, "No OpenAI API key configured. Go to Settings → AI Provider to add your key.")
        client = openai_lib.OpenAI(api_key=website.user_openai_key)
        model = website.user_openai_model or "gpt-4o"
        return client, model, "openai"
    
    elif provider == "claude":
        if not website.user_claude_key:
            raise HTTPException(400, "No Claude API key configured. Go to Settings → AI Provider to add your key.")
        client = anthropic.Anthropic(api_key=website.user_claude_key)
        model = website.user_claude_model or "claude-sonnet-4-6"
        return client, model, "claude"
    
    elif provider == "gemini":
        if not website.user_gemini_key:
            raise HTTPException(400, "No Gemini API key configured. Go to Settings → AI Provider to add your key.")
        client = openai_lib.OpenAI(
            api_key=website.user_gemini_key,
            base_url="https://generativelanguage.googleapis.com/v1beta/openai/"
        )
        model = website.user_gemini_model or "gemini-2.0-flash"
        return client, model, "gemini"
    
    else:
        raise HTTPException(400, "No AI provider configured. Go to Settings → AI Provider to set up your key.")