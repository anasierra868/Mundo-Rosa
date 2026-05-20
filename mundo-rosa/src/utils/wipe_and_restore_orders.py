import json
import requests
import datetime

# Configuración
PB_URL = "https://137-184-198-49.sslip.io"
BACKUP_FILE = r"C:\Users\patio\Downloads\nalga\RESPALDO_MUNDO_ROSA_2026-05-10.json"

def convert_timestamp(ts_obj):
    if isinstance(ts_obj, dict) and "seconds" in ts_obj:
        return datetime.datetime.fromtimestamp(ts_obj["seconds"]).isoformat()
    return datetime.datetime.now().isoformat()

def login():
    try:
        res = requests.post(f"{PB_URL}/api/admins/auth-with-password", json={
            "identity": "patioroz@gmail.com",
            "password": "Ana_45003235_Ep"
        })
        return res.json().get("token")
    except: return None

def wipe_and_restore():
    token = login()
    if not token:
        print("Error de autenticacion.")
        return
    headers = {"Authorization": token}

    # 1. BORRAR TANDAS ACTUALES
    print("Borrando tandas viejas...")
    while True:
        res = requests.get(f"{PB_URL}/api/collections/orders/records?perPage=500", headers=headers)
        if res.status_code != 200: break
        records = res.json().get("items", [])
        if not records: break
        
        print(f"Borrando bloque de {len(records)} registros...")
        for r in records:
            requests.delete(f"{PB_URL}/api/collections/orders/records/{r['id']}", headers=headers)

    # 2. RESTAURAR LAS 200
    print("\nInyectando las 200 tandas reales...")
    try:
        with open(BACKUP_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
        orders = data.get('orders', [])
        
        for order in orders:
            pb_order = {
                "code": order.get("code", ""),
                "customerId": order.get("customerId", ""),
                "items": order.get("items", []),
                "total": order.get("total", 0),
                "type": order.get("type", "Por Mayor"),
                "status": order.get("status", "pending"),
                "paymentDate": order.get("paymentDate", ""),
                "abonoHistory": order.get("abonoHistory", []),
                "createdAt": convert_timestamp(order.get("createdAt"))
            }
            res = requests.post(f"{PB_URL}/api/collections/orders/records", json=pb_order, headers=headers)
            if res.status_code in [200, 201]:
                print(f"Restaurado -> {pb_order['code']}")
            else:
                print(f"ERROR en {pb_order['code']}: {res.status_code} - {res.text}")

    except Exception as e:
        print(f"Error: {e}")

    print("\n¡Limpieza y restauracion completada!")

if __name__ == "__main__":
    wipe_and_restore()
