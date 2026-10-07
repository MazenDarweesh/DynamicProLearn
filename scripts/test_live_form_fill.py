import sys
import json
import jwt
import datetime
import requests

sys.stdout.reconfigure(encoding='utf-8')

# 1. Generate valid JWT token for auth
secret = 'SuperSecretKeyNeedsToBeAtLeast32CharsLong123!'
payload = {
    'sub': 'test-admin',
    'email': 'admin@dynamicpro.com',
    'role': 'Admin',
    'iss': 'DynamicProLearn',
    'aud': 'DynamicProLearnClient',
    'exp': datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=2),
}
token = jwt.encode(payload, secret, algorithm='HS256')

# 2. Build test payload with Golden Test Query
request_data = {
    "query": "عايز ادخل فاتورة مشتريات من مورد شركة الحمد بطريقة شراء مباشرة من مخزن القاهرة ف يوم 2026-10-07 المنتج خامات الكمية 10 وسعر 100 ودفعت نقدي التكلفة كاملة",
    "skip_cache": True,
    "scope": "all",
    "erp_key": "purchase_invoice",
    "visible_fields": [
        "المورد (اسم المورد)",
        "طريقة الشراء",
        "المخزن",
        "التاريخ",
        "المدفوع نقداً"
    ],
    "form_schema": [
        {"key": "Supplier", "label": "المورد", "kind": "ng-select", "group": "header"},
        {"key": "PurchaseMethod", "label": "طريقة الشراء", "kind": "select", "group": "header"},
        {"key": "Warehouse", "label": "المخزن", "kind": "ng-select", "group": "header"},
        {"key": "Date", "label": "التاريخ", "kind": "date", "group": "header"},
        {"key": "ItemName", "label": "الصنف", "kind": "ng-select", "group": "grid"},
        {"key": "Quantity", "label": "الكمية", "kind": "number", "group": "grid"},
        {"key": "Cost", "label": "التكلفة", "kind": "number", "group": "grid"},
        {"key": "CashPaid", "label": "المدفوع نقداً", "kind": "number", "group": "footer"}
    ]
}

url = 'http://localhost:8000/v1/search/stream'
headers = {
    'Authorization': f'Bearer {token}',
    'Content-Type': 'application/json',
    'Accept': 'text/event-stream'
}

print('Sending SSE stream request with requests...', flush=True)

form_fill_event_received = None
tokens_received = []

with requests.post(url, json=request_data, headers=headers, stream=True, timeout=60) as resp:
    print(f'HTTP Status: {resp.status_code}', flush=True)
    if resp.status_code != 200:
        print(f'Error: {resp.text}', flush=True)
        sys.exit(1)

    current_event = ''
    for line in resp.iter_lines(decode_unicode=True):
        if not line:
            continue
        if line.startswith('event:'):
            current_event = line.replace('event:', '').strip()
        elif line.startswith('data:'):
            data_str = line.replace('data:', '').strip()
            try:
                data_json = json.loads(data_str)
            except Exception:
                data_json = data_str

            if current_event == 'form_fill':
                form_fill_event_received = data_json
                print('>>> RECEIVED FORM_FILL EVENT:', flush=True)
                print(json.dumps(data_json, ensure_ascii=False, indent=2), flush=True)
            elif current_event == 'token':
                if isinstance(data_json, dict) and 'text' in data_json:
                    tokens_received.append(data_json['text'])
                    sys.stdout.write(data_json['text'])
                    sys.stdout.flush()
            elif current_event == 'done':
                print('\n>>> RECEIVED DONE EVENT', flush=True)
                break

print('\n' + '='*50, flush=True)
if form_fill_event_received:
    print('SUCCESS! Form fill was emitted early and properly structured.', flush=True)
    print('Fields:', form_fill_event_received.get('fields'), flush=True)
    print('Rows:', form_fill_event_received.get('rows'), flush=True)
else:
    print('FAILURE: No form_fill event received!', flush=True)
print('='*50, flush=True)
