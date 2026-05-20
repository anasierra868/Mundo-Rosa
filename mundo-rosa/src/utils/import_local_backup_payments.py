import requests
import json
import time
import os

# --- CONFIGURATION ---
BACKUP_PATH = r'C:\RESPALDO MUNDO ROSA\payments_backup.json'
POCKETBASE_URL = 'http://137.184.198.49'
PB_ADMIN_EMAIL = 'admin@mundorosa.com'
PB_ADMIN_PASS = 'mundorosa2026'

# --- POCKETBASE AUTH ---
print("Authenticating with PocketBase...")
auth_res = requests.post(f'{POCKETBASE_URL}/api/admins/auth-with-password', 
                         json={'identity': PB_ADMIN_EMAIL, 'password': PB_ADMIN_PASS})
if auth_res.status_code != 200:
    print("PocketBase auth failed!")
    exit()
pb_token = auth_res.json()['token']
pb_headers = {'Authorization': pb_token}

def import_payments():
    if not os.path.exists(BACKUP_PATH):
        print(f"Backup file not found: {BACKUP_PATH}")
        return

    with open(BACKUP_PATH, 'r', encoding='utf-8') as f:
        payments = json.load(f)

    print(f"Found {len(payments)} payments in local backup.")
    
    # Get existing payments to avoid duplicates
    print("Checking existing payments in PocketBase...")
    existing_res = requests.get(f'{POCKETBASE_URL}/api/collections/payments/records?perPage=1000', headers=pb_headers)
    existing_ids = set()
    if existing_res.status_code == 200:
        existing_ids = {r.get('oldId') for r in existing_res.json().get('items', []) if r.get('oldId')}

    count = 0
    for p in payments:
        old_id = p.get('id')
        if old_id in existing_ids:
            continue
            
        # Prepare item
        item = {
            "customerName": p.get('customerName'),
            "amount": p.get('amount'),
            "date": p.get('date'),
            "advisorName": p.get('advisorName'),
            "type": p.get('type'),
            "receiptImage": p.get('receiptImage') or p.get('imageUrl'),
            "reviewed": p.get('reviewed', False),
            "imageUrl": p.get('imageUrl'),
            "oldId": old_id
        }
        
        # Handle Firestore timestamps
        if 'createdAt' in p and isinstance(p['createdAt'], dict):
            # Seconds to ISO
            ts = p['createdAt'].get('seconds', 0)
            item['createdAt'] = time.strftime('%Y-%m-%d %H:%M:%S', time.gmtime(ts))

        res = requests.post(f'{POCKETBASE_URL}/api/collections/payments/records', 
                            json=item, headers=pb_headers)
        
        if res.status_code in [200, 204, 201]:
            count += 1
        
        if count % 20 == 0:
            print(f"Imported {count} new payments...")

    print(f"Import finished. {count} new payments added.")

if __name__ == "__main__":
    import_payments()
