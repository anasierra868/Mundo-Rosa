import requests
import json
import time

BASE_URL = "http://137.184.198.49"
ADMIN_EMAIL = "admin@mundorosa.com"
ADMIN_PASS = "mundorosa2026"

def inject_links():
    print("--- INICIANDO INYECCION DE ENLACES ---")
    
    # 1. Auth
    auth_res = requests.post(f"{BASE_URL}/api/admins/auth-with-password", json={"identity": ADMIN_EMAIL, "password": ADMIN_PASS})
    token = auth_res.json()["token"]
    headers = {"Authorization": token}

    # 2. Obtener productos
    res = requests.get(f"{BASE_URL}/api/collections/products/records?perPage=1000", headers=headers)
    items = res.json().get("items", [])
    print(f"INFO: Procesando {len(items)} productos...")

    # 3. Actualizar enlaces
    for i, item in enumerate(items):
        img_name = item.get("image", "")
        # Solo inyectamos si es un nombre de archivo y no un link ya inyectado
        if img_name and not img_name.startswith("http"):
            # Construir link oficial de PocketBase
            coll_id = item["collectionId"]
            rec_id = item["id"]
            full_link = f"{BASE_URL}/api/files/{coll_id}/{rec_id}/{img_name}"
            
            try:
                requests.patch(f"{BASE_URL}/api/collections/products/records/{rec_id}", 
                               json={"image": full_link}, 
                               headers=headers)
                if i % 50 == 0: print(f"  > Inyectados {i} enlaces...")
            except: pass
        
        if i % 10 == 0: time.sleep(0.01)

    print("--- ✅ INYECCION FINALIZADA ---")

if __name__ == "__main__":
    inject_links()
