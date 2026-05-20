import json
import requests
import time

def upload_images():
    filepath = r'C:\Users\patio\Downloads\nalga\catalogo_completo_969items_9-5-2026.json'
    base_url = 'http://137.184.198.49'
    
    # 1. Leer JSON de Firebase
    with open(filepath, 'r', encoding='utf-8') as f:
        d = json.load(f)
    catalog = d.get('catalog', {})
    items = list(catalog.values()) if isinstance(catalog, dict) else catalog
    
    # Mapear Firebase URLs por nombre de producto
    fb_images = {}
    for item in items:
        name = str(item.get('name', '')).strip().lower()
        img = item.get('image', '')
        if name and img and 'firebasestorage' in img:
            fb_images[name] = img

    print(f"Encontradas {len(fb_images)} imágenes de Firebase para migrar.")

    # 2. Autenticar PocketBase
    auth_res = requests.post(f'{base_url}/api/admins/auth-with-password', json={
        'identity': 'admin@mundorosa.com',
        'password': 'mundorosa2026'
    })
    token = auth_res.json().get('token')
    headers = {'Authorization': token} # Para multipart form data NO se pone Content-Type json

    # 3. Obtener todos los productos actuales de PocketBase
    print("Obteniendo catálogo actual...")
    pb_products = []
    page = 1
    while True:
        r = requests.get(f'{base_url}/api/collections/products/records?page={page}&perPage=500', headers=headers)
        data = r.json()
        items = data.get('items', [])
        pb_products.extend(items)
        if len(items) == 0 or data.get('totalPages') == page:
            break
        page += 1

    print(f"Encontrados {len(pb_products)} productos en PocketBase.")

    # 4. Inyectar imágenes
    success = 0
    errors = 0
    for i, p in enumerate(pb_products):
        name = str(p.get('name', '')).strip().lower()
        if name in fb_images and not p.get('image'): # Solo si no tiene imagen ya
            img_url = fb_images[name]
            try:
                # Descargar de Firebase
                img_res = requests.get(img_url, timeout=15)
                if img_res.status_code == 200:
                    # Preparar archivo para PocketBase
                    files = {
                        'image': ('imagen.webp', img_res.content, 'image/webp')
                    }
                    # Patch al producto
                    patch_res = requests.patch(
                        f"{base_url}/api/collections/products/records/{p['id']}", 
                        headers=headers, 
                        files=files
                    )
                    if patch_res.status_code == 200:
                        success += 1
                        if success % 10 == 0:
                            print(f"Migradas {success} fotos...")
                    else:
                        errors += 1
                else:
                    errors += 1
            except Exception as e:
                errors += 1
                
    print(f"MIGRACIÓN FINALIZADA. Exitosas: {success}, Errores: {errors}")

if __name__ == "__main__":
    upload_images()
