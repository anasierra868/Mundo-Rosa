import json
import requests
import datetime

# Configuración
PB_URL = "https://137-184-198-49.sslip.io"
SOLDOUT_FILE = r"C:\RESPALDO MUNDO ROSA\sold_out_backup.json"

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

def restore():
    print("Restaurando Baul de Agotados...")
    token = login()
    if not token: return
    headers = {"Authorization": token}

    try:
        with open(SOLDOUT_FILE, 'r', encoding='utf-8') as f:
            items = json.load(f)
        
        for item in items:
            pb_item = {
                "name": item.get("name", ""),
                "sku": item.get("sku", ""),
                "image": item.get("image", ""),
                "category": item.get("category", ""),
                "mayor": item.get("mayor", 0),
                "detal": item.get("detal", 0),
                "location": item.get("location", ""),
                "tags": item.get("tags", ""),
                "createdAt": convert_timestamp(item.get("createdAt"))
            }
            requests.post(f"{PB_URL}/api/collections/sold_out/records", json=pb_item, headers=headers)
        print("Baul de Agotados restaurado!")
    except Exception as e: print(f"Error: {e}")

if __name__ == "__main__":
    restore()
