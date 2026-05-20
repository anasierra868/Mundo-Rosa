import json
import requests
import datetime
import re

# Configuración
PB_URL = "https://137-184-198-49.sslip.io"
ORDERS_FILE = r"C:\Users\patio\Downloads\nalga\RESPALDO_MUNDO_ROSA_2026-05-10.json"
PAYMENTS_FILE = r"C:\RESPALDO MUNDO ROSA\payments_backup.json"

def clean_name(name):
    return re.sub(r'[^a-zA-Z0-9]', '', str(name)).upper()

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

def operation_isolation():
    token = login()
    if not token:
        print("Error: No se pudo autenticar como administrador.")
        return
    headers = {"Authorization": token}

    # 1. LIMPIEZA TOTAL
    for collection in ["orders", "payments"]:
        print(f"Limpiando coleccion {collection}...")
        while True:
            res = requests.get(f"{PB_URL}/api/collections/{collection}/records?perPage=500", headers=headers)
            records = res.json().get("items", [])
            if not records: break
            print(f"Borrando bloque de {len(records)} en {collection}...")
            for r in records:
                requests.delete(f"{PB_URL}/api/collections/{collection}/records/{r['id']}", headers=headers)

    # 2. INYECTAR LAS 200 TANDAS (CON DNI ALM-)
    print("\nRestaurando 200 Tandas del Almacen (DNI ALM-)...")
    try:
        with open(ORDERS_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
        orders = data.get('orders', [])
        count_t = 0
        for o in orders:
            name = o.get("code", "SIN_NOMBRE")
            dni_alm = f"ALM-{clean_name(name)}"
            pb_order = {
                "code": name,
                "customerId": dni_alm,
                "items": o.get("items", []),
                "total": o.get("total", 0),
                "type": o.get("type", "Por Mayor"),
                "status": "pending",
                "paymentDate": o.get("paymentDate", ""),
                "abonoHistory": o.get("abonoHistory", []),
                "createdAt": convert_timestamp(o.get("createdAt"))
            }
            res = requests.post(f"{PB_URL}/api/collections/orders/records", json=pb_order, headers=headers)
            if res.status_code in [200, 201]:
                count_t += 1
                print(f"[{count_t}] Tanda OK -> {name}")
            else:
                print(f"Error en {name}: {res.text}")
        print(f"Subida de tandas finalizada: {count_t} de {len(orders)}")
    except Exception as e: print(f"Error en Tandas: {e}")

    # 3. INYECTAR ABONOS HISTORICOS (CON DNI ABONO-)
    print("\nRestaurando Abonos Historicos (DNI ABONO-)...")
    try:
        with open(PAYMENTS_FILE, 'r', encoding='utf-8') as f:
            payments = json.load(f)
        for p in payments:
            name = p.get("customerName", "SIN_NOMBRE")
            dni_hist = f"ABONO-{clean_name(name)}"
            pb_pay = {
                "customerName": name,
                "customerId": dni_hist, # DNI para consulta solamente
                "amount": p.get("amount", 0),
                "date": p.get("date", ""),
                "type": p.get("type", ""),
                "advisorName": p.get("advisorName", ""),
                "receiptImage": p.get("receiptImage", ""),
                "reviewed": p.get("reviewed", False),
                "createdAt": convert_timestamp(p.get("createdAt"))
            }
            res = requests.post(f"{PB_URL}/api/collections/payments/records", json=pb_pay, headers=headers)
            if res.status_code in [200, 201]:
                print(f"Abono OK -> {name}")
    except Exception as e: print(f"Error en Abonos: {e}")

    print("\n¡Operacion de Aislamiento Finalizada!")

if __name__ == "__main__":
    operation_isolation()
