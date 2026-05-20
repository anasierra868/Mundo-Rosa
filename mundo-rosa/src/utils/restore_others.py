import json
import requests
import os

def restore_other_collections():
    base_url = 'http://137.184.198.49'
    backup_dir = r'C:\RESPALDO MUNDO ROSA'
    
    collections = {
        'orders_backup.json': 'orders',
        'payments_backup.json': 'payments',
        'cod_payments_backup.json': 'cod_payments',
        'sold_out_backup.json': 'sold_out',
        'customer_timers_backup.json': 'customer_timers',
        'print_jobs_backup.json': 'print_jobs'
    }
    
    auth_res = requests.post(f'{base_url}/api/admins/auth-with-password', json={
        'identity': 'admin@mundorosa.com',
        'password': 'mundorosa2026'
    })
    token = auth_res.json().get('token')
    headers = {'Authorization': token, 'Content-Type': 'application/json'}
    
    for filename, col_name in collections.items():
        filepath = os.path.join(backup_dir, filename)
        if not os.path.exists(filepath): continue
            
        print(f"Subiendo {col_name}...")
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
        success = 0
        for item in data:
            # Eliminar ID viejo (Firebase era de 20 letras, PB pide 15)
            # Dejamos que PB genere IDs nuevos automáticamente
            clean_item = {k: v for k, v in item.items() if k not in ['id', 'collectionId', 'collectionName', 'created', 'updated']}
            
            res = requests.post(f'{base_url}/api/collections/{col_name}/records', json=clean_item, headers=headers)
            if res.status_code in [200, 201]:
                success += 1
                
        print(f"-> {col_name}: {success}/{len(data)} listos.")

if __name__ == "__main__":
    restore_other_collections()
