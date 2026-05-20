import requests
import json

base_url = 'http://137.184.198.49'
auth_res = requests.post(f'{base_url}/api/admins/auth-with-password', json={
    'identity': 'admin@mundorosa.com',
    'password': 'mundorosa2026'
})
token = auth_res.json().get('token')
headers = {'Authorization': token, 'Content-Type': 'application/json'}

def clean_and_restore(col_name, backup_file):
    # 1. Delete all existing records
    page = 1
    while True:
        r = requests.get(f'{base_url}/api/collections/{col_name}/records?page={page}&perPage=500', headers=headers).json()
        items = r.get('items', [])
        for item in items:
            requests.delete(f"{base_url}/api/collections/{col_name}/records/{item['id']}", headers=headers)
        if len(items) == 0 or page >= r.get('totalPages', 1):
            break
        page += 1

    # 2. Upload from backup
    with open(backup_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    for item in data:
        # Keep everything except the Firebase auto-generated ID to let PB assign a 15-char one
        clean_item = {k: v for k, v in item.items() if k not in ['id', 'collectionId', 'collectionName', 'created', 'updated']}
        requests.post(f'{base_url}/api/collections/{col_name}/records', json=clean_item, headers=headers)
        
    print(f"Restaurado {col_name}: {len(data)} registros con fechas originales.")

clean_and_restore('orders', r'C:\RESPALDO MUNDO ROSA\orders_backup.json')
clean_and_restore('payments', r'C:\RESPALDO MUNDO ROSA\payments_backup.json')
