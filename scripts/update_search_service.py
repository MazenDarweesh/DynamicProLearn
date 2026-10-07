import re

file_path = r'e:/Mazen/EgyDynamic/LMS_CO_Pilot/src/services/search_service.py'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update _extract_form_fields_if_needed prompt and handling
old_method_start = '    async def _extract_form_fields_if_needed('
old_method_end = '    async def search_stream('

new_method = '''    async def _extract_form_fields_if_needed(
        self, query: str, visible_fields: list[str] | None, form_schema: list[dict] | None = None
    ) -> dict[str, Any]:
        if not visible_fields and not form_schema:
            return {}
        try:
            fields_ctx = form_schema if form_schema else visible_fields
            prompt = f"""You are an expert ERP Data Extraction Assistant for Dynamic Pro ERP.
Analyze the user's Arabic message and the active ERP form structure.
Extract all concrete data explicitly mentioned by the user.

Check if the user is asking to create/record MULTIPLE distinct documents/invoices/forms (Batch Mode) or just a SINGLE document.

Return a JSON with:
1. "batch_mode": true (if multiple documents/invoices are described) or false (if single).
2. "batch_items": If batch_mode is true, an array of objects, each containing:
   {{"fields": {{...}}, "rows": [...]}}
3. "fields": Object for header/form/footer fields of the single document (or the first document if batch).
4. "rows": Array of table line items for the single document (or the first document if batch).

Available Form Context:
{json.dumps(fields_ctx, ensure_ascii=False)}

User Message:
\"{query}\"

Rules:
1. Map values strictly to the matching field keys from the form context.
2. If the user mentions paying in cash or paying the full cost/amount (e.g. "دفعت نقدي التكلفة كاملة", "سداد كامل", "دفع بالكامل"), set the cash payment field (e.g. "CashPaid", "المدفوع نقداً", "المدفوع") to "$TOTAL".
3. For table items: each item mentioned by the user must be an object in the "rows" array with keys matching column names like {{"الصنف": "...", "الكمية": 10, "التكلفة": 100}}.
4. Keep user values literal as spoken (e.g. Arabic names of suppliers, items, warehouses).
5. If the user is only asking a generic question without providing data to input, return: {{"batch_mode": false, "fields": {{}}, "rows": []}}
6. Return ONLY valid JSON:
{{
  "batch_mode": false,
  "batch_items": [],
  "fields": {{ ... }},
  "rows": [ ... ]
}}"""

            resp = await asyncio.to_thread(
                self._gemini_client.models.generate_content,
                model="gemini-2.5-flash",
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.0,
                ),
            )
            data = json.loads(resp.text)
            if isinstance(data, dict):
                if "fields" not in data and "rows" not in data and "batch_items" not in data:
                    return {"batch_mode": False, "fields": data, "rows": []}
                return data
        except Exception as e:
            logger.error("Failed to extract ERP form data", error=str(e))
        return {}
'''

# Find positions
pos_start = content.find(old_method_start)
pos_end = content.find(old_method_end)

if pos_start == -1 or pos_end == -1:
    print(f"Error: Could not locate method bounds: {pos_start}, {pos_end}")
    exit(1)

content = content[:pos_start] + new_method + content[pos_end:]

# 2. Update SSE payload emission to include batch_mode and batch_items
old_payload_block = '''                payload = {
                    "intent": "form_fill",
                    "fields": fields_dict,
                    "rows": rows_list,
                    "screenKey": req.erp_key,
                }'''

new_payload_block = '''                batch_mode = bool(extracted_form_fields.get("batch_mode", False))
                batch_items = extracted_form_fields.get("batch_items", [])
                payload = {
                    "intent": "form_fill",
                    "fields": fields_dict,
                    "rows": rows_list,
                    "screenKey": req.erp_key,
                    "batch_mode": batch_mode,
                    "batch_items": batch_items,
                }'''

if old_payload_block not in content:
    print("Error: Could not find old_payload_block")
    exit(1)

content = content.replace(old_payload_block, new_payload_block, 1)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Successfully updated search_service.py!")
