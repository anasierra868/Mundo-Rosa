import requests

# Configuracion
PB_URL = "https://137-184-198-49.sslip.io"

def login():
    try:
        res = requests.post(f"{PB_URL}/api/admins/auth-with-password", json={
            "identity": "patioroz@gmail.com",
            "password": "Ana_45003235_Ep"
        })
        return res.json().get("token")
    except: return None

def setup_print_jobs():
    token = login()
    if not token:
        print("Error de login.")
        return
    headers = {"Authorization": token}

    collection_data = {
        "name": "print_jobs",
        "type": "base",
        "schema": [
            {"name": "customerName", "type": "text"},
            {"name": "shipping", "type": "json", "options": {"maxSize": 2000000}},
            {"name": "orders", "type": "json", "options": {"maxSize": 2000000}},
            {"name": "totals", "type": "json", "options": {"maxSize": 2000000}},
            {"name": "status", "type": "text"}
        ],
        "listRule": "",
        "viewRule": "",
        "createRule": "",
        "deleteRule": ""
    }

    res = requests.post(f"{PB_URL}/api/collections", json=collection_data, headers=headers)
    
    if res.status_code in [200, 201]:
        print("EXITO: Coleccion 'print_jobs' creada.")
    else:
        print(f"ERROR: {res.status_code} - {res.text}")

if __name__ == "__main__":
    setup_print_jobs()
