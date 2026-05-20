import json
import requests

def restore_catalog():
    filepath = r'C:\Users\patio\Downloads\RESPALDO_MUNDO_ROSA_2026-05-10.json'
    base_url = 'http://137.184.198.49'
    
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    items = data if isinstance(data, list) else data.get('items', data.get('products', data.get('records', [])))
    
    auth_res = requests.post(f'{base_url}/api/admins/auth-with-password', json={
        'identity': 'admin@mundorosa.com',
        'password': 'mundorosa2026'
    })
    token = auth_res.json().get('token')
        
    headers = {'Authorization': token, 'Content-Type': 'application/json'}
    
    success = 0
    errors = 0
    
    for i, item in enumerate(items):
        clean_item = {k: v for k, v in item.items() if k not in ['collectionId', 'collectionName', 'created', 'updated', 'image']}
        
        id = clean_item.get('id')
        if id:
            res = requests.patch(f'{base_url}/api/collections/products/records/{id}', json=clean_item, headers=headers)
            if res.status_code == 404:
                res = requests.post(f'{base_url}/api/collections/products/records', json=clean_item, headers=headers)
        else:
            res = requests.post(f'{base_url}/api/collections/products/records', json=clean_item, headers=headers)
            
        if res.status_code in [200, 201]:
            success += 1
        else:
            errors += 1
            
        if i % 100 == 0:
            print(f"Progreso: {i}/{len(items)}")
            
    print(f"Restauración de emergencia completada. Exitosos: {success}, Errores: {errors}")

if __name__ == "__main__":
    restore_catalog()
