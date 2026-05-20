import requests
import json
import time

BASE_URL = "http://137.184.198.49"
ADMIN_EMAIL = "admin@mundorosa.com"
ADMIN_PASS = "mundorosa2026"
JSON_PATH = r"C:\Users\patio\Downloads\RESPALDO_LIGERO_ENLACES_2026-05-11.json"

def upload():
    print(f"--- INICIANDO SUBIDA AL SERVIDOR ---")
    
    auth_res = requests.post(f"{BASE_URL}/api/admins/auth-with-password", json={
        "identity": ADMIN_EMAIL,
        "password": ADMIN_PASS
    })
    token = auth_res.json()["token"]
    headers = {"Authorization": token}
    
    with open(JSON_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    catalog = data.get("catalog", [])
    vault = data.get("vault", [])
    print(f"INFO: Subiendo {len(catalog)} productos y {len(vault)} en la bodega.")

    # Subir Catálogo (Products)
    print("START: Subiendo Catalogo...")
    for i, item in enumerate(catalog):
        try:
            clean_item = {k: v for k, v in item.items() if k not in ["id", "collectionId", "collectionName", "created", "updated"]}
            requests.post(f"{BASE_URL}/api/collections/products/records", json=clean_item, headers=headers)
        except Exception as e:
            pass
        if i % 50 == 0:
            print(f"  > Subidos {i} productos...")
        time.sleep(0.01)

    # Subir Bodega (Sold Out)
    print("START: Subiendo Bodega...")
    for i, item in enumerate(vault):
        try:
            clean_item = {k: v for k, v in item.items() if k not in ["id", "collectionId", "collectionName", "created", "updated"]}
            requests.post(f"{BASE_URL}/api/collections/sold_out/records", json=clean_item, headers=headers)
        except: pass

    # Refrescar caché global
    try:
        m = requests.get(f"{BASE_URL}/api/collections/metadata/records", headers=headers).json().get("items")[0]
        requests.patch(f"{BASE_URL}/api/collections/metadata/records/{m['id']}", json={"lastUpdate": str(int(time.time())), "forceRefresh": True}, headers=headers)
    except: pass

    print("DONE: PROCESO FINALIZADO")

if __name__ == "__main__":
    upload()
