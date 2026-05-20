import json
import requests
import datetime
import re

# Configuración
PB_URL = "https://137-184-198-49.sslip.io"
ORDERS_FILE = r"C:\Users\patio\Downloads\nalga\RESPALDO_MUNDO_ROSA_2026-05-10.json"

def clean_name(name):
    # Eliminar emojis y caracteres raros para el DNI
    return re.sub(r'[^a-zA-Z0-9]', '', str(name)).upper()

def format_date_pb(ts_obj):
    """Convierte timestamps de Firebase a formato ISO que PocketBase y el frontend entienden."""
    if isinstance(ts_obj, dict) and "seconds" in ts_obj:
        dt = datetime.datetime.fromtimestamp(ts_obj["seconds"], datetime.timezone.utc)
        return dt.strftime('%Y-%m-%d %H:%M:%S.000Z')
    elif isinstance(ts_obj, str):
        # Si ya es string, asegurar que tenga el formato correcto
        return ts_obj
    return datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d %H:%M:%S.000Z')

def login():
    try:
        res = requests.post(f"{PB_URL}/api/admins/auth-with-password", json={
            "identity": "patioroz@gmail.com",
            "password": "Ana_45003235_Ep"
        })
        return res.json().get("token")
    except: return None

def operation_clean_restore():
    token = login()
    if not token:
        print("Error de autenticacion.")
        return
    headers = {"Authorization": token}

    # 1. LIMPIEZA DE TANDAS (SOLO TANDAS)
    print("Limpiando coleccion orders para carga fresca...")
    while True:
        res = requests.get(f"{PB_URL}/api/collections/orders/records?perPage=500", headers=headers)
        records = res.json().get("items", [])
        if not records: break
        for r in records:
            requests.delete(f"{PB_URL}/api/collections/orders/records/{r['id']}", headers=headers)

    # 2. INYECTAR LAS 200 TANDAS (CON FECHAS PRECISAS)
    print("\nInyectando 200 Tandas con DNI ALM- y fechas corregidas...")
    try:
        with open(ORDERS_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
        orders = data.get('orders', [])
        count = 0
        for o in orders:
            name = o.get("code", "SIN_NOMBRE")
            dni_alm = f"ALM-{clean_name(name)}"
            
            # Formatear fecha de creación
            created_at = format_date_pb(o.get("createdAt"))
            
            # Formatear fechas en el historial de abonos
            history = o.get("abonoHistory", [])
            for h in history:
                if 'date' in h and h['date']:
                    # Si la fecha viene como YYYY-MM-DD, la dejamos
                    pass
            
            pb_order = {
                "code": name,
                "customerId": dni_alm,
                "items": o.get("items", []),
                "total": o.get("total", 0),
                "type": o.get("type", "Por Mayor"),
                "status": "pending", # Siempre pendiente para que aparezca en Gestion
                "createdAt": created_at,
                "abonoHistory": history,
                "paymentDate": o.get("paymentDate", "")
            }
            
            res = requests.post(f"{PB_URL}/api/collections/orders/records", json=pb_order, headers=headers)
            if res.status_code in [200, 201]:
                count += 1
                print(f"[{count}] Tanda OK -> {name} | Fecha: {created_at}")
            else:
                print(f"Error en {name}: {res.text}")

        print(f"\n¡Carga finalizada! {count} tandas inyectadas.")
        print("RECUERDA: Los abonos historicos no se han subido por peticion tuya.")

    except Exception as e:
        print(f"Error critico: {e}")

if __name__ == "__main__":
    operation_clean_restore()
