import re

file_path = r'e:\Mazen\EgyDynamic\LMS_CO_Pilot\src\services\search_service.py'

with open(file_path, 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Fix cache checks to prevent stale cache when form_schema is provided
code = code.replace(
    'if settings.EXACT_CACHE_ENABLED and not req.skip_cache and not req.visible_fields:',
    'if settings.EXACT_CACHE_ENABLED and not req.skip_cache and not req.visible_fields and not req.form_schema:'
)
code = code.replace(
    'if settings.SEMANTIC_CACHE_ENABLED and not req.skip_cache and not req.visible_fields:',
    'if settings.SEMANTIC_CACHE_ENABLED and not req.skip_cache and not req.visible_fields and not req.form_schema:'
)

# 2. Update model in _extract_form_fields_if_needed from gemini-2.5-flash to settings.GEMINI_MODEL with fallback
old_gemini_call = '''            resp = await asyncio.to_thread(
                self._gemini_client.models.generate_content,
                model="gemini-2.5-flash",
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.0,
                ),
            )'''

new_gemini_call = '''            model_to_use = getattr(settings, "GEMINI_MODEL", "gemini-3.5-flash-lite")
            try:
                resp = await asyncio.to_thread(
                    self._gemini_client.models.generate_content,
                    model=model_to_use,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        temperature=0.0,
                    ),
                )
            except Exception as model_err:
                logger.warning("Primary model failed in form extraction, trying fallback", error=str(model_err))
                resp = await asyncio.to_thread(
                    self._gemini_client.models.generate_content,
                    model="gemini-2.5-flash",
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        temperature=0.0,
                    ),
                )'''

if old_gemini_call in code:
    code = code.replace(old_gemini_call, new_gemini_call)
    print("Replaced gemini model call successfully.")
else:
    print("Warning: old_gemini_call not found directly, checking regex...")
    code = re.sub(
        r'model="gemini-2\.5-flash"',
        'model=getattr(settings, "GEMINI_MODEL", "gemini-3.5-flash-lite")',
        code
    )

# 3. Enhance fallback late regex to detect batch_items if present in text
old_late_block = '''                        payload = {
                            "intent": "form_fill",
                            "fields": fields_data,
                            "screenKey": req.erp_key,
                        }'''

new_late_block = '''                        is_batch = bool(fields_data.get("batch_mode", False) or fields_data.get("batch_items"))
                        b_items = fields_data.get("batch_items", [])
                        f_dict = fields_data.get("fields", fields_data) if isinstance(fields_data, dict) else {}
                        r_list = fields_data.get("rows", []) if isinstance(fields_data, dict) else []
                        payload = {
                            "intent": "form_fill",
                            "fields": f_dict,
                            "rows": r_list,
                            "screenKey": req.erp_key,
                            "batch_mode": is_batch,
                            "batch_items": b_items,
                        }'''

if old_late_block in code:
    code = code.replace(old_late_block, new_late_block)
    print("Replaced late fallback block successfully.")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(code)

print("Saved updated search_service.py successfully!")
