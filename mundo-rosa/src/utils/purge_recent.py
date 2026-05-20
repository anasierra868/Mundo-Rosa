import requests
from datetime import datetime, timezone

POCKETBASE_URL = 'http://137.184.198.49'
PB_ADMIN_EMAIL = 'admin@mundorosa.com'
PB_ADMIN_PASS = 'mundorosa2026'

auth_res = requests.post(f'{POCKETBASE_URL}/api/admins/auth-with-password', 
                         json={'identity': PB_ADMIN_EMAIL, 'password': PB_ADMIN_PASS})
pb_token = auth_res.json()['token']
pb_headers = {'Authorization': pb_token}

def purge_today(collection):
    print(f"Purging {collection} records created in the last hour...")
    res = requests.get(f'{POCKETBASE_URL}/api/collections/{collection}/records?perPage=1000&sort=-created', headers=pb_headers)
    items = res.json().get('items', [])
    count = 0
    now = datetime.now(timezone.utc)
    for item in items:
        # PB created format: '2026-05-11 05:14:10.123Z'
        created_str = item['created'].replace(' ', 'T')
        created_dt = datetime.fromisoformat(created_str.replace('Z', '+00:00'))
        
        diff = (now - created_dt).total_seconds()
        if diff < 3600: # 1 hour
            del_res = requests.delete(f'{POCKETBASE_URL}/api/collections/{collection}/records/{item["id"]}', headers=pb_headers)
            if del_res.status_code in [200, 204]:
                count += 1
    print(f"Deleted {count} records from {collection}")

purge_today('orders')
purge_today('payments')
