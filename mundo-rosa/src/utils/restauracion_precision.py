import json
import requests
import time
import datetime
import re

# Configuración
PB_URL = "https://137-184-198-49.sslip.io"
ORDERS_FILE = r"C:\Users\patio\Downloads\nalga\RESPALDO_MUNDO_ROSA_2026-05-10.json"

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

def robust_restore():
    token = login()
    if not token:
        print("Error de login.")
        return
    headers = {"Authorization": token}

    # 1. LIMPIEZA TOTAL
    print("Iniciando limpieza profunda...")
    while True:
        res = requests.get(f"{PB_URL}/api/collections/orders/records?perPage=200", headers=headers)
        items = res.json().get("items", [])
        if not items: break
        print(f"Borrando {len(items)} registros...")
        for item in items:
            requests.delete(f"{PB_URL}/api/collections/orders/records/{item['id']}", headers=headers)
    
    # 2. CARGA DE PRECISIÓN
    print("\nIniciando carga de precision (200 tandas)...")
    try:
        with open(ORDERS_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
        orders = data.get('orders', [])
        
        success_count = 0
        for i, o in enumerate(orders):
            name = o.get("code", f"PEDIDO_{i}")
            dni_alm = f"ALM-{clean_name(name)}"
            created_at = format_date_pb(o.get("createdAt"))
            
            pb_order = {
                "code": name,
                "customerId": dni_alm,
                "items": o.get("items", []),
                "total": o.get("total", 0),
                "type": o.get("type", "Por Mayor"),
                "status": "pending",
                "createdAt": created_at,
                "abonoHistory": o.get("abonoHistory", []),
                "paymentDate": o.get("paymentDate", "")
            }
            
            res = requests.post(f"{PB_URL}/api/collections/orders/records", json=pb_order, headers=headers)
            
            if res.status_code in [200, 201]:
                success_count += 1
                print(f"[{success_count}/200] OK -> {name}")
            else:
                print(f"❌ ERROR en {name}: {res.status_code} - {res.text}")
            
            time.sleep(0.2) # Pausa de seguridad

        print(f"\nProceso finalizado. Total exitosos: {success_count}")
        
    except Exception as e:
        print(f"Error fatal: {e}")

if __name__ == "__main__":
    robust_restore()
