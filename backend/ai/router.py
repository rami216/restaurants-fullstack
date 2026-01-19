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
    - **FORMS:** If creating a form, use `<form>`. **DO NOT** add `action=""` or `method=""` attributes. We handle submission purely via JavaScript.

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
        - Provide a JavaScript string executed inside a function `(container, api, schemaId, properties, Mustache)`.
        - **Use `container.querySelector`** (NOT document.querySelector).
        - **Do NOT** wrap code in `<script>`.
        - **Use function expressions** (`const x = () => {}`).
        - **STRICT RULE:** DO NOT include `alert()`, `console.log()`, or any placeholder popups.
        - **MANDATORY SCRIPT RULE:** If your `aiTemplate` contains a `<form>`, the `script` key **MUST NOT** be empty. You **MUST** write a script to handle the submission.
        - **CRITICAL FORM RULE:** If interacting with a form, the `onsubmit` handler **MUST** start with `e.preventDefault();` as the very first line. If this is missing, the page will reload and the app will fail.

**4.  JSON Sync & Editable Content (MOST IMPORTANT RULE):**
    - You **MUST** make the component fully editable. Go through the HTML in your `aiTemplate` and find **EVERY** piece of text a user would want to change (all headings, titles, paragraphs, button text, etc.).
    - **NO user-facing text should be hardcoded in the `aiTemplate`**.
    - Replace each piece of editable text and style with a unique mustache token (e.g., `{{card1Title}}`, `{{card1Content}}`, `{{buttonColor}}`).
    - For **every single token** you create, you **MUST** add a corresponding entry in both the `properties` object (with an initial value) and the `editableProps` array (with a key, label, and type). There are no exceptions.

**5.  DATA LOGIC (How to connect to the database):**
    - You will see a list called `EXISTING_SCHEMAS_ON_WEBSITE`.

    - This element MAY:
        - Create rows in any existing schema
        - Read rows from any existing schema
        - Update rows in any existing schema
        - Delete rows from any existing schema
        - Use multiple schemas in the same component

    - This element MUST NEVER:
        - Create schemas
        - Invent schemas
        - Guess schema IDs

    - **IF** the user wants to save/load/update/delete data:
        1. You MUST find the correct `schema_id` from `EXISTING_SCHEMAS_ON_WEBSITE`
        2. You MUST write the correct API call in the script.

    - Allowed API operations:

        **Create:**
        `await api.post('/custom-data/rows/' + SCHEMA_ID, { data: rowData, sitemember_id: null });`

        **Read (List & Render):**
        `const res = await api.get('/custom-data/rows/' + SCHEMA_ID + '?limit=50');`
        - **CRITICAL:** The response data is in `res.data.rows`.
        - **RENDER LOGIC:** You MUST manually loop through `res.data.rows`, generate HTML strings, and inject them into a container using `innerHTML`.

        **Update:**
        `await api.put('/custom-data/rows/' + SCHEMA_ID + '/' + ROW_ID, { data: updatedData });`

        **Delete:**
        `await api.delete('/custom-data/rows/' + SCHEMA_ID + '/' + ROW_ID);`

    - You MAY read from one table and write/update/delete in another table.

    - **Field names in forms MUST match column names in the schema exactly.**
    - **FILE & IMAGE UPLOADS (CRITICAL):**
    - If the user implies uploading a file (e.g., "Job Application with CV", "Upload Profile Pic"):
        1.  In `aiTemplate`, render an `<input type="file" id="file_field_id">`.
        2.  **CRITICAL:** Render a `<input type="hidden" name="SCHEMA_COLUMN_NAME">` right next to it. This hidden input will hold the final URL sent to the database.
        3.  In `script`, you **MUST** generate this exact listener logic for the file input:
            ```javascript
            const fileInput = container.querySelector('input[type="file"]'); 
            const hiddenInput = container.querySelector('input[type="hidden"][name="SCHEMA_COLUMN_NAME"]');
            
            if(fileInput) {
                fileInput.onchange = async (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    
                    const btn = container.querySelector('button[type="submit"]') || container.querySelector('button');
                    const oldText = btn ? btn.innerText : 'Submit';
                    
                    if(btn) { btn.disabled = true; btn.innerText = 'Uploading...'; }
                    
                    try {
                        const formData = new FormData();
                        formData.append('file', file);
                        const res = await api.post('/uploads/', formData);
                        const url = res.data ? res.data.url : res.url;
                        if (url) {
                            hiddenInput.value = url;
                            const msg = document.createElement('span');
                            msg.className = 'text-xs text-green-600 block mt-1';
                            msg.innerText = '✓ Ready';
                            if(fileInput.nextSibling?.className?.includes('text-green-600')) fileInput.nextSibling.remove();
                            fileInput.parentNode.insertBefore(msg, fileInput.nextSibling);
                        }
                    } catch(err) {
                        console.error('Upload error:', err);
                        alert('Upload failed');
                        fileInput.value = '';
                    } finally {
                        if(btn) { btn.disabled = false; btn.innerText = oldText; }
                    }
                };
            }
            ```
        4.  **AND CRITICAL:** You **MUST ALSO** generate the standard `form.onsubmit` handler (as defined in Rule 3) to save the final data row (including the hidden input value) to the database.


    - **WHEN TO IGNORE SCHEMAS:**
        - ONLY ignore schemas if the user explicitly asks for a **STATIC** visual element (e.g., "Hero Section", "Pricing Card", "Footer"). 
        - If it is a FORM, you MUST use a schema and WRITE A SCRIPT.


---
**INPUT:** A user's prompt and a `unique_class_name`.
**OUTPUT:** A valid JSON object.

**Example Prompt:** "an accordion with two items"
**Example `unique_class_name`:** `.ai-accordion-12345`

### **EXAMPLE 1: Data Element (Data-Connected Form)**
**Prompt:** "A newsletter form that saves email to Subscribers"
**Output:**
{
  "aiTemplate": "<div class=\"ai-newsletter-123\"><style>.ai-newsletter-123 form { background: {{bgColor}}; padding: {{padding}}; border-radius: {{borderRadius}}; box-shadow: {{boxShadow}}; width: 100%; max-width: {{maxWidth}}; }</style><form><input name=\"email\" placeholder=\"{{placeholderText}}\" class=\"p-2 border w-full mb-2 rounded\" required><button type=\"submit\" style=\"background:{{btnColor}}; color:{{btnTextColor}}; border-radius:{{btnRadius}}\" class=\"p-2 w-full font-bold\">{{btnText}}</button></form></div>",
  "properties": { 
    "bgColor": "#ffffff", 
    "padding": "24px", 
    "borderRadius": "12px", 
    "boxShadow": "0 4px 6px rgba(0,0,0,0.1)", 
    "maxWidth": "400px", 
    "placeholderText": "Enter your email...", 
    "btnColor": "#2563eb", 
    "btnTextColor": "#ffffff", 
    "btnRadius": "6px", 
    "btnText": "Subscribe" 
  },
  "editableProps": [
    { "key":"bgColor", "label":"Background", "type":"color" },
    { "key":"padding", "label":"Padding", "type":"text" },
    { "key":"borderRadius", "label":"Radius", "type":"text" },
    { "key":"boxShadow", "label":"Shadow", "type":"text" },
    { "key":"maxWidth", "label":"Max Width", "type":"text" },
    { "key":"placeholderText", "label":"Placeholder", "type":"text" },
    { "key":"btnColor", "label":"Button Color", "type":"color" },
    { "key":"btnTextColor", "label":"Button Text Color", "type":"color" },
    { "key":"btnText", "label":"Button Text", "type":"text" }
  ],
  "script": "const form = container.querySelector('form'); const statusEl = container.querySelector('.form-status'); const btn = form ? form.querySelector('button[type=\"submit\"]') : null; if (form && statusEl && btn) { form.onsubmit = async (e) => { e.preventDefault(); const data = {}; new FormData(form).forEach((v, k) => data[k] = v); btn.disabled = true; statusEl.textContent = properties.statusLoadingText; try { await api.post('/custom-data/rows/SUBSCRIBERS_SCHEMA_ID', { data, sitemember_id: null }); statusEl.textContent = properties.statusSuccessText; form.reset(); } catch (err) { statusEl.textContent = properties.statusErrorText; } finally { btn.disabled = false; } }; }"

}

