import json

BACKUP_FILE = r"C:\Users\patio\Downloads\nalga\RESPALDO_MUNDO_ROSA_2026-05-10.json"

with open(BACKUP_FILE, 'r', encoding='utf-8') as f:
    data = json.load(f)

orders = data.get('orders', [])
print(f"Analizando {len(orders)} pedidos...")

total_abonos = 0
abonos_con_imagen = 0

for o in orders:
    hist = o.get('abonoHistory', [])
    for a in hist:
        total_abonos += 1
        # Buscamos 'receiptImage' o cualquier campo que parezca una imagen
        if a.get('receiptImage'):
            abonos_con_imagen += 1
        elif 'image' in str(a).lower():
             # Ver si hay algún otro campo con la palabra image
             for k in a.keys():
                 if 'image' in k.lower() and a[k]:
                     abonos_con_imagen += 1

print(f"Total abonos en historial: {total_abonos}")
print(f"Total abonos con imagen: {abonos_con_imagen}")
