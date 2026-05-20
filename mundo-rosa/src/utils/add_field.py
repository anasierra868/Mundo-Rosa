import requests

def add_location_field():
    base_url = 'http://137.184.198.49'
    auth_res = requests.post(f'{base_url}/api/admins/auth-with-password', json={
        'identity': 'admin@mundorosa.com',
        'password': 'mundorosa2026'
    })
    token = auth_res.json()['token']
    
    headers = {'Authorization': token}
    
    # Get current collection info
    coll_res = requests.get(f'{base_url}/api/collections/products', headers=headers).json()
    schema = coll_res['schema']
    
    # Check if 'ubicacion' already exists
    if any(f['name'] == 'ubicacion' for f in schema):
        print("✅ El campo 'ubicacion' ya existe.")
        return

    # Add 'ubicacion' field
    schema.append({
        "name": "ubicacion",
        "type": "text",
        "required": False,
        "presentable": False,
        "unique": False,
        "options": {
            "min": None,
            "max": None,
            "pattern": ""
        }
    })
    
    # Update collection
    update_res = requests.patch(f'{base_url}/api/collections/products', 
                              headers=headers, 
                              json={"schema": schema})
    
    if update_res.status_code == 200:
        print("🚀 Campo 'ubicacion' creado con éxito en PocketBase.")
    else:
        print(f"❌ Error al crear campo: {update_res.text}")

if __name__ == "__main__":
    add_location_field()