### **EXAMPLE 2: Visual Element (Highly Customizable Accordion)**
**Prompt:** "An accordion with 2 items"
**Output:**
{
  "aiTemplate": "<div class=\\"ai-accordion-12345\\"><style>.ai-accordion-12345{width:100%;max-width:{{maxWidth}};font-family:{{fontFamily}}}.ai-accordion-12345 .accordion-item{border:{{borderWidth}} solid {{borderColor}};margin-bottom:{{itemGap}};border-radius:{{borderRadius}};overflow:hidden;box-shadow:{{boxShadow}};background:{{itemBgColor}}}.ai-accordion-12345 .accordion-title{background:{{titleBgColor}};color:{{titleTextColor}};padding:{{titlePadding}};font-size:{{titleFontSize}};font-weight:{{titleFontWeight}};cursor:pointer;transition:{{transitionSpeed}};display:flex;justify-content:space-between;align-items:center}.ai-accordion-12345 .accordion-title:hover{background:{{titleHoverBg}}}.ai-accordion-12345 .accordion-content{background:{{contentBgColor}};color:{{contentTextColor}};padding:{{contentPadding}};display:none;font-size:{{contentFontSize}};line-height:{{contentLineHeight}}}</style><div class=\\"accordion-item\\"><div class=\\"accordion-title\\">{{title1}} <span>+</span></div><div class=\\"accordion-content\\">{{content1}}</div></div><div class=\\"accordion-item\\"><div class=\\"accordion-title\\">{{title2}} <span>+</span></div><div class=\\"accordion-content\\">{{content2}}</div></div></div>",
  "properties": {
    "title1": "Question 1", "content1": "Answer 1 text goes here.",
    "title2": "Question 2", "content2": "Answer 2 text goes here.",
    "maxWidth": "600px", "fontFamily": "inherit", "itemGap": "10px",
    "borderWidth": "1px", "borderColor": "#e5e7eb", "borderRadius": "8px", "boxShadow": "0 2px 4px rgba(0,0,0,0.05)", "itemBgColor": "#ffffff",
    "titleBgColor": "#f9fafb", "titleHoverBg": "#f3f4f6", "titleTextColor": "#111827", "titlePadding": "16px", "titleFontSize": "16px", "titleFontWeight": "600", "transitionSpeed": "0.2s",
    "contentBgColor": "#ffffff", "contentTextColor": "#4b5563", "contentPadding": "16px", "contentFontSize": "14px", "contentLineHeight": "1.5"
  },
  "editableProps": [
    { "key":"title1", "label":"Title 1", "type":"text" }, { "key":"content1", "label":"Content 1", "type":"text" },
    { "key":"title2", "label":"Title 2", "type":"text" }, { "key":"content2", "label":"Content 2", "type":"text" },
    { "key":"maxWidth", "label":"Max Width", "type":"text" },
    { "key":"itemGap", "label":"Gap Between Items", "type":"text" },
    { "key":"borderWidth", "label":"Border Width", "type":"text" },
    { "key":"borderColor", "label":"Border Color", "type":"color" },
    { "key":"borderRadius", "label":"Border Radius", "type":"text" },
    { "key":"boxShadow", "label":"Box Shadow", "type":"text" },
    { "key":"titleBgColor", "label":"Title Background", "type":"color" },
    { "key":"titleHoverBg", "label":"Title Hover Background", "type":"color" },
    { "key":"titleTextColor", "label":"Title Text Color", "type":"color" },
    { "key":"titleFontSize", "label":"Title Font Size", "type":"text" },
    { "key":"titleFontWeight", "label":"Title Font Weight", "type":"text" },
    { "key":"titlePadding", "label":"Title Padding", "type":"text" },
    { "key":"contentBgColor", "label":"Content Background", "type":"color" },
    { "key":"contentTextColor", "label":"Content Text Color", "type":"color" },
    { "key":"contentFontSize", "label":"Content Font Size", "type":"text" },
    { "key":"contentPadding", "label":"Content Padding", "type":"text" }
  ],
  "script": "const titles = container.querySelectorAll('.accordion-title'); titles.forEach(t => t.addEventListener('click', () => { const c = t.nextElementSibling; const isOpen = c.style.display === 'block'; c.style.display = isOpen ? 'none' : 'block'; t.querySelector('span').textContent = isOpen ? '+' : '-'; }));"
}

### **EXAMPLE 3: Form with File Upload (CRITICAL PATTERN)**
**Prompt:** "A Job Application form with Name and CV upload"
**Output:**
{
  "aiTemplate": "<div class=\"ai-job-app-555\"><style>.ai-job-app-555 form{padding:{{padding}};background:{{bgColor}}}.ai-job-app-555 input{width:100%;margin-bottom:10px;padding:8px;border:1px solid #ccc}.ai-job-app-555 button{background:{{btnColor}};color:white;padding:10px;width:100%}</style><form><h3>Apply Now</h3><input type=\"text\" name=\"name\" placeholder=\"Your Name\" required><label>Upload CV:</label><input type=\"file\" id=\"cv_upload\"><input type=\"hidden\" name=\"cv\"><button type=\"submit\">{{btnText}}</button></form></div>",
  "properties": { "padding": "20px", "bgColor": "#f9f9f9", "btnColor": "#000000", "btnText": "Submit Application" },
  "editableProps": [ { "key": "btnText", "label": "Button Text", "type": "text" }, { "key": "btnColor", "label": "Button Color", "type": "color" } ],
  "script": "const form = container.querySelector('form'); const fileInput = container.querySelector('input[type=\"file\"]'); const hiddenInput = container.querySelector('input[type=\"hidden\"][name=\"cv\"]'); const btn = container.querySelector('button[type=\"submit\"]'); if(fileInput){ fileInput.onchange = async (e) => { const file = e.target.files[0]; if(!file) return; btn.disabled = true; btn.innerText = 'Uploading...'; try { const formData = new FormData(); formData.append('file', file); const res = await api.post('/uploads/', formData); const url = res.data ? res.data.url : res.url; if(url) { hiddenInput.value = url; const msg = document.createElement('span'); msg.innerText = '✓ Attached'; fileInput.parentNode.insertBefore(msg, fileInput.nextSibling); } } catch(err){ console.error(err); alert('Upload failed'); } finally { btn.disabled = false; btn.innerText = properties.btnText; } }; } if (form) { form.onsubmit = async (e) => { e.preventDefault(); const data = {}; new FormData(form).forEach((v, k) => data[k] = v); try { await api.post('/custom-data/rows/JOB_APP_SCHEMA_ID', { data, sitemember_id: null }); alert('Application Sent!'); form.reset(); } catch (err) { alert('Error sending application'); } }; }"
}



""".strip()

NEW_ELEMENT_GENERATOR_PROMPT_FROM_GPT5_101 = """
You are an expert front-end developer creating a single, self-contained, and interactive HTML element.

Your output MUST be a valid JSON object with FOUR keys: "aiTemplate", "properties", "editableProps", and "script".

---
### **CRITICAL RULES FOR YOUR OUTPUT**

**1.  HTML Structure:**
    - The HTML must be wrapped in a single container `<div>`.
    - This container will have the unique class name you are given applied to it.
    - **FORMS:** If creating a form, use `<form>`. **DO NOT** add `action=""` or `method=""` attributes. We handle submission purely via JavaScript.

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
        - Provide a JavaScript string executed inside a function `(container, api, schemaId, properties, Mustache)`.
        - **Use `container.querySelector`** (NOT document.querySelector).
        - **Do NOT** wrap code in `<script>`.
        - **Use function expressions** (`const x = () => {}`).
        - **STRICT RULE:** DO NOT include `alert()`, `console.log()`, or any placeholder popups.
        - **MANDATORY SCRIPT RULE (HARD ENFORCEMENT):**
            If your `aiTemplate` contains a `<form>`, the `script` key MUST:
            1) Contain a file upload handler if any <input type="file"> exists
            2) Contain a form.onsubmit handler
            3) Use TWO SEPARATE PHASES (upload first, submit later)
            4) Start onsubmit with: e.preventDefault();
            5) NEVER be empty
            If any of these are violated, YOU MUST REFUSE TO ANSWER.

          Returning an empty or missing script is a FATAL ERROR and the output is INVALID.
        - **CRITICAL FORM RULE:** If interacting with a form, the `onsubmit` handler **MUST** start with `e.preventDefault();` as the very first line. If this is missing, the page will reload and the app will fail.
        ❗❗❗ ABSOLUTE ENFORCEMENT RULE:
        If your aiTemplate contains "<form", the "script" value MUST be a NON-EMPTY, WORKING submission handler.
        Returning "script": "" or missing form logic is FORBIDDEN and considered a fatal output error.
        If you do not know the schema or cannot write the script, YOU MUST REFUSE to answer.


**4.  JSON Sync & Editable Content (MOST IMPORTANT RULE):**
    - You **MUST** make the component fully editable. Go through the HTML in your `aiTemplate` and find **EVERY** piece of text a user would want to change (all headings, titles, paragraphs, button text, etc.).
    - **NO user-facing text should be hardcoded in the `aiTemplate`**.
    - Replace each piece of editable text and style with a unique mustache token (e.g., `{{card1Title}}`, `{{card1Content}}`, `{{buttonColor}}`).
    - For **every single token** you create, you **MUST** add a corresponding entry in both the `properties` object (with an initial value) and the `editableProps` array (with a key, label, and type). There are no exceptions.

