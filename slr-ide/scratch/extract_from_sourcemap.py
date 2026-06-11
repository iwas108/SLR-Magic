import json

map_path = r"C:\Users\Aditya Suranata\Downloads\github\SLR-Magic\slr-ide\.next\dev\static\chunks\src_app_page_tsx_1gecvfk._.js.map"
out_path = r"C:\Users\Aditya Suranata\Downloads\github\SLR-Magic\slr-ide\src\app\page.tsx"

with open(map_path, 'r', encoding='utf-8') as f:
    data = json.load(f)

print("Keys in source map:", list(data.keys()))

def extract_source(map_obj):
    sources = map_obj.get("sources", [])
    contents = map_obj.get("sourcesContent", [])
    for idx, src in enumerate(sources):
        if "page.tsx" in src and idx < len(contents):
            return contents[idx]
    return None

recovered = extract_source(data)
if recovered:
    print(f"Found page.tsx in root map. Length: {len(recovered)}")
elif "sections" in data:
    print(f"Searching sections...")
    for sec_idx, section in enumerate(data["sections"]):
        inner_map = section.get("map", {})
        recovered = extract_source(inner_map)
        if recovered:
            print(f"Found page.tsx in section {sec_idx}. Length: {len(recovered)}")
            break

if recovered:
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(recovered)
    print("page.tsx recovered successfully!")
else:
    print("Could not find page.tsx source content.")
