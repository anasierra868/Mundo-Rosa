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
    # Si ya es un string ISO
    return str(ts_obj)

def login():
    try:
        res = requests.post(f"{PB_URL}/api/admins/auth-with-password", json={
            "identity": "patioroz@gmail.com",
            "password": "Ana_45003235_Ep"
        })
        return res.json().get("token")
    except: return None

def restore_real_payments():
    token = login()
    if not token:
        print("Error de login.")
        return
    headers = {"Authorization": token}

    # Fecha límite: Lunes 4 de mayo de 2026
    limit_date = datetime.datetime(2026, 5, 4, 0, 0, 0, tzinfo=datetime.timezone.utc)
    
    print(f"Buscando abonos reales desde el {limit_date.strftime('%Y-%m-%d')}...")
    
    try:
        with open(PAYMENTS_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        to_import = []
        for p in data:
            cr = p.get('createdAt', {})
            ts = cr.get('seconds', 0)
            if ts >= limit_date.timestamp():
                to_import.append(p)

        # Ordenar por fecha de registro (más reciente primero para el loop, aunque PB los guarda como lleguen)
        to_import.sort(key=lambda x: x.get('createdAt', {}).get('seconds', 0), reverse=True)

        print(f"Se encontraron {len(to_import)} abonos con imagen para restaurar.")

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
                print(f"[{success_count}/{len(to_import)}] OK -> {name} ({p.get('date')})")
            else:
                print(f"❌ Error en {name}: {res.text}")
            
            time.sleep(0.1)

        print(f"\nRestauración finalizada. Total con imagen: {success_count}")

    except Exception as e:
        print(f"Error fatal: {e}")

if __name__ == "__main__":
    restore_real_payments()
