import json
import requests
import datetime
import time
import re

# Configuración
PB_URL = "https://137-184-198-49.sslip.io"
PAYMENTS_FILE = r"C:\RESPALDO MUNDO ROSA\payments_backup.json"
ORDERS_FILE = r"C:\RESPALDO MUNDO ROSA\orders_backup.json"

def clean_name(name):
    return re.sub(r'[^a-zA-Z0-9]', '', str(name)).upper()

def format_date_pb(ts_obj):
    if isinstance(ts_obj, dict) and "seconds" in ts_obj:
        dt = datetime.datetime.fromtimestamp(ts_obj["seconds"], datetime.timezone.utc)
        return dt.strftime('%Y-%m-%d %H:%M:%S.000Z')
    return str(ts_obj)

def login():
    try:
        res = requests.post(f"{PB_URL}/api/admins/auth-with-password", json={
            "identity": "patioroz@gmail.com",
            "password": "Ana_45003235_Ep"
        })
        return res.json().get("token")
    except: return None

def total_restoration():
    token = login()
    if not token:
        print("Error de login.")
        return
    headers = {"Authorization": token}

    # 1. PURGA TOTAL
    print("Limpiando Consultar Abonos para restauración total...")
    while True:
        res = requests.get(f"{PB_URL}/api/collections/payments/records?perPage=200", headers=headers)
        items = res.json().get("items", [])
        if not items: break
        for item in items:
            requests.delete(f"{PB_URL}/api/collections/payments/records/{item['id']}", headers=headers)

    limit_date = datetime.datetime(2026, 5, 4, 0, 0, 0, tzinfo=datetime.timezone.utc)
    seen_records = set() # Para evitar duplicados (Cliente + Valor + Fecha)
    to_import = []

    # FUENTE A: payments_backup.json
    try:
        with open(PAYMENTS_FILE, 'r', encoding='utf-8') as f:
            p_data = json.load(f)
        for p in p_data:
            ts = p.get('createdAt', {}).get('seconds', 0)
            if ts >= limit_date.timestamp():
                key = (p.get('customerName'), p.get('amount'), p.get('date'))
                if key not in seen_records:
                    seen_records.add(key)
                    to_import.append({
                        "customerName": p.get("customerName"),
                        "amount": p.get("amount", 0),
                        "date": p.get("date", ""),
                        "type": p.get("type", "Abono"),
                        "advisorName": p.get("advisorName", ""),
                        "receiptImage": p.get("receiptImage", ""),
                        "createdAt": format_date_pb(p.get("createdAt")),
                        "ts": ts
                    })
    except: print("Aviso: No se pudo leer el archivo de pagos.")

    # FUENTE B: orders_backup.json (Abono History)
    try:
        with open(ORDERS_FILE, 'r', encoding='utf-8') as f:
            o_data = json.load(f)
        for o in o_data:
            c_name = o.get("code", "").split(' (SEPARADO #')[0].strip()
            for a in o.get('abonoHistory', []):
                # Intentar obtener timestamp
                ts = 0
                if a.get('timestamp'):
                    try: ts = datetime.datetime.fromisoformat(a['timestamp'].replace('Z', '+00:00')).timestamp()
                    except: pass
                
                if ts >= limit_date.timestamp() or not ts: # Si no hay ts, usamos la fecha
                    key = (c_name, a.get('amount'), a.get('date'))
                    if key not in seen_records:
                        seen_records.add(key)
                        to_import.append({
                            "customerName": c_name,
                            "amount": a.get("amount", 0),
                            "date": a.get("date", ""),
                            "type": a.get("type", "Abono Historial"),
                            "advisorName": a.get("advisorName", ""),
                            "receiptImage": a.get("receiptImage", ""),
                            "createdAt": format_date_pb(a.get("timestamp")) if a.get("timestamp") else format_date_pb({"seconds": limit_date.timestamp()}),
                            "ts": ts if ts else limit_date.timestamp()
                        })
    except: print("Aviso: No se pudo leer el archivo de pedidos.")

    # Ordenar descendente por fecha de registro
    to_import.sort(key=lambda x: x['ts'], reverse=True)

    print(f"\nSubiendo {len(to_import)} registros totales para reporte de Excel...")

    success_count = 0
    for p in to_import:
        dni_abono = f"ABONO-{clean_name(p['customerName'])}"
        pb_data = p.copy()
        del pb_data['ts']
        pb_data['customerId'] = dni_abono
        
        res = requests.post(f"{PB_URL}/api/collections/payments/records", json=pb_data, headers=headers)
        if res.status_code in [200, 201]:
            success_count += 1
            print(f"[{success_count}/{len(to_import)}] OK -> {p['customerName']}")
        time.sleep(0.05)

    print(f"\nRestauración Contable Finalizada. Total: {success_count} registros.")

if __name__ == "__main__":
    total_restoration()
