import asyncio
from google import genai
import os

api_key = os.getenv("GEMINI_API_KEY")
print("API Key present:", bool(api_key))

client = genai.Client(api_key=api_key)
try:
    resp = client.models.generate_content(
        model="gemini-2.5-flash",
        contents="Hello"
    )
    print("gemini-2.5-flash success:", resp.text)
except Exception as e:
    print("gemini-2.5-flash error:", e)

try:
    resp = client.models.generate_content(
        model="gemini-2.0-flash",
        contents="Hello"
    )
    print("gemini-2.0-flash success:", resp.text)
except Exception as e:
    print("gemini-2.0-flash error:", e)
