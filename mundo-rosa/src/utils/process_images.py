import requests
import json
import base64
import os
import time

BASE_URL = "http://137.184.198.49"
ADMIN_EMAIL = "admin@mundorosa.com"
ADMIN_PASS = "mundorosa2026"
INPUT_JSON = r"C:\Users\patio\Downloads\RESPALDO_ABSOLUTO_MUNDO_ROSA_2026-05-10_Original.json"
OUTPUT_JSON = r"C:\Users\patio\Downloads\RESPALDO_LIMPIO_CON_ENLACES.json"
TEMP_DIR = "temp_images"

def process():
    print("--- INICIANDO PROCESAMIENTO DE IMAGENES ---")
    
    # 1. Auth
    auth_res = requests.post(f"{BASE_URL}/api/admins/auth-with-password", json={"identity": ADMIN_EMAIL, "password": ADMIN_PASS})
    token = auth_res.json()["token"]
    headers = {"Authorization": token}

    # 2. Cargar JSON
    with open(INPUT_JSON, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    catalog = data.get("catalog", [])
    vault = data.get("vault", [])
    print(f"INFO: Procesando {len(catalog)} productos en catalogo y {len(vault)} en bodega.")

    if not os.path.exists(TEMP_DIR):
        os.makedirs(TEMP_DIR)

    def process_list(items, list_name):
        print(f"START: Procesando {list_name}...")
        for i, item in enumerate(items):
            img_data = item.get("image", "")
            if img_data and img_data.startswith("data:image"):
                try:
                    # Extraer base64
                    header, encoded = img_data.split(",", 1)
                    ext = header.split(";")[0].split("/")[1]
                    if ext == "jpeg": ext = "jpg"
                    
                    # Guardar temporal
                    filename = f"img_{list_name}_{i}.{ext}"
                    filepath = os.path.join(TEMP_DIR, filename)
                    with open(filepath, "wb") as img_file:
                        img_file.write(base64.b64decode(encoded))
                    
                    # Subir a PocketBase (hosted_images)
                    with open(filepath, "rb") as img_file:
                        files = {"file": (filename, img_file, f"image/{ext}")}
                        res = requests.post(f"{BASE_URL}/api/collections/hosted_images/records", headers=headers, files=files)
                        
                    if res.status_code == 200:
                        rec = res.json()
                        file_url = f"{BASE_URL}/api/files/{rec['collectionId']}/{rec['id']}/{rec['file']}"
                        item["image"] = file_url
                    else:
                        print(f"WARN: Fallo al subir imagen de item {i}")
                    
                    # Limpiar temporal
                    os.remove(filepath)
                except Exception as e:
                    print(f"ERROR: Fallo con item {i}: {e}")
                    
            if i > 0 and i % 50 == 0:
                print(f"  > Procesados {i} items de {list_name}...")
                
            time.sleep(0.05) # Para no saturar el servidor

    process_list(catalog, "catalog")
    process_list(vault, "vault")

    # 3. Guardar JSON Limpio
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"DONE: JSON limpio guardado en {OUTPUT_JSON}")
    
    try:
        os.rmdir(TEMP_DIR)
    except: pass

if __name__ == "__main__":
    process()
