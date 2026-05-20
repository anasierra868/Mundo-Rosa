import requests

# Configuración
PB_URL = "https://137-184-198-49.sslip.io"

def login():
    try:
        res = requests.post(f"{PB_URL}/api/admins/auth-with-password", json={
            "identity": "patioroz@gmail.com",
            "password": "Ana_45003235_Ep"
        })
        return res.json().get("token")
    except: return None

def check_collections():
    token = login()
    if not token:
        print("Error de login.")
        return
    headers = {"Authorization": token}

    res = requests.get(f"{PB_URL}/api/collections?perPage=100", headers=headers)
    if res.status_code == 200:
        items = res.json().get('items', [])
        names = [i['name'] for i in items]
        print(f"Tablas encontradas: {', '.join(names)}")
        
        if 'print_jobs' not in names:
            print("⚠️ 'print_jobs' NO existe. Creándola desde cero...")
            setup_print_jobs(token)
        else:
            print("✅ 'print_jobs' ya existe. Verificando permisos...")
            # Update permissions for the existing one
            cid = [i['id'] for i in items if i['name'] == 'print_jobs'][0]
            requests.patch(f"{PB_URL}/api/collections/{cid}", json={
                "listRule": "",
                "viewRule": "",
                "createRule": "",
                "deleteRule": ""
            }, headers=headers)
            print("✅ Permisos públicos ACTIVADOS.")

def setup_print_jobs(token):
    headers = {"Authorization": token}
    collection_data = {
        "name": "print_jobs",
        "type": "base",
        "schema": [
            {"name": "customerName", "type": "text"},
            {"name": "shipping", "type": "json"},
            {"name": "orders", "type": "json"},
            {"name": "totals", "type": "json"},
            {"name": "status", "type": "text"}
        ],
        "listRule": "",
        "viewRule": "",
        "createRule": "",
        "deleteRule": ""
    }
    res = requests.post(f"{PB_URL}/api/collections", json=collection_data, headers=headers)
    if res.status_code in [200, 201]:
        print("✅ Colección 'print_jobs' creada exitosamente.")
    else:
        print(f"❌ Error al crear: {res.text}")

if __name__ == "__main__":
    check_collections()
