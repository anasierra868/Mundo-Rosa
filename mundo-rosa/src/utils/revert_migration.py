import requests

# --- CONFIGURATION ---
POCKETBASE_URL = 'http://137.184.198.49'
PB_ADMIN_EMAIL = 'admin@mundorosa.com'
PB_ADMIN_PASS = 'mundorosa2026'

# --- POCKETBASE AUTH ---
auth_res = requests.post(f'{POCKETBASE_URL}/api/admins/auth-with-password', 
                         json={'identity': PB_ADMIN_EMAIL, 'password': PB_ADMIN_PASS})
pb_token = auth_res.json()['token']
pb_headers = {'Authorization': pb_token}

def cleanup(collection):
    print(f"Cleaning up {collection}...")
    # Fetch records that have oldId (those were the migrated ones)
    res = requests.get(f'{POCKETBASE_URL}/api/collections/{collection}/records?perPage=500', headers=pb_headers)
    items = res.json().get('items', [])
    count = 0
    for item in items:
        if 'oldId' in item and item['oldId']:
            del_res = requests.delete(f'{POCKETBASE_URL}/api/collections/{collection}/records/{item["id"]}', headers=pb_headers)
            if del_res.status_code in [200, 204]:
                count += 1
    print(f"Deleted {count} migrated records from {collection}")

cleanup('orders')
cleanup('payments')
