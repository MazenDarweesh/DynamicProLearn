import sys
from dotenv import load_dotenv
load_dotenv(r'e:\Mazen\EgyDynamic\LMS_CO_Pilot\.env')
sys.path.insert(0, r'e:\Mazen\EgyDynamic\LMS_CO_Pilot')
from src.core.config import settings
from google import genai
import os

client = genai.Client(api_key=settings.GEMINI_API_KEY)

for m in ["gemini-2.5-flash", settings.GEMINI_MODEL, "gemini-2.0-flash"]:
    try:
        resp = client.models.generate_content(model=m, contents="Say OK")
        print(f"Model {m}: SUCCESS -> {resp.text.strip()}")
    except Exception as e:
        print(f"Model {m}: ERROR -> {e}")
