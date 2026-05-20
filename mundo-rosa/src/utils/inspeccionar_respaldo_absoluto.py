import json

FILE = r"C:\Users\patio\Downloads\10-05-03\RESPALDO_ABSOLUTO_MUNDO_ROSA_2026-05-11.json"

with open(FILE, 'r', encoding='utf-8') as f:
    data = json.load(f)

payments = data.get('payments', [])
print(f"Analizando {len(payments)} abonos en el Respaldo Absoluto...")

found_base64 = 0
found_url = 0

for p in payments:
    img = p.get('receiptImage', '')
    if not img: continue
    if img.startswith('data:image'):
        found_base64 += 1
    elif img.startswith('http'):
        found_url += 1

print(f"Abonos con imagen Real (Base64): {found_base64}")
print(f"Abonos con imagen Link (URL): {found_url}")
