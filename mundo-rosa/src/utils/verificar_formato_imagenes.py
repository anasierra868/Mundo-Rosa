import json

ORDERS_FILE = r"C:\RESPALDO MUNDO ROSA\orders_backup.json"

with open(ORDERS_FILE, 'r', encoding='utf-8') as f:
    data = json.load(f)

print(f"Analizando {len(data)} pedidos en el respaldo antiguo...")

found_base64 = 0
found_url = 0

for o in data:
    for a in o.get('abonoHistory', []):
        img = a.get('receiptImage', '')
        if not img: continue
        if img.startswith('data:image'):
            found_base64 += 1
        elif img.startswith('http'):
            found_url += 1

print(f"Abonos con imagen Real (Base64): {found_base64}")
print(f"Abonos con imagen Link (URL): {found_url}")
