import json
import requests
import string
import random

def id_generator(size=15, chars=string.ascii_lowercase + string.digits):
    return ''.join(random.choice(chars) for _ in range(size))

def restore_master():
    filepath = r'C:\Users\patio\Downloads\nalga\catalogo_completo_969items_9-5-2026.json'
    base_url = 'http://137.184.198.49'
    
    with open(filepath, 'r', encoding='utf-8') as f:
        d = json.load(f)
    catalog = d.get('catalog', {})
    items = list(catalog.values()) if isinstance(catalog, dict) else catalog
    
    auth_res = requests.post(f'{base_url}/api/admins/auth-with-password', json={
        'identity': 'admin@mundorosa.com',
        'password': 'mundorosa2026'
    })
    token = auth_res.json().get('token')
    headers = {'Authorization': token}

    # Cargar los actuales para saber cuáles ya tienen imagen
    pb_products = {}
    page = 1
    while True:
        r = requests.get(f'{base_url}/api/collections/products/records?page={page}&perPage=500', headers={'Authorization': token, 'Content-Type': 'application/json'})
        data = r.json()
        for p in data.get('items', []):
            pb_products[p.get('name', '').strip().lower()] = p
        if len(data.get('items', [])) == 0 or data.get('totalPages') == page:
            break
        page += 1

    success = 0
    errors = 0
    skipped = 0
    
    print(f"Retomando Restauración... Total en el archivo: {len(items)}")
    
    for i, item in enumerate(items):
        name = str(item.get('name', '')).strip().lower()
        if not name:
            continue
            
        data_to_send = {
            'name': item.get('name', ''),
            'category': item.get('category', 'Otros 🎁'),
            'mayor': str(item.get('mayor', 0)),
            'detal': str(item.get('detal', 0)),
            'stock': str(item.get('stock', 0)),
            'location': str(item.get('location', '')),
            'ubicacion': str(item.get('ubicacion', item.get('location', '')))
        }
        
        img_url = item.get('image', '')
        files = None
        
        # Verificar si el producto ya existe en PocketBase
        if name in pb_products:
            existing_p = pb_products[name]
            # Si ya tiene una imagen asociada, no la volvemos a descargar
            if existing_p.get('image'):
                skipped += 1
                continue
            
            existing_id = existing_p['id']
            if img_url and 'firebasestorage' in img_url:
                try:
                    img_res = requests.get(img_url, timeout=10)
                    if img_res.status_code == 200:
                        files = {'image': ('imagen.webp', img_res.content, 'image/webp')}
                except:
                    pass
            res = requests.patch(f'{base_url}/api/collections/products/records/{existing_id}', data=data_to_send, files=files, headers=headers)
        else:
            if img_url and 'firebasestorage' in img_url:
                try:
                    img_res = requests.get(img_url, timeout=10)
                    if img_res.status_code == 200:
                        files = {'image': ('imagen.webp', img_res.content, 'image/webp')}
                except:
                    pass
            data_to_send['id'] = id_generator()
            res = requests.post(f'{base_url}/api/collections/products/records', data=data_to_send, files=files, headers=headers)
            
        if res.status_code in [200, 201]:
            success += 1
            if success % 20 == 0:
                print(f"Nuevos procesados: {success}")
        else:
            errors += 1
            
    print(f"FIN. Nuevos subidos: {success}, Ya listos (saltados): {skipped}, Errores: {errors}")

if __name__ == "__main__":
    restore_master()
