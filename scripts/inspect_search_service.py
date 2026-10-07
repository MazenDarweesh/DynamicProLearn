with open(r'e:\Mazen\EgyDynamic\LMS_CO_Pilot\src\services\search_service.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for idx, line in enumerate(lines, 1):
    if '_extract_form_fields' in line or 'form_fill' in line or 'form_schema' in line or 'visible_fields' in line:
        print(f"Line {idx}: {line.strip()}")
