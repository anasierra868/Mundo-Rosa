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
    print("Autenticando como administrador...")
    try:
        res = requests.post(f"{PB_URL}/api/admins/auth-with-password", json={
            "identity": "patioroz@gmail.com",
            "password": "Ana_45003235_Ep"
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
    print("Iniciando restauracion de las 200 tandas...")
    token = login()
    if not token:
        print("No se pudo iniciar sesion. Revisa las credenciales.")
        return
    
    headers = {"Authorization": token}

    try:
        with open(BACKUP_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        orders = data.get('orders', [])
        print(f"Encontrados {len(orders)} pedidos en el respaldo. Subiendo...")

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
            
            # Subir uno por uno (Como no tenemos login de admin activo, intentamos directo)
            # Nota: Si falla por permisos, tendremos que usar el modo SQL o Login.
            res = requests.post(f"{PB_URL}/api/collections/orders/records", json=pb_order, headers=headers)
            if res.status_code not in [200, 204, 201]:
                if "Only admins" in res.text:
                    print("Error: El servidor requiere login de administrador.")
                    return
                print(f"Error en pedido {pb_order['code']}: {res.text}")
            else:
                print(f"OK -> {pb_order['code']}")

    except Exception as e:
        print(f"Error critico: {e}")

    print("\nProceso finalizado!")

if __name__ == "__main__":
    restore()
