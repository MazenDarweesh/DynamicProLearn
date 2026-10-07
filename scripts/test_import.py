import sys
from dotenv import load_dotenv
load_dotenv(r'e:\Mazen\EgyDynamic\LMS_CO_Pilot\.env')
sys.path.insert(0, r'e:\Mazen\EgyDynamic\LMS_CO_Pilot')

try:
    from src.services.search_service import SearchService
    print("SearchService imported OK!")
except Exception as e:
    import traceback
    print("IMPORT ERROR:")
    traceback.print_exc()
