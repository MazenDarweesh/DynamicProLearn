with open(r'e:\Mazen\EgyDynamic\LMS_CO_Pilot\src\services\search_service.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

with open('scripts/check_extract_code.txt', 'w', encoding='utf-8') as out:
    for idx in range(625, min(700, len(lines))):
        out.write(f"{idx+1}: {lines[idx]}")
print("Dumped lines 626 to 700")
