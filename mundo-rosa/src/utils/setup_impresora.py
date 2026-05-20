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

def setup_print_jobs():
    token = login()
    if not token:
        print("Error de login.")
        return
    headers = {"Authorization": token}

    # Estructura de la colección print_jobs
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
        "listRule": "",  # Público para leer
        "viewRule": "",  # Público para ver
        "createRule": "", # Público para crear (necesario para la web)
        "updateRule": "",
        "deleteRule": ""  # Público para borrar (necesario para el script de impresora)
    }

    # Intentar crear la colección
    res = requests.post(f"{PB_URL}/api/collections", json=collection_data, headers=headers)
    
    if res.status_code == 200 or res.status_code == 201:
        print("✅ Colección 'print_jobs' creada exitosamente.")
    elif res.status_code == 400:
        # Si ya existe, actualizamos reglas para asegurar que sea pública
        print("La colección ya existe. Asegurando permisos públicos...")
        # Primero buscamos el ID
        res_list = requests.get(f"{PB_URL}/api/collections?filter=name='print_jobs'", headers=headers)
        if res_list.status_code == 200:
            cid = res_list.json()['items'][0]['id']
            requests.patch(f"{PB_URL}/api/collections/{cid}", json={
                "listRule": "",
                "viewRule": "",
                "createRule": "",
                "deleteRule": ""
            }, headers=headers)
            print("✅ Permisos de impresión actualizados.")
    else:
        print(f"Error inesperado: {res.status_code} - {res.text}")

if __name__ == "__main__":
    setup_print_jobs()
