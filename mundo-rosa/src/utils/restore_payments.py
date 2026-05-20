import json
import requests
import datetime

# Configuración
PB_URL = "https://137-184-198-49.sslip.io"
PAYMENTS_FILE = r"C:\RESPALDO MUNDO ROSA\payments_backup.json"

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
    print("Iniciando restauracion de abonos...")
    token = login()
    if not token:
        print("No se pudo iniciar sesion.")
        return
    
    headers = {"Authorization": token}

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
            if res.status_code not in [200, 201, 204]:
                print(f"Error en abono {pb_pay['customerName']}: {res.text}")
            else:
                print(f"Abono OK -> {pb_pay['customerName']} (${pb_pay['amount']})")

    except Exception as e:
        print(f"Error critico: {e}")

    print("\nProceso de abonos finalizado!")

if __name__ == "__main__":
    restore()