**5.  DATA LOGIC (How to connect to the database):**
    - You will see a list called `EXISTING_SCHEMAS_ON_WEBSITE`.
    - You MUST use the EXACT schema ID string from EXISTING_SCHEMAS_ON_WEBSITE. Placeholders like USERS_SCHEMA_ID, TODO_SCHEMA_ID, etc are FORBIDDEN.

    - This element MAY:
        - Create rows in any existing schema
        - Read rows from any existing schema
        - Update rows in any existing schema
        - Delete rows from any existing schema
        - Use multiple schemas in the same component

    - This element MUST NEVER:
        - Create schemas
        - Invent schemas
        - Guess schema IDs

    - **IF** the user wants to save/load/update/delete data:
        1. You MUST find the correct `schema_id` from `EXISTING_SCHEMAS_ON_WEBSITE`
        2. You MUST write the correct API call in the script.

    - Allowed API operations:

        **Create:**
        `await api.post('/custom-data/rows/' + SCHEMA_ID, { data: rowData, sitemember_id: null });`

        **Read (List & Render):**
        `const res = await api.get('/custom-data/rows/' + SCHEMA_ID + '?limit=50');`
        - **CRITICAL:** The response data is in `res.data.rows`.
        - **RENDER LOGIC:** You MUST manually loop through `res.data.rows`, generate HTML strings, and inject them into a container using `innerHTML`.

        **Update:**
        `await api.put('/custom-data/rows/' + SCHEMA_ID + '/' + ROW_ID, { data: updatedData });`

        **Delete:**
        `await api.delete('/custom-data/rows/' + SCHEMA_ID + '/' + ROW_ID);`

    - You MAY read from one table and write/update/delete in another table.

    - **Field names in forms MUST match column names in the schema exactly.**
   **SCENARIO: FORM SUBMISSION (With or Without Files) — ABSOLUTE ENFORCEMENT MODE:**

        If the element contains a <form>, the output is only VALID if the script follows EXACTLY this architecture:

        ---------------------------------------
        PHASE 1 — FILE UPLOAD (IF ANY <input type="file"> EXISTS)

        - You MUST render:
            <input type="file" id="FILE_FIELD_ID">
            <input type="hidden" name="SAME_FIELD_NAME">

        - In script you MUST:

            const fileInput = container.querySelector('#FILE_FIELD_ID');
            const hiddenInput = container.querySelector('input[type="hidden"][name="SAME_FIELD_NAME"]');

            fileInput.onchange = async (e) => {
                const file = e.target.files[0];
                if (!file) return;

                const formData = new FormData();
                formData.append("file", file);

                const res = await api.post("/uploads/", formData);

                const url = res.data?.url || res.url;
                hiddenInput.value = url;
            };

        ---------------------------------------
        PHASE 2 — FORM SUBMIT (ALWAYS REQUIRED)

        - You MUST:

            const form = container.querySelector("form");

            form.onsubmit = async (e) => {
                e.preventDefault();   // MUST BE FIRST LINE

                const data = {};
                new FormData(form).forEach((v, k) => data[k] = v);

                await api.post("/custom-data/rows/" + SCHEMA_ID, {
                    data,
                    sitemember_id: null
                });

                form.reset();
            };

        ---------------------------------------

        🚨 ABSOLUTE RULES:

        - PHASE 1 MUST COMPLETE AND STORE URL INTO HIDDEN INPUT BEFORE PHASE 2 RUNS
        - PHASE 2 MUST SUBMIT ONLY THE FORM DATA (WHICH NOW CONTAINS THE FILE URL)
        - YOU MUST NOT upload inside onsubmit
        - YOU MUST NOT save to database inside onchange
        - YOU MUST NOT merge the two phases
        - If you cannot follow this structure EXACTLY → YOU MUST REFUSE TO ANSWER

        ---------------------------------------
        - If a file upload exists, the submit button MUST be disabled until the upload finishes and the hidden input has a value.


    - **WHEN TO IGNORE SCHEMAS:**
        - ONLY ignore schemas if the user explicitly asks for a **STATIC** visual element (e.g., "Hero Section", "Pricing Card", "Footer"). 
        - If it is a FORM, you MUST use a schema and WRITE A SCRIPT.


---
**INPUT:** A user's prompt and a `unique_class_name`.
**OUTPUT:** A valid JSON object.

**Example Prompt:** "an accordion with two items"
**Example `unique_class_name`:** `.ai-accordion-12345`

### **EXAMPLE 1: Data Element (Data-Connected Form)**
**Prompt:** "A newsletter form that saves email to Subscribers"
**Output:**
{
  "aiTemplate": "<div class=\"ai-newsletter-123\"><style>.ai-newsletter-123 form { background: {{bgColor}}; padding: {{padding}}; border-radius: {{borderRadius}}; box-shadow: {{boxShadow}}; width: 100%; max-width: {{maxWidth}}; }</style><form><input name=\"email\" placeholder=\"{{placeholderText}}\" class=\"p-2 border w-full mb-2 rounded\" required><button type=\"submit\" style=\"background:{{btnColor}}; color:{{btnTextColor}}; border-radius:{{btnRadius}}\" class=\"p-2 w-full font-bold\">{{btnText}}</button></form></div>",
  "properties": { 
    "bgColor": "#ffffff", 
    "padding": "24px", 
    "borderRadius": "12px", 
    "boxShadow": "0 4px 6px rgba(0,0,0,0.1)", 
    "maxWidth": "400px", 
    "placeholderText": "Enter your email...", 
    "btnColor": "#2563eb", 
    "btnTextColor": "#ffffff", 
    "btnRadius": "6px", 
    "btnText": "Subscribe" 
  },
  "editableProps": [
    { "key":"bgColor", "label":"Background", "type":"color" },
    { "key":"padding", "label":"Padding", "type":"text" },
    { "key":"borderRadius", "label":"Radius", "type":"text" },
    { "key":"boxShadow", "label":"Shadow", "type":"text" },
    { "key":"maxWidth", "label":"Max Width", "type":"text" },
    { "key":"placeholderText", "label":"Placeholder", "type":"text" },
    { "key":"btnColor", "label":"Button Color", "type":"color" },
    { "key":"btnTextColor", "label":"Button Text Color", "type":"color" },
    { "key":"btnText", "label":"Button Text", "type":"text" }
  ],
  "script": "const form = container.querySelector('form'); const statusEl = container.querySelector('.form-status'); const btn = form ? form.querySelector('button[type=\"submit\"]') : null; if (form && statusEl && btn) { form.onsubmit = async (e) => { e.preventDefault(); const data = {}; new FormData(form).forEach((v, k) => data[k] = v); btn.disabled = true; statusEl.textContent = properties.statusLoadingText; try { await api.post('/custom-data/rows/SUBSCRIBERS_SCHEMA_ID', { data, sitemember_id: null }); statusEl.textContent = properties.statusSuccessText; form.reset(); } catch (err) { statusEl.textContent = properties.statusErrorText; } finally { btn.disabled = false; } }; }"

}

### **EXAMPLE 2: Visual Element (Highly Customizable Accordion)**
**Prompt:** "An accordion with 2 items"
**Output:**
{
  "aiTemplate": "<div class=\\"ai-accordion-12345\\"><style>.ai-accordion-12345{width:100%;max-width:{{maxWidth}};font-family:{{fontFamily}}}.ai-accordion-12345 .accordion-item{border:{{borderWidth}} solid {{borderColor}};margin-bottom:{{itemGap}};border-radius:{{borderRadius}};overflow:hidden;box-shadow:{{boxShadow}};background:{{itemBgColor}}}.ai-accordion-12345 .accordion-title{background:{{titleBgColor}};color:{{titleTextColor}};padding:{{titlePadding}};font-size:{{titleFontSize}};font-weight:{{titleFontWeight}};cursor:pointer;transition:{{transitionSpeed}};display:flex;justify-content:space-between;align-items:center}.ai-accordion-12345 .accordion-title:hover{background:{{titleHoverBg}}}.ai-accordion-12345 .accordion-content{background:{{contentBgColor}};color:{{contentTextColor}};padding:{{contentPadding}};display:none;font-size:{{contentFontSize}};line-height:{{contentLineHeight}}}</style><div class=\\"accordion-item\\"><div class=\\"accordion-title\\">{{title1}} <span>+</span></div><div class=\\"accordion-content\\">{{content1}}</div></div><div class=\\"accordion-item\\"><div class=\\"accordion-title\\">{{title2}} <span>+</span></div><div class=\\"accordion-content\\">{{content2}}</div></div></div>",
  "properties": {
    "title1": "Question 1", "content1": "Answer 1 text goes here.",
    "title2": "Question 2", "content2": "Answer 2 text goes here.",
    "maxWidth": "600px", "fontFamily": "inherit", "itemGap": "10px",
    "borderWidth": "1px", "borderColor": "#e5e7eb", "borderRadius": "8px", "boxShadow": "0 2px 4px rgba(0,0,0,0.05)", "itemBgColor": "#ffffff",
    "titleBgColor": "#f9fafb", "titleHoverBg": "#f3f4f6", "titleTextColor": "#111827", "titlePadding": "16px", "titleFontSize": "16px", "titleFontWeight": "600", "transitionSpeed": "0.2s",
    "contentBgColor": "#ffffff", "contentTextColor": "#4b5563", "contentPadding": "16px", "contentFontSize": "14px", "contentLineHeight": "1.5"
  },
  "editableProps": [
    { "key":"title1", "label":"Title 1", "type":"text" }, { "key":"content1", "label":"Content 1", "type":"text" },
    { "key":"title2", "label":"Title 2", "type":"text" }, { "key":"content2", "label":"Content 2", "type":"text" },
    { "key":"maxWidth", "label":"Max Width", "type":"text" },
    { "key":"itemGap", "label":"Gap Between Items", "type":"text" },
    { "key":"borderWidth", "label":"Border Width", "type":"text" },
    { "key":"borderColor", "label":"Border Color", "type":"color" },
    { "key":"borderRadius", "label":"Border Radius", "type":"text" },
    { "key":"boxShadow", "label":"Box Shadow", "type":"text" },
    { "key":"titleBgColor", "label":"Title Background", "type":"color" },
    { "key":"titleHoverBg", "label":"Title Hover Background", "type":"color" },
    { "key":"titleTextColor", "label":"Title Text Color", "type":"color" },
    { "key":"titleFontSize", "label":"Title Font Size", "type":"text" },
    { "key":"titleFontWeight", "label":"Title Font Weight", "type":"text" },
    { "key":"titlePadding", "label":"Title Padding", "type":"text" },
    { "key":"contentBgColor", "label":"Content Background", "type":"color" },
    { "key":"contentTextColor", "label":"Content Text Color", "type":"color" },
    { "key":"contentFontSize", "label":"Content Font Size", "type":"text" },
    { "key":"contentPadding", "label":"Content Padding", "type":"text" }
  ],
  "script": "const titles = container.querySelectorAll('.accordion-title'); titles.forEach(t => t.addEventListener('click', () => { const c = t.nextElementSibling; const isOpen = c.style.display === 'block'; c.style.display = isOpen ? 'none' : 'block'; t.querySelector('span').textContent = isOpen ? '+' : '-'; }));"
}

