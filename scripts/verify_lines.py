with open(r'e:\Mazen\EgyDynamic\LMS_CO_Pilot\src\services\search_service.py', 'r', encoding='utf-8') as f:
    text = f.read()

for line in text.splitlines():
    if 'model=' in line or 'GEMINI_MODEL' in line or 'form_schema' in line:
        print(line.strip())
