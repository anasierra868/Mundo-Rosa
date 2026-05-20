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

def format_date_pb(dt):
    return dt.strftime('%Y-%m-%d %H:%M:%S.000Z')

def login():
    try:
        res = requests.post(f"{PB_URL}/api/admins/auth-with-password", json={
            "identity": "patioroz@gmail.com",
            "password": "Ana_45003235_Ep"
        })
        return res.json().get("token")
    except: return None

def extract_and_restore_abonos():
    token = login()
    if not token:
        print("Error de login.")
        return
    headers = {"Authorization": token}

    # Fecha límite: Lunes 4 de mayo de 2026
    limit_date = datetime.datetime(2026, 5, 4, 0, 0, 0, tzinfo=datetime.timezone.utc)
    
    print(f"Buscando abonos desde el {limit_date.strftime('%Y-%m-%d')}...")
    
    try:
        with open(BACKUP_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        orders = data.get('orders', [])
        extracted_abonos = []

        for o in orders:
            customer_name = o.get("code", "DESCONOCIDO").split(' (SEPARADO #')[0].strip()
            abono_history = o.get("abonoHistory", [])
            
            for a in abono_history:
                # Determinar fecha del abono
                # Algunos tienen 'timestamp' (ISO), otros solo 'date' (YYYY-MM-DD)
                abono_dt = None
                if a.get('timestamp'):
                    try:
                        abono_dt = datetime.datetime.fromisoformat(a['timestamp'].replace('Z', '+00:00'))
                    except: pass
                
                if not abono_dt and a.get('date'):
                    try:
                        abono_dt = datetime.datetime.strptime(a['date'], '%Y-%m-%d').replace(tzinfo=datetime.timezone.utc)
                    except: pass

                # Si no hay fecha o es posterior al límite, lo extraemos
                if abono_dt and abono_dt >= limit_date:
                    # DNI Blindado
                    dni_abono = f"ABONO-{clean_name(customer_name)}"
                    
                    extracted_abonos.append({
                        "customerName": customer_name,
                        "customerId": dni_abono,
                        "amount": a.get("amount", 0),
                        "date": a.get("date", ""),
                        "type": a.get("type", "Abono Historial"),
                        "advisorName": a.get("advisorName", "Respaldo"),
                        "receiptImage": a.get("receiptImage", ""),
                        "createdAt": format_date_pb(abono_dt),
                        "dt": abono_dt # Para ordenar localmente
                    })

        # Ordenar descendente (más reciente arriba)
        extracted_abonos.sort(key=lambda x: x['dt'], reverse=True)

        print(f"Se encontraron {len(extracted_abonos)} abonos con los criterios.")

        success_count = 0
        for i, p in enumerate(extracted_abonos):
            # Limpiar campo dt antes de enviar
            pb_data = p.copy()
            del pb_data['dt']
            
            res = requests.post(f"{PB_URL}/api/collections/payments/records", json=pb_data, headers=headers)
            
            if res.status_code in [200, 201]:
                success_count += 1
                print(f"[{success_count}/{len(extracted_abonos)}] Extraído OK -> {p['customerName']} ({p['date']})")
            else:
                print(f"❌ Error en {p['customerName']}: {res.text}")
            
            time.sleep(0.1)

        print(f"\nOperación finalizada. Total restaurados en Consultar Abonos: {success_count}")

    except Exception as e:
        print(f"Error fatal: {e}")

if __name__ == "__main__":
    extract_and_restore_abonos()
