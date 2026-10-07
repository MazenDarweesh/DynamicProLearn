with open(r'e:\Mazen\EgyDynamic\LMS_CO_Pilot\src\services\search_service.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

with open('scripts/search_stream_dump.txt', 'w', encoding='utf-8') as out:
    for idx in range(710, min(860, len(lines))):
        out.write(f"{idx+1}: {lines[idx]}")
print("Dumped lines 711 to 860")
