import json
import requests
import datetime
import time
import re

# Configuración
PB_URL = "https://137-184-198-49.sslip.io"
BACKUP_FILE = r"C:\Users\patio\Downloads\nalga\RESPALDO_MUNDO_ROSA_2026-05-10.json"

def clean_name(name):
    return re.sub(r'[^a-zA-Z0-9]', '', str(name)).upper()

def format_date_pb(ts_obj):
    if isinstance(ts_obj, dict) and "seconds" in ts_obj:
        dt = datetime.datetime.fromtimestamp(ts_obj["seconds"], datetime.timezone.utc)
        return dt.strftime('%Y-%m-%d %H:%M:%S.000Z')
    return datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d %H:%M:%S.000Z')

def login():
    try:
        res = requests.post(f"{PB_URL}/api/admins/auth-with-password", json={
            "identity": "patioroz@gmail.com",
            "password": "Ana_45003235_Ep"
        })
        return res.json().get("token")
    except: return None

def restore_recent_payments():
    token = login()
    if not token:
        print("Error de login.")
        return
    headers = {"Authorization": token}

    print("Analizando abonos del respaldo...")
    try:
        with open(BACKUP_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        all_payments = data.get('payments', [])
        now = datetime.datetime.now(datetime.timezone.utc)
        two_weeks_ago = now - datetime.timedelta(days=14)
        
        to_import = []
        for p in all_payments:
            cr = p.get('createdAt', {})
            ts = cr.get('seconds', 0)
            if ts > two_weeks_ago.timestamp():
                to_import.append(p)

        print(f"Encontrados {len(to_import)} abonos de las últimas 2 semanas.")
        
        # Inyección
        success_count = 0
        for p in to_import:
            name = p.get("customerName", "DESCONOCIDO")
            # DNI Blindado para CONSULTAR ABONOS
            dni_abono = f"ABONO-{clean_name(name)}"
            
            pb_payment = {
                "customerName": name,
                "customerId": dni_abono, # AISLAMIENTO TOTAL
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
                print(f"[{success_count}/{len(to_import)}] Abono OK -> {name}")
            else:
                print(f"❌ Error en abono {name}: {res.text}")
            
            time.sleep(0.1)

        print(f"\nProceso finalizado. Total abonos restaurados: {success_count}")

    except Exception as e:
        print(f"Error fatal: {e}")

if __name__ == "__main__":
    restore_recent_payments()
