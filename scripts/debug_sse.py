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

q = "سجل لي دفعة من 3 فواتير مشتريات: الأولى من شركة التوحيد خامات المنتج كابلات شبكة CAT6 الكمية 10 وسعر 150 نقدي، الثانية من شركة الحمد للتجارة المنتج رواتر 5 وسعر 800، الثالثة من مؤسسة النور توريدات المنتج سويتشات 2 وسعر 1200"

req_body = {
    "query": q,
    "scope": "all",
    "erp_key": "PURCHASE_INVOICE",
    "form_schema": form_schema,
    "skip_cache": True
}

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

print("Status:", resp.status_code)
for raw_line in resp.iter_lines():
    if not raw_line:
        continue
    line_str = raw_line.decode("utf-8").strip()
    if line_str.startswith("event:"):
        print("EVENT:", line_str)
    elif "form_fill" in line_str or "batch" in line_str or "Supplier" in line_str:
        print("DATA_SNIPPET:", line_str[:120])
