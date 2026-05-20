import json
import requests
import datetime

# Configuración
PB_URL = "https://137-184-198-49.sslip.io"
ORDERS_FILE = r"C:\RESPALDO MUNDO ROSA\orders_backup.json"
PAYMENTS_FILE = r"C:\RESPALDO MUNDO ROSA\payments_backup.json"

def convert_timestamp(ts_obj):
    if isinstance(ts_obj, dict) and "seconds" in ts_obj:
        return datetime.datetime.fromtimestamp(ts_obj["seconds"]).isoformat()
    return datetime.datetime.now().isoformat()

def login():
    print("Autenticando como administrador...")
    try:
        res = requests.post(f"{PB_URL}/api/admins/auth-with-password", json={
            "identity": "temp_admin@mundorosa.com",
            "password": "Mundorosa2026!"
        })
        if res.status_code == 200:
            return res.json().get("token")
        else:
            print(f"Error de login: {res.text}")
            return None
    except Exception as e:
        print(f"Error de conexion: {e}")
        return None

def restore():
    print("Iniciando restauracion de datos...")
    token = login()
    if not token:
        print("No se pudo obtener el token de administrador. Abortando.")
        return

    headers = {"Authorization": token}

    # 1. Cargar Pedidos (Tandas)
    try:
        with open(ORDERS_FILE, 'r', encoding='utf-8') as f:
            orders = json.load(f)
        
        print(f"Encontrados {len(orders)} pedidos. Subiendo...")
        for order in orders:
            # Limpiar datos para PocketBase
            pb_order = {
                "code": order.get("code", "Sin Nombre"),
                "customerId": order.get("customerId", ""),
                "items": order.get("items", []),
                "total": order.get("total", 0),
                "type": order.get("type", "Por Mayor"),
                "status": order.get("status", "pending"),
                "paymentDate": order.get("paymentDate", ""),
                "abonoHistory": order.get("abonoHistory", []),
                "createdAt": convert_timestamp(order.get("createdAt"))
            }
            
            # Intentar crear (Usamos la API pública si está abierta, o fallará y pedirá login)
            res = requests.post(f"{PB_URL}/api/collections/orders/records", json=pb_order, headers=headers)
            if res.status_code not in [200, 204]:
                print(f"Error al subir pedido {pb_order['code']}: {res.text}")
            else:
                print(f"Pedido restaurado: {pb_order['code']}")

    except Exception as e:
        print(f"❌ Error crítico en pedidos: {e}")

    # 2. Cargar Abonos
    try:
        with open(PAYMENTS_FILE, 'r', encoding='utf-8') as f:
            payments = json.load(f)
        
        print(f"Encontrados {len(payments)} abonos. Subiendo...")
        for pay in payments:
            pb_pay = {
                "customerName": pay.get("customerName", ""),
                "amount": pay.get("amount", 0),
                "date": pay.get("date", ""),
                "type": pay.get("type", ""),
                "advisorName": pay.get("advisorName", ""),
                "receiptImage": pay.get("receiptImage", ""),
                "reviewed": pay.get("reviewed", False),
                "createdAt": convert_timestamp(pay.get("createdAt"))
            }
            
            res = requests.post(f"{PB_URL}/api/collections/payments/records", json=pb_pay, headers=headers)
            if res.status_code not in [200, 204]:
                print(f"Error al subir abono: {res.text}")
            else:
                print(f"Abono restaurado de: {pb_pay['customerName']}")

    except Exception as e:
        print(f"❌ Error crítico en abonos: {e}")

    print("\nProceso de restauracion finalizado!")

if __name__ == "__main__":
    restore()
