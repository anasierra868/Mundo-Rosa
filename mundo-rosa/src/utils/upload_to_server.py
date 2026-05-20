import requests
import json
import time

# Configuración del Servidor
BASE_URL = "http://137.184.198.49"
ADMIN_EMAIL = "admin@mundorosa.com"
ADMIN_PASS = "mundorosa2026"
JSON_PATH = r"C:\Users\patio\Downloads\RESPALDO_ABSOLUTO_MUNDO_ROSA_2026-05-10_Original.json"

def upload():
    print(f"--- INICIANDO SUBIDA AL SERVIDOR: {BASE_URL} ---")
    
    # 1. Autenticación
    try:
        auth_res = requests.post(f"{BASE_URL}/api/admins/auth-with-password", json={
            "identity": ADMIN_EMAIL,
            "password": ADMIN_PASS
        })
        auth_res.raise_for_status()
        token = auth_res.json()["token"]
        headers = {"Authorization": token}
        print("OK: Autenticado como Administrador.")
    except Exception as e:
        print(f"ERROR: Error de autenticacion: {e}")
        return

    # 2. Cargar JSON
    try:
        with open(JSON_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        catalog = data.get("catalog", [])
        vault = data.get("vault", [])
        print(f"INFO: Cargados {len(catalog)} productos y {len(vault)} en la bodega.")
    except Exception as e:
        print(f"ERROR: Error al leer JSON: {e}")
        return

    # 4. Subir Catálogo (Products)
    print("START: Subiendo Catalogo...")
    for i, item in enumerate(catalog):
        try:
            clean_item = {k: v for k, v in item.items() if k not in ["id", "collectionId", "collectionName", "created", "updated"]}
            res = requests.post(f"{BASE_URL}/api/collections/products/records", json=clean_item, headers=headers)
            if res.status_code == 200 or res.status_code == 201:
                if i % 50 == 0: print(f"  > Procesados {i} productos...")
        except Exception as e:
            print(f"WARN: Error en item {i}: {e}")
        
        if i % 10 == 0: time.sleep(0.01)

    # 5. Subir Bodega (Sold Out)
    print("START: Subiendo Bodega...")
    for i, item in enumerate(vault):
        try:
            clean_item = {k: v for k, v in item.items() if k not in ["id", "collectionId", "collectionName", "created", "updated"]}
            requests.post(f"{BASE_URL}/api/collections/sold_out/records", json=clean_item, headers=headers)
        except: pass

    print("DONE: PROCESO FINALIZADO")
    print(f"Ya puedes entrar a {BASE_URL}/_/#/collections/products para ver tus datos.")

if __name__ == "__main__":
    upload()
