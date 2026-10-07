import jwt
import time

SECRET = 'SuperSecretKeyNeedsToBeAtLeast32CharsLong123!'

payload = {
    "sub": "erp-mock-admin",
    "name": "مازن درويش",
    "role": "Admin",
    "tenant_id": "tenant-test",
    "department_id": "dept-test",
    "iss": "DynamicProLearn",
    "aud": "DynamicProLearnClient",
    "exp": int(time.time()) + 86400 * 365
}

token = jwt.encode(payload, SECRET, algorithm="HS256")
with open("scripts/mock_token.txt", "w", encoding="utf-8") as f:
    f.write(token)
print("Token written to scripts/mock_token.txt")
