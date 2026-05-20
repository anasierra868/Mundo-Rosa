import requests
import json
import os
import time
from concurrent.futures import ThreadPoolExecutor

# CONFIGURACIÓN
PB_URL = "https://137-184-198-49.sslip.io"
COLLECTION = "products"
VAULT_COLLECTION = "sold_out"
OUTPUT_FILE = "catalogo_completo.json"
VAULT_FILE = "boveda_agotados.json"
IMAGES_DIR = "imagenes_catalogo"
VAULT_IMAGES_DIR = "imagenes_boveda"

def download_image(url, filename):
    if not url:
        return
    try:
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            with open(filename, 'wb') as f:
                f.write(response.content)
        else:
            print(f"❌ Error {response.status_code} al descargar: {url}")
    except Exception as e:
        print(f"❌ Error descargando {url}: {e}")

def download_collection(collection_name, output_filename, images_dir):
    print(f"📦 Descargando colección: {collection_name}...")
    all_records = []
    page = 1
    per_page = 200
    
    while True:
        url = f"{PB_URL}/api/collections/{collection_name}/records?page={page}&perPage={per_page}"
        response = requests.get(url)
        if response.status_code != 200:
            break
        data = response.json()
        items = data.get("items", [])
        all_records.extend(items)
        if len(items) < per_page:
            break
        page += 1
    
    with open(output_filename, 'w', encoding='utf-8') as f:
        json.dump(all_records, f, indent=4, ensure_ascii=False)
    
    if not os.path.exists(images_dir):
        os.makedirs(images_dir)
        
    tasks = []
    for p in all_records:
        img_url = p.get("image")
        if img_url:
            if img_url.startswith('http://137.184.198.49'):
                img_url = img_url.replace('http://137.184.198.49', 'https://137-184-198-49.sslip.io')
            
            ext = img_url.split('.')[-1].split('?')[0]
            if len(ext) > 4: ext = 'jpg'
            clean_name = "".join([c if c.isalnum() else "_" for c in p.get("name", "sin_nombre")])[:50]
            filename = os.path.join(images_dir, f"{p['id']}_{clean_name}.{ext}")
            tasks.append((img_url, filename))
    
    return tasks

def main():
    print(f"🚀 Iniciando SUPER-BACKUP desde {PB_URL}...")
    
    # Descargar Catálogo Principal
    tasks_active = download_collection(COLLECTION, OUTPUT_FILE, IMAGES_DIR)
    
    # Descargar Bóveda (Agotados)
    tasks_vault = download_collection(VAULT_COLLECTION, VAULT_FILE, VAULT_IMAGES_DIR)
    
    all_tasks = tasks_active + tasks_vault
    
    print(f"✅ JSONs guardados: {OUTPUT_FILE} y {VAULT_FILE}")
    print(f"🖼️ Descargando {len(all_tasks)} imágenes en total...")

    with ThreadPoolExecutor(max_workers=15) as executor:
        for url, fname in all_tasks:
            executor.submit(download_image, url, fname)

    print(f"✨ ¡PROCESO COMPLETADO! Revisa las carpetas '{IMAGES_DIR}' y '{VAULT_IMAGES_DIR}'.")

if __name__ == "__main__":
    main()
