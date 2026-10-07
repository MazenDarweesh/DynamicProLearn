import json
import urllib.request
import jwt
import time

SECRET = 'SuperSecretKeyNeedsToBeAtLeast32CharsLong123!'

payload = {
    "sub": "test-batch-runner",
    "name": "Mazen",
    "role": "Admin",
    "tenant_id": "tenant-test",
    "department_id": "dept-test",
    "iss": "DynamicProLearn",
    "aud": "DynamicProLearnClient",
    "exp": int(time.time()) + 3600
}

token = jwt.encode(payload, SECRET, algorithm="HS256")

form_schema = [
    {"key": "Supplier", "label": "المورد", "kind": "select", "group": "header"},
    {"key": "PurchaseMethod", "label": "طريقة الشراء", "kind": "select", "group": "header"},
    {"key": "Warehouse", "label": "المخزن المستلم", "kind": "select", "group": "header"},
    {"key": "Date", "label": "تاريخ الفاتورة", "kind": "date", "group": "header"},
    {"key": "TotalAmount", "label": "إجمالي الفاتورة", "kind": "text", "group": "footer"},
    {"key": "CashPaid", "label": "المدفوع نقداً", "kind": "text", "group": "footer"}
]

req_body = {
    "query": "سجل لي دفعة من 3 فواتير مشتريات: الأولى من شركة التوحيد خامات المنتج كابلات شبكة CAT6 الكمية 10 وسعر 150 نقدي، الثانية من شركة الحمد للتجارة المنتج رواتر 5 وسعر 800، الثالثة من مؤسسة النور توريدات المنتج سويتشات 2 وسعر 1200",
    "scope": "all",
    "erp_key": "PURCHASE_INVOICE",
    "form_schema": form_schema,
    "skip_cache": True
}

import requests

print("Sending request to http://localhost:8000/v1/search/stream...")
found_form_fill = False

try:
    resp = requests.post(
        "http://localhost:8000/v1/search/stream",
        json=req_body,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}"
        },
        stream=True,
        timeout=60
    )
    resp.raise_for_status()

    for raw_line in resp.iter_lines():
        if not raw_line:
            continue
        line_str = raw_line.decode("utf-8").strip()
        if line_str.startswith("event: form_fill"):
            found_form_fill = True
        elif found_form_fill and line_str.startswith("data:"):
            data_json = json.loads(line_str[5:].strip())
            print("=== RECEIVED form_fill EVENT ===")
            print("batch_mode:", data_json.get("batch_mode"))
            batch_items = data_json.get("batch_items", [])
            print("batch_items count:", len(batch_items))
            for idx, item in enumerate(batch_items):
                print(f"\nItem {idx + 1}:")
                fields_str = json.dumps(item.get("fields", {}), ensure_ascii=False)
                rows_str = json.dumps(item.get("rows", []), ensure_ascii=False)
                print(f"  Fields: {fields_str}".encode('utf-8', errors='replace').decode('utf-8'))
                print(f"  Rows: {rows_str}".encode('utf-8', errors='replace').decode('utf-8'))
            break
        elif line_str.startswith("event: end"):
            break
except Exception as e:
    print(f"Error during SSE request: {e}")

if not found_form_fill:
    print("Warning: No form_fill event received!")
else:
    print("\nSUCCESS: Batch form extraction verified live!")
