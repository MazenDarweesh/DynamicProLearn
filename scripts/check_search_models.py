with open(r'e:\Mazen\EgyDynamic\LMS_CO_Pilot\src\models\search_models.py', 'r', encoding='utf-8') as f:
    text = f.read()

for line in text.splitlines():
    if 'form_schema' in line or 'visible_fields' in line or 'erp_key' in line:
        print(line)
