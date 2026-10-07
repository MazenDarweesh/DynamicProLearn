with open(r'e:\Mazen\EgyDynamic\LMS_CO_Pilot\src\services\search_service.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

with open('scripts/search_stream_dump2.txt', 'w', encoding='utf-8') as out:
    for idx in range(855, min(940, len(lines))):
        out.write(f"{idx+1}: {lines[idx]}")
print("Dumped lines 856 to 940")
