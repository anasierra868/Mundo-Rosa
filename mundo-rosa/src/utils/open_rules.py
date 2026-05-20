import requests

PB_URL = "https://137-184-198-49.sslip.io"

def login():
    try:
        res = requests.post(f"{PB_URL}/api/admins/auth-with-password", json={
            "identity": "patioroz@gmail.com",
            "password": "Ana_45003235_Ep"
        })
        return res.json().get("token")
    except: return None

def open_rules():
    print("Abriendo permisos de las colecciones...")
    token = login()
    if not token: 
        print("No se pudo iniciar sesion.")
        return
    
    headers = {"Authorization": token}
    collections = ["orders", "payments", "products", "sold_out"]

    for coll_name in collections:
        try:
            # Obtener el ID de la coleccion
            res = requests.get(f"{PB_URL}/api/collections/{coll_name}", headers=headers)
            if res.status_code != 200: continue
            
            coll_data = res.json()
            coll_id = coll_data["id"]

            # Actualizar reglas a publicas (vacío significa público en PocketBase para reglas de list/view)
            updated_data = {
                "listRule": "",
                "viewRule": "",
                "createRule": "",
                "updateRule": "",
                "deleteRule": ""
            }
            
            res_patch = requests.patch(f"{PB_URL}/api/collections/{coll_id}", json=updated_data, headers=headers)
            if res_patch.status_code == 200:
                print(f"✅ Permisos abiertos para: {coll_name}")
            else:
                print(f"❌ Error en {coll_name}: {res_patch.text}")
        except Exception as e:
            print(f"Error en {coll_name}: {e}")

if __name__ == "__main__":
    open_rules()
