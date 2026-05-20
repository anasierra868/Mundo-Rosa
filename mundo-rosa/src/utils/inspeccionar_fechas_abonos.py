import json
import datetime

BACKUP_FILE = r"C:\Users\patio\Downloads\nalga\RESPALDO_MUNDO_ROSA_2026-05-10.json"

with open(BACKUP_FILE, 'r', encoding='utf-8') as f:
    data = json.load(f)

payments = data.get('payments', [])
print(f"Total abonos en el archivo: {len(payments)}")

if payments:
    print("\nFechas de registro encontradas (Primeros 10):")
    for p in payments[:10]:
        sec = p.get('createdAt', {}).get('seconds', 0)
        dt = datetime.datetime.fromtimestamp(sec)
        print(f"- {p.get('customerName')}: {dt.strftime('%Y-%m-%d')}")

    print("\nFechas de registro encontradas (Últimos 10):")
    for p in payments[-10:]:
        sec = p.get('createdAt', {}).get('seconds', 0)
        dt = datetime.datetime.fromtimestamp(sec)
        print(f"- {p.get('customerName')}: {dt.strftime('%Y-%m-%d')}")
