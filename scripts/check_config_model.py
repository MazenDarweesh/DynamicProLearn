import sys
from dotenv import load_dotenv
load_dotenv(r'e:\Mazen\EgyDynamic\LMS_CO_Pilot\.env')
sys.path.insert(0, r'e:\Mazen\EgyDynamic\LMS_CO_Pilot')
from src.core.config import settings
print("GEMINI_MODEL in config:", settings.GEMINI_MODEL)
