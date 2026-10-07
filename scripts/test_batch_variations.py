import requests
import json
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
    {"key": "ItemName", "label": "اسم الصنف", "kind": "text", "group": "row"},
    {"key": "Quantity", "label": "الكمية", "kind": "number", "group": "row"},
    {"key": "Cost", "label": "التكلفة", "kind": "number", "group": "row"},
    {"key": "TotalAmount", "label": "إجمالي الفاتورة", "kind": "text", "group": "footer"},
    {"key": "CashPaid", "label": "المدفوع نقداً", "kind": "text", "group": "footer"}
]

test_queries = [
    # Q1: The original query
    "سجل لي دفعة من 3 فواتير مشتريات: الأولى من شركة التوحيد خامات المنتج كابلات شبكة CAT6 الكمية 10 وسعر 150 نقدي، الثانية من شركة الحمد للتجارة المنتج رواتر 5 وسعر 800، الثالثة من مؤسسة النور توريدات المنتج سويتشات 2 وسعر 1200",
    # Q2: Short bulleted format
    "أدخل 3 فواتير مشتريات متتالية:\n1. مورد التوحيد كابلات 10 سعر 150\n2. مورد الحمد راوتر 5 سعر 800\n3. مورد النور سويتش 2 سعر 1200",
    # Q3: Casual Arabic phrasing
    "عايز أسجل كذا فاتورة مشتريات ورا بعض: فاتورة لشركة التوحيد كابلات 10 وسعر 150، وفاتورة تانية لشركة الحمد رواتر 5 وسعر 800"
]

for idx, q in enumerate(test_queries, 1):
    print(f"\n==========================================")
    print(f"TEST QUERY {idx}:")
    print(f"\"{q[:60]}...\"")
    print(f"==========================================")
    
    req_body = {
        "query": q,
        "scope": "all",
        "erp_key": "PURCHASE_INVOICE",
        "form_schema": form_schema,
        "skip_cache": True
    }
    
    try:
        resp = requests.post(
            "http://localhost:8000/v1/search/stream",
            json=req_body,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {token}"
            },
            stream=True,
            timeout=40
        )
        resp.raise_for_status()
        found_fill = False
        for raw_line in resp.iter_lines():
            if not raw_line:
                continue
            line_str = raw_line.decode("utf-8").strip()
            if line_str.startswith("event: form_fill"):
                found_fill = True
            elif found_fill and line_str.startswith("data:"):
                data_json = json.loads(line_str[5:].strip())
                b_mode = data_json.get("batch_mode")
                b_items = data_json.get("batch_items", [])
                print(f"Result -> batch_mode: {b_mode}, batch_items count: {len(b_items)}")
                if not b_mode:
                    print("  [ALERT: Fell back to single mode!]")
                    print("  Fields:", json.dumps(data_json.get("fields", {}), ensure_ascii=False))
                else:
                    for i, it in enumerate(b_items):
                        print(f"  Item {i+1}: Supplier={it.get('fields',{}).get('Supplier')} Rows={len(it.get('rows',[]))}")
                break
            elif line_str.startswith("event: end"):
                break
    except Exception as e:
        print(f"Error: {e}")
