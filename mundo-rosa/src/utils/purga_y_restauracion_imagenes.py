import json
import requests
import datetime
import time
import re

# Configuración
PB_URL = "https://137-184-198-49.sslip.io"
PAYMENTS_FILE = r"C:\RESPALDO MUNDO ROSA\payments_backup.json"

def clean_name(name):
    return re.sub(r'[^a-zA-Z0-9]', '', str(name)).upper()

def format_date_pb(ts_obj):
    if isinstance(ts_obj, dict) and "seconds" in ts_obj:
        dt = datetime.datetime.fromtimestamp(ts_obj["seconds"], datetime.timezone.utc)
        return dt.strftime('%Y-%m-%d %H:%M:%S.000Z')
    return str(ts_obj)

def login():
    try:
        res = requests.post(f"{PB_URL}/api/admins/auth-with-password", json={
            "identity": "patioroz@gmail.com",
            "password": "Ana_45003235_Ep"
        })
        return res.json().get("token")
    except: return None

def purge_and_restore_only_images():
    token = login()
    if not token:
        print("Error de login.")
        return
    headers = {"Authorization": token}

    # 1. PURGA TOTAL
    print("Iniciando purga total de abonos...")
    while True:
        res = requests.get(f"{PB_URL}/api/collections/payments/records?perPage=200", headers=headers)
        items = res.json().get("items", [])
        if not items: break
        print(f"Borrando {len(items)} abonos...")
        for item in items:
            requests.delete(f"{PB_URL}/api/collections/payments/records/{item['id']}", headers=headers)

    # 2. CARGA SOLO CON IMAGEN (Desde 4 Mayo)
    limit_date = datetime.datetime(2026, 5, 4, 0, 0, 0, tzinfo=datetime.timezone.utc)
    
    try:
        with open(PAYMENTS_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        to_import = []
        for p in data:
            cr = p.get('createdAt', {})
            ts = cr.get('seconds', 0)
            # REGLA: Debe tener imagen Y ser desde el 4 de mayo
            if ts >= limit_date.timestamp() and p.get('receiptImage'):
                to_import.append(p)

        print(f"\nSubiendo {len(to_import)} abonos REALES con imagen...")

        success_count = 0
        for p in to_import:
            name = p.get("customerName", "DESCONOCIDO")
            dni_abono = f"ABONO-{clean_name(name)}"
            
            pb_payment = {
                "customerName": name,
                "customerId": dni_abono,
                "amount": p.get("amount", 0),
                "date": p.get("date", ""),
                "type": p.get("type", "Abono"),
                "advisorName": p.get("advisorName", ""),
                "receiptImage": p.get("receiptImage", ""),
                "createdAt": format_date_pb(p.get("createdAt"))
            }
            
            res = requests.post(f"{PB_URL}/api/collections/payments/records", json=pb_payment, headers=headers)
            
            if res.status_code in [200, 201]:
                success_count += 1
                print(f"[{success_count}/{len(to_import)}] Imagen OK -> {name}")
            else:
                print(f"❌ Error en {name}: {res.status_code}")
            
            time.sleep(0.1)

        print(f"\nPurga y Restauración completada. Total colillas: {success_count}")

    except Exception as e:
        print(f"Error fatal: {e}")

if __name__ == "__main__":
    purge_and_restore_only_images()