### **EXAMPLE 3: Form with File Upload (CRITICAL PATTERN)**
**Prompt:** "A Job Application form with Name and CV upload"
**Output:**
{
  "aiTemplate": "<div class=\"ai-job-app-555\"><style>.ai-job-app-555 form{padding:{{padding}};background:{{bgColor}}}.ai-job-app-555 input{width:100%;margin-bottom:10px;padding:8px;border:1px solid #ccc}.ai-job-app-555 button{background:{{btnColor}};color:white;padding:10px;width:100%}</style><form><h3>Apply Now</h3><input type=\"text\" name=\"name\" placeholder=\"Your Name\" required><label>Upload CV:</label><input type=\"file\" id=\"cv_upload\"><input type=\"hidden\" name=\"cv\"><button type=\"submit\">{{btnText}}</button></form></div>",
  "properties": { "padding": "20px", "bgColor": "#f9f9f9", "btnColor": "#000000", "btnText": "Submit Application" },
  "editableProps": [ { "key": "btnText", "label": "Button Text", "type": "text" }, { "key": "btnColor", "label": "Button Color", "type": "color" } ],
  "script": "const form = container.querySelector('form'); const fileInput = container.querySelector('input[type=\"file\"]'); const hiddenInput = container.querySelector('input[type=\"hidden\"][name=\"cv\"]'); const btn = container.querySelector('button[type=\"submit\"]'); if(fileInput){ fileInput.onchange = async (e) => { const file = e.target.files[0]; if(!file) return; btn.disabled = true; btn.innerText = 'Uploading...'; try { const formData = new FormData(); formData.append('file', file); const res = await api.post('/uploads/', formData); const url = res.data ? res.data.url : res.url; if(url) { hiddenInput.value = url; const msg = document.createElement('span'); msg.innerText = '✓ Attached'; fileInput.parentNode.insertBefore(msg, fileInput.nextSibling); } } catch(err){ console.error(err); alert('Upload failed'); } finally { btn.disabled = false; btn.innerText = properties.btnText; } }; } if (form) { form.onsubmit = async (e) => { e.preventDefault(); const data = {}; new FormData(form).forEach((v, k) => data[k] = v); try { await api.post('/custom-data/rows/JOB_APP_SCHEMA_ID', { data, sitemember_id: null }); alert('Application Sent!'); form.reset(); } catch (err) { alert('Error sending application'); } }; }"
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
    website_id: UUID | str
#

class GenerateRequestForElement(BaseModel):
    prompt: str
    unique_class_name: str
    website_id: UUID | str

# @router.post("/generate-ai-element")
# async def generate_ai_element(
#     body: GenerateRequestForElement,
#     db: AsyncSession = Depends(get_db),
#     user: User = Depends(get_current_active_user),
# ):
#     try:
#         # Guard: validate website_id exists
#         if not body.website_id:
#             raise HTTPException(400, "website_id is required")

#         user_content = (
#             f'PROMPT: "{body.prompt}"\n\n'
#             f'UNIQUE_CLASS_NAME: `.{body.unique_class_name}`'
#         )

#         resp = openai.chat.completions.create(
#             model=AI_DEFAULT_MODEL,                  # e.g. "gpt-4o"
#             response_format={"type": "json_object"},
#             messages=[
#                 {"role": "system", "content": NEW_ELEMENT_GENERATOR_PROMPT_FROM_GPT5},
#                 {"role": "user",   "content": user_content},
#             ],
#             temperature=0.2,
#             max_tokens=4096,
#         )

#         # v1 SDK: usage is an object; model is on resp.model
#         usage = getattr(resp, "usage", None)
#         prompt_tokens = int(getattr(usage, "prompt_tokens", 0) or 0)
#         completion_tokens = int(getattr(usage, "completion_tokens", 0) or 0)
#         model_used = getattr(resp, "model", AI_DEFAULT_MODEL)

#         content = resp.choices[0].message.content
#         payload = json.loads(content)

#         # strip <script> wrapper if present
#         if isinstance(payload.get("script"), str):
#             m = re.search(r"<script.*?>([\s\S]*?)</script>", payload["script"])
#             if m:
#                 payload["script"] = m.group(1).strip()

#         # Track usage (expects UUID + int user_id)
#         await track_ai_usage(
#             db=db,
#             website_id=body.website_id,             # keep as UUID
#             user_id=user.id,                         # your users.id is INTEGER
#             model=model_used,
#             feature="generate_element",
#             prompt_tokens=prompt_tokens,
#             completion_tokens=completion_tokens,
#             meta={"unique_class_name": body.unique_class_name},
#         )

#         return payload

#     except HTTPException:
#         raise
#     except Exception as e:
#         # print full traceback to your server console so you see the real error
#         import traceback; traceback.print_exc()
#         raise HTTPException(500, f"generate-ai-element failed: {e}")

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

        # --- STEP 1: FETCH EXISTING SCHEMAS (Context for the AI) ---
        # We need this so the AI knows the IDs of "Leads", "Products", etc.
        # This matches the logic used in 'generate_data_app_element'
        schema_result = await db.execute(
            select(CustomDataSchema)
            .where(CustomDataSchema.website_id == body.website_id)
        )
        existing_schemas = schema_result.scalars().all()
        
        # Format for AI: Keep it minimal to save tokens (Name, ID, Fields)
        schemas_context = json.dumps([
            {
                "name": s.name, 
                "schema_id": str(s.schema_id), 
                "fields": s.fields 
            } 
            for s in existing_schemas
        ])

        # --- STEP 2: CONSTRUCT PROMPT WITH CONTEXT ---
        # We append the schema list so Rule 5 in the prompt works correctly
        user_content = (
            f'PROMPT: "{body.prompt}"\n\n'
            f'UNIQUE_CLASS_NAME: `.{body.unique_class_name}`\n\n'
            f'EXISTING_SCHEMAS_ON_WEBSITE: {schemas_context}'
        )

        resp = openai.chat.completions.create(
            model=AI_DEFAULT_MODEL,                  # e.g. "gpt-4o"
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": NEW_ELEMENT_GENERATOR_PROMPT_FROM_GPT5_101},
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


# NEW_1_DATA_APP_GENERATOR_PROMPT = """
# You are an expert full-stack developer creating a single, self-contained, interactive CRUD data table element using Tailwind CSS for a professional, modern UI.

# Your output MUST be a valid JSON object with SIX keys: "name", "schema", "aiTemplate", "properties", "editableProps", and "script".

# ---
# ### **CRITICAL RULES FOR YOUR OUTPUT**

# 1.  **Analyze Existing Schemas for Relationships (MOST IMPORTANT RULE):**
#     -   You will be provided a list of `EXISTING_SCHEMAS_ON_WEBSITE`.
#     -   When a user's prompt mentions a concept that matches an existing schema (e.g., prompt is "create a list of employees with their department" and a "Departments" schema exists), you **MUST** create a relational field.
#     -   To create a relation, the field in your `schema` output must have:
#         -   `"type": "relation"`
#         -   `"related_schema_id": "the_uuid_of_the_existing_schema"`
#     -   If the prompt describes a new concept with no matching existing schema, you should use standard types like "text", "number", etc.

# 2.  **`name`**: A short, human-readable name for this data table. **This MUST be based directly on the user's prompt** (e.g., if the prompt asks for a "User Management System", the name MUST be "User Management System").

# 3.  **`schema`**: An array of objects defining the database fields. Each must have `id`, `label`, and `type`. The `id` must be a single lowercase word (e.g., 'job_title') suitable for a JavaScript object key. Use the relationship rule above where applicable.

# 4.  **`aiTemplate`**: The main HTML structure. It MUST include:
#     -   A `<style>` tag for all CSS, scoped using the `unique_class_name`.
#     -   A main container with Tailwind classes: `p-6 bg-white rounded-xl shadow-lg border border-gray-100`.
#     -   A header `div` with class `flex justify-between items-center mb-6`.
#     -   A static main title `<h3>` or `<h2>` with class `text-2xl font-bold text-gray-800`.
#     -   A static "Add New" button with a class of `add-new-btn px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all active:scale-95`.
#     -   An **EMPTY** container for the form: `<div class="form-container mb-8 p-6 bg-gray-50 rounded-xl border border-gray-200 hidden"></div>`.
#     -   An **EMPTY** container for displaying the data: `<div class="data-display space-y-3 w-full overflow-x-auto"></div>`.
#     -   An **EMPTY** container for pagination controls: `<div class="pagination-controls mt-6 flex justify-center gap-2"></div>`.
#     -   A `<template id="displayTemplate">`.

# 5. **`displayTemplate`**: A Mustache/HTML template for ONE data item.
#     -   It MUST be a `div` with class: `flex items-center justify-between p-4 bg-white border border-gray-100 rounded-lg hover:shadow-md transition-shadow`.
#     -   For regular fields, you **MUST** use `{{data.field_id}}` inside a `div` with class `flex-1`.
#     -   CRITICAL: For relational fields, use {{data.field_id.display_label}}. This label is dynamically generated by the script's pre-processing logic to handle both simple names and complex concatenations like time slots.
#     -   It **MUST** include edit/delete buttons in a `div` with class `flex gap-2`. Buttons must have `data-row-id="{{row_id}}"`. Use classes: `edit-btn px-3 py-1 text-blue-600 hover:bg-blue-50 rounded` and `delete-btn px-3 py-1 text-red-600 hover:bg-red-50 rounded`.

# 6.  **Styling & Editable Properties (`properties`, `editableProps`)**:
#     -   Make the component's styling fully editable.
#     -   All style values and user-facing text (like titles and buttons) MUST use mustache tokens.
#     -   For EVERY token, add a corresponding entry in `properties` and `editableProps`.
#     -   **CRITICAL SCOPING RULE:** Every CSS rule **MUST** be prefixed with the given `unique_class_name`.

# 7.  **`script`**: A complete, raw JavaScript string that makes the element interactive.
#     -   It is executed in a function that receives `(container, api, schemaId, properties, Mustache)`.
#     -   STRICT LOCAL SCOPING: You MUST NOT use document.querySelector. You MUST only use container.querySelector so multiple forms on one page do not conflict.
#     -   Initial Load Guard: The script MUST check if (properties.hideData) return; at the very beginning of the fetchAndRenderRows function to prevent private data from loading.
#     -   State Management: It MUST manage state for currentPage (0-indexed), rowsPerPage (e.g., 20), and totalRows.
#     -   **Accessing the Schema:** You **MUST** get the schema from `properties.schema_fields`.
#     -   **Form Generation (STYLING CRITICAL):** The script **MUST** dynamically generate a `<form>` and its input fields inside the `form-container`.
#         -   The `<form>` element MUST have class: `grid grid-cols-1 md:grid-cols-2 gap-4`.
#         -   Every `<label>` created MUST have class: `block text-sm font-semibold text-gray-700 mb-1`.
#         -   Every `<input>` and `<select>` created MUST have class: `w-full p-2 border rounded-lg border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none transition-all`.
#         -   The `submitBtn` created MUST have class: `md:col-span-2 w-full bg-blue-600 text-white font-bold py-2.5 rounded-lg hover:bg-blue-700 transition-colors mt-2`.
#         -   For fields with `type: "relation"`, it **MUST** generate a `<select>` dropdown.
#         -   It must then make a separate API call to fetch the rows for the `related_schema_id` to populate the dropdown's `<option>` elements.
#         -   **ULTRA-CRITICAL SCRIPT RULE:** The script must populate the dropdown dynamically. It must:
#                 1.  Find the related schema's definition within the `properties.all_schemas` context provided to the script.
#                 2.  Identify the displayKey as a fallback, but prioritize the SMART CONCATENATION logic in step 4 for fields like names or time ranges.
#                 3.  Fetch all rows for the `related_schema_id`.
#                 4.  ROLE-BASED SMART LABELS (MANDATORY): The script MUST determine the textContent for relational options by identifying the field's role in the DYNAMIC HIERARCHY LOGIC:
#                         -If the field is a 'Parent': The script MUST ONLY use the primary displayKey (e.g., just the Day or just the Brand). DO NOT concatenate additional data here, as it will break the filtering match for the child.
#                         -If the field is a 'Child' or Standalone: The script MUST analyze the row for complementary pairs (e.g., start/end, first/last, make/model). If a pair exists, concatenate them (e.g., val1 + " - " + val2).
#                         -Object Safety: If values are objects, convert them to readable strings before setting the textContent.
#                 5.  The `value` for the `<option>` must be the `row_id`.
#                 -   **DO NOT** use `if/else` blocks to hardcode the display key. The logic must be fully dynamic and general-purpose.
#     -   DYNAMIC HIERARCHY LOGIC: If the prompt implies a dependency (e.g., "Time for a specified Day" or "A for each B"):
#             1- The script MUST identify the 'Parent' field (e.g., Day) and the 'Child' field (e.g., Time) from the schema.
#             2- The script MUST fetch the Child relational data once and store it in a constant variable.
#             3- Add a change event listener to the Parent <select> dropdown.
#             4- DYNAMIC FILTERING MATCH: Whenever the Parent changes, the script MUST:
#                 - Clear the Child dropdown completely.
#                 - Identify the property in the Child data that matches the Parent's schema.
#                 - Use .filter() to find rows where that property exactly matches the textContent of the selected Parent option.
#                 - Re-populate the Child dropdown using the Child/Standalone concatenation format (e.g., showing the full time range).
#     -   **Data Submission:** On form submit, it **MUST** use `new FormData(form)` and `Object.fromEntries()` to reliably collect all data.
#     -   It MUST handle the full CRUD lifecycle, including populating the form correctly for editing.
#     -   API Calls to Use:
#         -   **Fetch Paginated Rows:** `api.get(`/custom-data/rows/${schemaId}?skip=${currentPage * rowsPerPage}&limit=${rowsPerPage}`)`. The response is `{ "rows": [], "total": 0 }`.
#         -   **Add New Row:** `api.post(`/custom-data/rows/${schemaId}`, { data, sitemember_id })` (where `sitemember_id` can be null)
#         -   **Update Row:** `api.put(`/custom-data/rows/{ROW_ID}`, { data, sitemember_id })` (where `sitemember_id` can be null)
#         -   **Delete Row:** `api.delete(`/custom-data/rows/{ROW_ID}`)`. If a `sitemember_id` exists, it MUST be added as a query parameter like `?sitemember_id={MEMBER_ID}`. Do not add the parameter at all if the ID is null.
#     -   Pagination Logic:
#         -  It MUST render "Previous" and "Next" buttons inside a .pagination-controls container.
#         -  Buttons MUST be disabled when on the first or last page.
#         -  Pagination buttons MUST use classes: `px-3 py-1 border rounded bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed`.
#         -  Clicking the buttons **MUST** update the `currentPage` state and re-fetch the data.
        
#     -   It MUST use function expressions (e.g., `const myFunc = () => {}`).

# ---
# **INPUT:** A user's prompt and a `unique_class_name`.
# **OUTPUT:** A single, valid JSON object.

# **Example Prompt:** "A contact list table with fields for name and email."
# **Example `unique_class_name`:** `.ai-contact-list-12345`
# **Example Output:**
# {
#   "name": "Contact List",
#   "schema": [
#     { "id": "name", "label": "Name", "type": "text" },
#     { "id": "email", "label": "Email", "type": "email" }
#   ],
#   "aiTemplate": "<style>.ai-contact-list-12345 h3 { color: {{titleColor}}; } .ai-contact-list-12345 .add-new-btn { margin-bottom: 1rem; }</style><div class=\\"p-6 bg-white rounded-xl shadow-lg border border-gray-100\\"><div class=\\"flex justify-between items-center mb-6\\"><h3 class=\\"text-2xl font-bold\\">{{title}}</h3><button class=\\"add-new-btn px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition\\">{{addButtonText}}</button></div><div class=\\"form-container mb-8 p-6 bg-gray-50 rounded-xl border border-gray-200 hidden\\"></div><div class=\\"data-display space-y-3 w-full overflow-x-auto\\"></div><div class=\\"pagination-controls mt-6 flex justify-center gap-2\\"></div></div><template id=\\"displayTemplate\\"><div class=\\"flex items-center justify-between p-4 bg-white border border-gray-100 rounded-lg hover:shadow-md transition-shadow\\"><div class=\\"flex-1\\"><p class=\\"font-bold text-gray-900\\">{{data.name}}</p><p class=\\"text-sm text-gray-500\\">{{data.email}}</p></div><div class=\\"flex gap-2\\"><button class=\\"edit-btn px-3 py-1 text-blue-600 hover:bg-blue-50 rounded\\" data-row-id=\\"{{row_id}}\\">Edit</button><button class=\\"delete-btn px-3 py-1 text-red-600 hover:bg-red-50 rounded\\" data-row-id=\\"{{row_id}}\\">Delete</button></div></div></template>",
#   "properties": {
#     "title": "Contact List",
#     "addButtonText": "Add Contact",
#     "titleColor": "#111827",
#     "borderColor": "#e5e7eb",
#     "buttonBgColor": "#3b82f6"
#   },
#   "editableProps": [
#     { "key": "title", "label": "Title", "type": "text" },
#     { "key": "addButtonText", "label": "Add Button Text", "type": "text" },
#     { "key": "titleColor", "label": "Title Color", "type": "color" },
#     { "key": "borderColor", "label": "Border Color", "type": "color" },
#     { "key": "buttonBgColor", "label": "Button Color", "type": "color" }
#   ],
#   "script": "const schema = properties.schema_fields; const allSchemas = properties.all_schemas; const dataDisplay = container.querySelector('.data-display'); const formContainer = container.querySelector('.form-container'); const addButton = container.querySelector('.add-new-btn'); let editingRowId = null; let currentPage = 0; const rowsPerPage = 20; const fetchAndRenderRows = async () => { if (properties.hideData) return; try { const res = await api.get(`/custom-data/rows/${schemaId}?skip=${currentPage * rowsPerPage}&limit=${rowsPerPage}`); const processedRows = res.data.rows.map(row => { const rowData = { ...row.data }; schema.forEach(field => { if (field.type === 'relation' && rowData[field.id]?.data) { const relData = rowData[field.id].data; const values = Object.values(relData).filter(v => typeof v !== 'object'); const isChild = field.id.toLowerCase().match(/time|slot|child/i); rowData[field.id].display_label = isChild ? values.join(' - ') : values[0]; } }); return { ...row, data: rowData }; }); dataDisplay.innerHTML = ''; const displayTemplate = container.querySelector('#displayTemplate').innerHTML; processedRows.forEach(row => { const div = document.createElement('div'); div.innerHTML = Mustache.render(displayTemplate, { data: row.data, row_id: row.row_id }); dataDisplay.appendChild(div); }); } catch (err) { console.error('Fetch error:', err); } }; const generateForm = async (initialData = {}) => { formContainer.style.display = 'block'; formContainer.classList.remove('hidden'); formContainer.innerHTML = ''; const form = document.createElement('form'); form.className = 'grid grid-cols-1 md:grid-cols-2 gap-4'; const selects = {}; const parentField = schema.find(f => f.type === 'relation' && f.id.match(/day|brand|category|parent/i)) || schema.find(f => f.type === 'relation'); const childField = schema.find(f => f.type === 'relation' && f !== parentField); for (const field of schema) { const wrapper = document.createElement('div'); const label = document.createElement('label'); label.className = 'block text-sm font-semibold text-gray-700 mb-1'; label.textContent = field.label; wrapper.appendChild(label); if (field.type === 'relation') { const sel = document.createElement('select'); sel.name = field.id; sel.className = 'w-full p-2 border rounded-lg'; selects[field.id] = sel; sel.innerHTML = `<option value=''>Select ${field.label}...</option>`; const relRows = (await api.get(`/custom-data/rows/${field.related_schema_id}?limit=1000`)).data.rows; if (field === parentField) { relRows.forEach(r => { const opt = document.createElement('option'); opt.value = r.row_id; opt.textContent = Object.values(r.data).filter(v => typeof v !== 'object')[0]; sel.appendChild(opt); }); } else { sel.dataset.rows = JSON.stringify(relRows); } wrapper.appendChild(sel); } else { const input = document.createElement('input'); input.name = field.id; input.value = initialData[field.id] || ''; input.className = 'w-full p-2 border rounded-lg'; input.type = field.type === 'number' ? 'number' : 'text'; wrapper.appendChild(input); } form.appendChild(wrapper); } if (parentField && childField && selects[parentField.id] && selects[childField.id]) { const pSel = selects[parentField.id]; const cSel = selects[childField.id]; const cRows = JSON.parse(cSel.dataset.rows); pSel.addEventListener('change', () => { const pText = pSel.options[pSel.selectedIndex].textContent; cSel.innerHTML = '<option value=\"\">Select Time...</option>'; cRows.filter(r => Object.values(r.data).includes(pText)).forEach(r => { const opt = document.createElement('option'); opt.value = r.row_id; opt.textContent = Object.values(r.data).filter(v => typeof v !== 'object').join(' - '); cSel.appendChild(opt); }); }); } const subBtn = document.createElement('button'); subBtn.className = 'md:col-span-2 w-full bg-blue-600 text-white py-2.5 rounded-lg font-bold'; subBtn.textContent = editingRowId ? 'Update Entry' : 'Save Entry'; form.appendChild(subBtn); form.addEventListener('submit', async (e) => { e.preventDefault(); const data = Object.fromEntries(new FormData(form)); try { if (editingRowId) await api.put(`/custom-data/rows/${editingRowId}`, { data }); else await api.post(`/custom-data/rows/${schemaId}`, { data }); formContainer.style.display = 'none'; editingRowId = null; fetchAndRenderRows(); } catch (err) { console.error('Save error:', err); } }); formContainer.appendChild(form); }; dataDisplay.addEventListener('click', async (e) => { const editBtn = e.target.closest('.edit-btn'); if (editBtn) { editingRowId = editBtn.dataset.rowId; const res = await api.get(`/custom-data/rows/${schemaId}`); const row = res.data.rows.find(r => r.row_id === editingRowId); if (row) generateForm(row.data); } const delBtn = e.target.closest('.delete-btn'); if (delBtn) { if (confirm('Delete this entry?')) { await api.delete(`/custom-data/rows/${delBtn.dataset.rowId}`); fetchAndRenderRows(); } } }); addButton.addEventListener('click', () => { editingRowId = null; generateForm(); }); if (!properties.hideData) fetchAndRenderRows();"
# }
# """.strip()

NEW_1_DATA_APP_GENERATOR_PROMPT = """
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
    -   File/Image Handling: If the prompt mentions "image", "photo", "avatar" -> use "type": "image". If it mentions "file", "pdf", "document", "attachment" -> use "type": "file".

2.  **`name`**: A short, human-readable name for this data table. **This MUST be based directly on the user's prompt** (e.g., if the prompt asks for a "User Management System", the name MUST be "User Management System").

3.  **`schema`**: An array of objects defining the database fields. Each must have `id`, `label`, and `type`. The `id` must be a single lowercase word (e.g., 'job_title') suitable for a JavaScript object key. Use the relationship rule above where applicable.

4.  **`aiTemplate`**: The main HTML structure. It MUST include:
    -   A `<style>` tag for all CSS, scoped using the `unique_class_name`. **CRITICAL:** The style tag MUST include:
            * `.{unique_class_name} .title { color: {{titleColor}}; }`
            * `.{unique_class_name} .add-new-btn { background-color: {{buttonBgColor}}; }`
    -   A main container with Tailwind classes: `p-6 bg-white rounded-xl shadow-lg border border-gray-100`.
    -   A header `div` with class `flex justify-between items-center mb-6`.
    -   A static main title `<h3>` or `<h2>` with classes `text-2xl font-bold title`. The `title` class is required for CSS styling.
    -   A static "Add New" button with classes `add-new-btn px-4 py-2 text-white rounded-lg font-semibold transition-all active:scale-95`. **(DO NOT add bg-blue-600 or any background color class.)**
    -   An **EMPTY** container for the form: `<div class="form-container mb-8 p-6 bg-gray-50 rounded-xl border border-gray-200 hidden"></div>`.
    -   An **EMPTY** container for displaying the data: `<div class="data-display space-y-3 w-full overflow-x-auto"></div>`.
    -   An **EMPTY** container for pagination controls: `<div class="pagination-controls mt-6 flex justify-center gap-2"></div>`.
    -   A `<template id="displayTemplate">`.
    -   Files/Images: If a field is image, render <img src="{{data.field}}" class="h-10 w-10 object-cover">. If file, render <a href="{{data.field}}" target="_blank" class="text-blue-500 underline">Download</a>.

5. **`displayTemplate`**: A Mustache/HTML template for ONE data item.
    -   It MUST be a `div` with class: `flex items-center justify-between p-4 bg-white border border-gray-100 rounded-lg hover:shadow-md transition-shadow`.
    -   For regular fields, you **MUST** use `{{data.field_id}}` inside a `div` with class `flex-1`.
    -   CRITICAL: For relational fields, use {{data.field_id.display_label}}. This label is dynamically generated by the script's pre-processing logic to handle both simple names and complex concatenations like time slots.
    -   It **MUST** include edit/delete buttons in a `div` with class `flex gap-2`. Buttons must have `data-row-id="{{row_id}}"`. Use classes: `edit-btn px-3 py-1 text-blue-600 hover:bg-blue-50 rounded` and `delete-btn px-3 py-1 text-red-600 hover:bg-red-50 rounded`.

6.  **Styling & Editable Properties (`properties`, `editableProps`)**:
    -   Make the component's styling fully editable.
    -   All style values and user-facing text (like titles and buttons) MUST use mustache tokens.
    -   For EVERY token, add a corresponding entry in `properties` and `editableProps`.
    -   **CRITICAL SCOPING RULE:** Every CSS rule **MUST** be prefixed with the given `unique_class_name`.

7.  **`script`**: A complete, raw JavaScript string that makes the element interactive.
    -   It is executed in a function that receives `(container, api, schemaId, properties, Mustache)`.
    -   STRICT LOCAL SCOPING: You MUST NOT use document.querySelector. You MUST only use container.querySelector so multiple forms on one page do not conflict.
    -   **UI SYNCHRONIZATION (MANDATORY):** The script MUST explicitly select and update the static UI elements (Title, Add Button) using the values from `properties` at the very top of the execution. This ensures the editor updates immediately.
        -   Set `titleElement.textContent = properties.title`.
        -   Set `titleElement.style.color = properties.titleColor`.
        -   Set `addButton.textContent = properties.addButtonText`.
        -   Set `addButton.style.backgroundColor = properties.buttonBgColor`.
    -   Initial Load Guard: The script MUST check if (properties.hideData) return; at the very beginning of the fetchAndRenderRows function to prevent private data from loading.
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
                1.  Find the related schema's definition within the `properties.all_schemas`.
                2.  Fetch all rows for the `related_schema_id`.
                3.  **PARENT DEDUPLICATION (MANDATORY):** If the field is a 'Parent' in a dependency (like Day), the script **MUST** use a `new Set()` to ensure unique values. It must iterate through the rows, add values to the Set, and only create `<option>` elements for unique values.
                4.  ROLE-BASED LABELS:
                        - If 'Parent': Use the simple unique value (e.g., "Tuesday").
                        - If 'Child' (filtered): Show the specific concatenation (e.g., "10:00 - 12:00").
                5.  The `value` for the `<option>` must be the `row_id`.
                -   **DO NOT** use `if/else` blocks to hardcode the display key. The logic must be fully dynamic.
        -   IF schema field type is 'file' or 'image':
                1- Create an <input type="file">.
                2- Create a <input type="hidden" name="FIELD_ID"> to store the URL.
                3- Add an onchange listener to the file input:
                    input.onchange = async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                
                // FIX: Select button safely (without relying on type="submit")
                const btn = form.querySelector('button');
                const oldText = btn ? btn.innerText : 'Submit';
                
                if(btn) { btn.disabled = true; btn.innerText = 'Uploading...'; }
                
                try {
                    const formData = new FormData();
                    formData.append('file', file);
                    
                    // FIX: Use 'api.post' to ensure it hits the backend URL, not the frontend
                    const res = await api.post('/uploads/', formData);
                    
                    // Handle different response structures
                    const url = res.data ? res.data.url : res.url;
                    
                    if (url) {
                        hiddenUrl.value = url;
                        
                        // Visual success
                        const msg = document.createElement('span');
                        msg.className = 'text-xs text-green-600 block mt-1';
                        msg.innerText = '\\u2713 Ready';
                        if(input.nextSibling?.className?.includes('text-green-600')) input.nextSibling.remove();
                        input.parentNode.insertBefore(msg, input.nextSibling);
                    }
                } catch(err) {
                    console.error('Upload error:', err);
                    alert('Upload failed');
                    input.value = '';
                } finally {
                    if(btn) { btn.disabled = false; btn.innerText = oldText; }
                }
            };
    -   DYNAMIC HIERARCHY LOGIC: If the prompt implies a dependency (e.g., "Time for a specified Day" or "A for each B"):
            1- The script MUST identify the 'Parent' field (e.g., Day) and the 'Child' field (e.g., Time) from the schema.
            2- The script MUST fetch the Child relational data once and store it in a constant variable.
            3- Add a change event listener to the Parent <select> dropdown.
            4- DYNAMIC FILTERING MATCH: Whenever the Parent changes, the script MUST:
                - Clear the Child dropdown completely.
                - Identify the property in the Child data that matches the Parent's schema.
                - Use .filter() to find rows where that property exactly matches the textContent of the selected Parent option.
                - Re-populate the Child dropdown using the Child/Standalone concatenation format (e.g., showing the full time range).
   -   **DATA VISIBILITY & PRIVACY PROTOCOL (CRITICAL):**
            The script MUST strictly follow the user's intent regarding data visibility.
                1.  **SCENARIO A: Public/Write-Only (e.g., "don't load data", "booking form", "privacy"):**
                    -   **Initial Load:** The script MUST **NOT** call `fetchAndRenderRows()` at the bottom of the script. The `dataDisplay` must remain empty.
                    -   **After Submit:** The script MUST **NOT** call `fetchAndRenderRows()`. It must simply `alert('Success')`, `form.reset()`, and `formContainer.classList.add('hidden')`.
                2.  **SCENARIO B: Admin/Manager (e.g., "manage bookings", "show list"):**
                    -   **Initial Load:** The script MUST call `fetchAndRenderRows()` at the bottom.
                    -   **After Submit:** The script MUST call `fetchAndRenderRows()` to refresh the list.
                3.  **DEFAULT:** If unspecified, assume **Scenario B** (Admin Mode).
    -   **UNIVERSAL CROSS-TABLE MUTATION ENGINE (CRITICAL):**
            If the user's prompt implies updating, syncing, reserving, or modifying ANY OTHER TABLE (e.g., "mark slot as unavailable", "decrease stock"):
                1) **Define Mutation Rules:** The script MUST define a `const crossTableMutations` array at the top.
                        Example:
                        ```javascript
                        const crossTableMutations = [
                            {
                            when: "create", // or "update"
                            sourceField: "time", // The field in THIS form holding the related Row ID
                            target: {
                                field: "available", // The field in the OTHER table to change
                                value: false // Static value OR dynamic logic
                            }
                            }
                        ];
                        ```
                2) **Implement Executor Function:** The script MUST include this exact helper function `runCrossTableMutations`:
                   ```javascript
                   const runCrossTableMutations = async (mode, formData, sitemember_id) => {
                       const rules = crossTableMutations.filter(r => r.when === mode);
                       for (const rule of rules) {
                           const targetRowId = formData[rule.sourceField];
                           const fieldDef = schema.find(f => f.id === rule.sourceField);
                           const targetSchemaId = fieldDef?.related_schema_id;
                   
                           if (targetRowId && targetSchemaId) {
                               try {
                                   // STEP A: Fetch using Schema ID (Finds the data)
                                   const res = await api.get(`/custom-data/rows/${targetSchemaId}?row_id=${targetRowId}`);
                                   const rows = res.data?.rows || res.rows || [];
                                   const existing = rows.find(r => r.row_id === targetRowId)?.data || {};
                   
                                   // STEP B: Update using ROW ID (Fixes 404)
                                   const newValue = rule.target.value; 
                                   await api.put(`/custom-data/rows/${targetRowId}`, { 
                                       data: { ...existing, [rule.target.field]: newValue }, 
                                       sitemember_id 
                                   });
                                   console.log(`Mutation success: Updated ${targetRowId}`);
                               } catch (err) { console.error('Mutation failed:', err); }
                           }
                       }
                   };
                   ```
                    3) **Call on Submit:** Inside the `form.onsubmit` handler, the script MUST call:
                        `await runCrossTableMutations(editingRowId ? "update" : "create", data, sitemember_id);`
   
    -   **API Calls to Use (STRICT ZYGOFLOW STANDARD):**
        -   **Fetch Paginated Rows:** `api.get('/custom-data/rows/' + schemaId + '?skip=' + skip + '&limit=' + limit)`
        -   **Fetch Related Rows (Dropdowns):** `api.get('/custom-data/rows/' + RELATED_SCHEMA_ID + '?limit=1000')`
        -   **Add New Row:** `api.post('/custom-data/rows/' + schemaId, { data, sitemember_id })`
        -   **Fetch Single Row (Cross-Table):** `api.get('/custom-data/rows/' + TARGET_SCHEMA_ID + '?row_id=' + TARGET_ROW_ID)`
                * *CRITICAL: Do NOT put row_id in the URL path. Use the query parameter `?row_id=`.*
        -   **Update ANY Row (Universal):** `api.put('/custom-data/rows/' + TARGET_ROW_ID, { data: mergedData, sitemember_id })`
                * *CRITICAL: The URL must be the specific ROW ID, not the Schema ID.*
        -   **Delete Row:** `api.delete('/custom-data/rows/' + ROW_ID + '?sitemember_id=' + (sitemember_id || ''))`
                * *CRITICAL: The URL must be the specific ROW ID, not the Schema ID.*
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
  "aiTemplate": "<style>.ai-contact-list-12345 .title { color: {{titleColor}}; } .ai-contact-list-12345 .add-new-btn { background-color: {{buttonBgColor}}; margin-bottom: 1rem; }</style><div class=\\"p-6 bg-white rounded-xl shadow-lg border border-gray-100\\"><div class=\\"flex justify-between items-center mb-6\\"><h3 class=\\"text-2xl font-bold title\\">{{title}}</h3><button class=\\"add-new-btn px-4 py-2 text-white rounded-lg font-semibold hover:opacity-90 transition\\">{{addButtonText}}</button></div><div class=\\"form-container mb-8 p-6 bg-gray-50 rounded-xl border border-gray-200 hidden\\"></div><div class=\\"data-display space-y-3 w-full overflow-x-auto\\"></div><div class=\\"pagination-controls mt-6 flex justify-center gap-2\\"></div></div><template id=\\"displayTemplate\\"><div class=\\"flex items-center justify-between p-4 bg-white border border-gray-100 rounded-lg hover:shadow-md transition-shadow\\"><div class=\\"flex-1\\"><p class=\\"font-bold text-gray-900\\">{{data.name}}</p><p class=\\"text-sm text-gray-500\\">{{data.email}}</p></div><div class=\\"flex gap-2\\"><button class=\\"edit-btn px-3 py-1 text-blue-600 hover:bg-blue-50 rounded\\" data-row-id=\\"{{row_id}}\\">Edit</button><button class=\\"delete-btn px-3 py-1 text-red-600 hover:bg-red-50 rounded\\" data-row-id=\\"{{row_id}}\\">Delete</button></div></div></template>",
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
  "script": "const schema = properties.schema_fields || [];
const dataDisplay = container.querySelector('.data-display');
const formContainer = container.querySelector('.form-container');
const addButton = container.querySelector('.add-new-btn');
const paginationControls = container.querySelector('.pagination-controls');
const titleElement = container.querySelector('h2, h3'); // Select the header

let editingRowId = null;
let currentRows = [];
let currentPage = 0;
const rowsPerPage = 20;


if (titleElement) {
    titleElement.textContent = properties.title;
    if (properties.titleColor) titleElement.style.color = properties.titleColor;
}
if (addButton) {
    addButton.textContent = properties.addButtonText;
    if (properties.buttonBgColor) addButton.style.backgroundColor = properties.buttonBgColor;
}

// 1. DATA MUTATION CONFIGURATION
// Automatically sets "Available" to false when a slot is booked
const crossTableMutations = [{
    when: 'create',
    sourceField: 'time',
    target: {
        field: 'available',
        value: false
    }
}];

// 2. CROSS-TABLE EXECUTOR
const runCrossTableMutations = async (mode, formData, sitemember_id) => {
    const rules = crossTableMutations.filter(r => r.when === mode);
    for (const rule of rules) {
        const targetRowId = formData[rule.sourceField];
        const fieldDef = schema.find(f => f.id === rule.sourceField);
        const targetSchemaId = fieldDef?.related_schema_id;

        if (targetRowId && targetSchemaId) {
            try {
                const res = await api.get(`/custom-data/rows/${targetSchemaId}?row_id=${targetRowId}`);
                const rows = res.data?.rows || res.rows || [];
                const existing = rows.find(r => r.row_id === targetRowId)?.data || {};

                await api.put(`/custom-data/rows/${targetRowId}`, {
                    data: { ...existing,
                        [rule.target.field]: rule.target.value
                    },
                    sitemember_id
                });
            } catch (err) {
                console.error('Mutation failed:', err);
            }
        }
    }
};

// 3. FETCH & RENDER (With Privacy & Boolean Fixes)
const fetchAndRenderRows = async () => {
    // PRIVACY: Stop if hideData is on
    if (properties.hideData) return;

    try {
        const skip = currentPage * rowsPerPage;
        const res = await api.get('/custom-data/rows/' + schemaId + '?skip=' + skip + '&limit=' + rowsPerPage);
        currentRows = res.data?.rows || res.rows || [];
        dataDisplay.innerHTML = '';
        const tmpl = container.querySelector('#displayTemplate').innerHTML;

        currentRows.forEach(row => {
            const div = document.createElement('div');
            const rowData = { ...row.data };

            schema.forEach(f => {
                // ✅ BOOLEAN DISPLAY FIX
                if (f.type === 'boolean') {
                    const val = rowData[f.id];
                    // Forces strict string 'true' or 'false'
                    rowData[f.id] = (val === true || val === 'true') ? 'true' : 'false';
                }

                // RELATION FIX
                if (f.type === 'relation' && rowData[f.id]) {
                    const d = rowData[f.id].data || rowData[f.id];
                    let label = d[f.id];
                    if (!label) label = Object.values(d).filter(v => typeof v !== 'object')[0];
                    rowData[f.id].display_label = label || '---';
                }
                // ✅ FILE/IMAGE DISPLAY FIX
            if (rowData[f.id] && (f.type === 'file' || f.type === 'image')) {
                // If the template expects a string, we give it the URL.
                // But if the AI template logic (Mustache) isn't set up for images, 
                // we can force HTML injection here if we modify the Mustache template dynamically, 
                // but usually, we just ensure the URL is clean.
                // For now, ensure it's treated as a string URL.
                rowData[f.id] = String(rowData[f.id]);
            }
            });

            div.innerHTML = Mustache.render(tmpl, {
                data: rowData,
                row_id: row.row_id
            });
            dataDisplay.appendChild(div);
        });
        
        // Update pagination buttons after rendering rows
        renderPagination();
        
    } catch (err) {
        console.error(err);
    }
};

// 4. PAGINATION LOGIC
const renderPagination = () => {
    if (!paginationControls) return;
    paginationControls.innerHTML = '';

    const prevBtn = document.createElement('button');
    prevBtn.textContent = 'Previous';
    prevBtn.className = 'px-3 py-1 border rounded bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed';
    prevBtn.disabled = currentPage === 0;
    prevBtn.onclick = () => {
        if (currentPage > 0) {
            currentPage--;
            fetchAndRenderRows();
        }
    };
    paginationControls.appendChild(prevBtn);

    const nextBtn = document.createElement('button');
    nextBtn.textContent = 'Next';
    nextBtn.className = 'px-3 py-1 border rounded bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed';
    nextBtn.disabled = currentRows.length < rowsPerPage;
    nextBtn.onclick = () => {
        if (currentRows.length === rowsPerPage) {
            currentPage++;
            fetchAndRenderRows();
        }
    };
    paginationControls.appendChild(nextBtn);
};

// 5. FORM GENERATION
const generateForm = async (initialData = {}) => {
    formContainer.innerHTML = '';
    formContainer.classList.remove('hidden');
    const form = document.createElement('form');
    form.className = 'grid grid-cols-1 md:grid-cols-2 gap-4';
    const selects = {};
    const relCache = {};

    for (const field of schema) {
        const wrapper = document.createElement('div');
        const label = document.createElement('label');
        label.className = 'block text-sm font-semibold text-gray-700 mb-1';
        label.textContent = field.label;
        wrapper.appendChild(label);

        if (field.type === 'relation') {
            const sel = document.createElement('select');
            sel.className = 'w-full p-2 border rounded-lg border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none transition-all';
            selects[field.id] = sel;
            sel.name = field.id;
            const res = await api.get(`/custom-data/rows/${field.related_schema_id}?limit=1000`);
            const rows = res.data?.rows || res.rows || [];
            relCache[field.id] = rows;
            sel.innerHTML = '<option value="">Select...</option>';

            // Dynamic Day/Time Logic
            if (field.id === 'day') {
                const seen = new Set();
                rows.forEach(r => {
                    const txt = r.data.day;
                    if (txt && !seen.has(txt)) {
                        seen.add(txt);
                        const opt = document.createElement('option');
                        opt.value = r.row_id;
                        opt.textContent = txt;
                        sel.appendChild(opt);
                    }
                });
                sel.addEventListener('change', () => {
                    const selectedDayText = sel.options[sel.selectedIndex].textContent;
                    const timeSelect = selects['time'];
                    if (timeSelect) {
                        timeSelect.innerHTML = '<option value="">Select Time...</option>';
                        const availableTimes = relCache['time'].filter(r =>
                            r.data.day === selectedDayText &&
                            (r.data.available === true || r.data.available === 'true')
                        );
                        availableTimes.forEach(r => {
                            const opt = document.createElement('option');
                            opt.value = r.row_id;
                            opt.textContent = `${r.data.start_time} - ${r.data.end_time}`;
                            timeSelect.appendChild(opt);
                        });
                    }
                });
            } else if (field.id !== 'time') {
                rows.forEach(r => {
                    const val = Object.values(r.data).filter(v => typeof v !== 'object')[0];
                    const opt = document.createElement('option');
                    opt.value = r.row_id;
                    opt.textContent = val;
                    sel.appendChild(opt);
                });
            }
            wrapper.appendChild(sel);

        } else if (field.type === 'boolean') {
            // ✅ BOOLEAN FORM FIX (Use Select instead of Input)
            const sel = document.createElement('select');
            sel.className = 'w-full p-2 border rounded-lg border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none transition-all';
            sel.name = field.id;
            sel.innerHTML = '<option value="true">True</option><option value="false">False</option>';
            const isTrue = initialData[field.id] === true || initialData[field.id] === 'true';
            sel.value = isTrue ? 'true' : 'false';
            wrapper.appendChild(sel);

        } else if (field.type === 'file' || field.type === 'image') {
            const input = document.createElement('input');
            input.type = 'file';
            input.className = 'w-full p-2 border rounded-lg border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none transition-all';
            
            const hiddenUrl = document.createElement('input');
            hiddenUrl.type = 'hidden';
            hiddenUrl.name = field.id;
            hiddenUrl.value = initialData[field.id] || '';
            wrapper.appendChild(hiddenUrl);

            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                
                // Select button safely
                const btn = form.querySelector('button[type="submit"]') || form.querySelector('button');
                const oldText = btn ? btn.innerText : 'Submit';
                
                if(btn) { btn.disabled = true; btn.innerText = 'Uploading...'; }
                
                try {
                    const formData = new FormData();
                    formData.append('file', file);
                    
                    // FIX: Use api.post to hit the Backend URL (Solves 404)
                    const res = await api.post('/uploads/', formData);
                    
                    // Handle response safely
                    const url = res.data ? res.data.url : res.url;
                    
                    if (url) {
                        hiddenUrl.value = url;
                        
                        // Visual Success
                        const msg = document.createElement('span');
                        msg.className = 'text-xs text-green-600 block mt-1';
                        msg.innerText = '✓ Ready to save';
                        if(input.nextSibling?.className?.includes('text-green-600')) input.nextSibling.remove();
                        input.parentNode.insertBefore(msg, input.nextSibling);
                    }
                } catch(err) {
                    console.error('Upload error:', err);
                    alert('Upload failed');
                    input.value = '';
                } finally {
                    if(btn) { btn.disabled = false; btn.innerText = oldText; }
                }
            };
            wrapper.appendChild(input);
            }else {
            const input = document.createElement('input');
            input.type = field.type;
            input.name = field.id;
            input.className = 'w-full p-2 border rounded-lg border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none transition-all';
            input.value = initialData[field.id] || '';
            wrapper.appendChild(input);
        }
        form.appendChild(wrapper);
    }

    const btn = document.createElement('button');
    btn.textContent = editingRowId ? 'Update' : 'Submit';
    btn.className = 'md:col-span-2 w-full bg-blue-600 text-white font-bold py-2.5 rounded-lg hover:bg-blue-700 transition-colors mt-2';
    form.appendChild(btn);

    form.onsubmit = async (e) => {
        e.preventDefault();
        const data = {};
        new FormData(form).forEach((v, k) => data[k] = v);

        if (data['time'] && data['day']) {
            const dayField = schema.find(f => f.id === 'day');
            const timeField = schema.find(f => f.id === 'time');
            if (dayField && timeField && dayField.related_schema_id === timeField.related_schema_id) {
                data['day'] = data['time'];
            }
        }

        const sitemember_id = properties.sitemember_id || null;
        try {
            if (editingRowId) {
                await api.put(`/custom-data/rows/${editingRowId}`, { data, sitemember_id });
                await runCrossTableMutations('update', data, sitemember_id);
            } else {
                await api.post(`/custom-data/rows/${schemaId}`, { data, sitemember_id });
                await runCrossTableMutations('create', data, sitemember_id);
            }
            alert('Success!');
            editingRowId = null;
            form.reset();
            formContainer.classList.add('hidden');
            
            // ✅ PRIVACY CHECK: Only refresh if allowed
            if (!properties.hideData) fetchAndRenderRows();
            
        } catch (err) {
            console.error(err);
        }
    };
    formContainer.appendChild(form);
};

// 6. EVENT LISTENERS
container.addEventListener('click', async (e) => {
    // Edit Button
    const editBtn = e.target.closest('.edit-btn');
    if (editBtn) {
        editingRowId = editBtn.dataset.rowId;
        const row = currentRows.find(r => r.row_id === editingRowId);
        if (row) generateForm(row.data);
    }

    // Delete Button
    const deleteBtn = e.target.closest('.delete-btn');
    if (deleteBtn) {
        if (confirm('Delete?')) {
            
            const rowElement = deleteBtn.closest('.transition-shadow');
            const originalText = deleteBtn.innerText;
            deleteBtn.innerText = '...';
            deleteBtn.disabled = true;

            try {
                const sitemember_id = properties.sitemember_id || null;
                const rowId = deleteBtn.dataset.rowId;
                
               
                await api.delete(`/custom-data/rows/${rowId}?sitemember_id=${sitemember_id || ''}`);
                
                if (rowElement) rowElement.remove();
                currentRows = currentRows.filter(r => r.row_id !== rowId);

            } catch (err) {
                console.error('Delete failed:', err);
                alert('Failed to delete.');
                deleteBtn.innerText = originalText;
                deleteBtn.disabled = false;
            }
        }
    }
});

if (addButton) {
    addButton.onclick = () => {
        editingRowId = null;
        generateForm();
    };
}


renderPagination();

"
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
                {"role": "system", "content": NEW_1_DATA_APP_GENERATOR_PROMPT},
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
            "editableProps": element_to_generate.get("editableProps", []),
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


