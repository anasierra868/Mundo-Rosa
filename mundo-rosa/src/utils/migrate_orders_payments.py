import requests
import json
import time

# --- CONFIGURATION ---
FIREBASE_PROJECT_ID = 'mundo-rosa-a12b9'
POCKETBASE_URL = 'http://137.184.198.49'
PB_ADMIN_EMAIL = 'admin@mundorosa.com'
PB_ADMIN_PASS = 'mundorosa2026'

FIRESTORE_URL = f'https://firestore.googleapis.com/v1/projects/{FIREBASE_PROJECT_ID}/databases/(default)/documents'

# --- UTILS ---
def parse_firestore_value(val):
    if 'stringValue' in val: return val['stringValue']
    if 'integerValue' in val: return int(val['integerValue'])
    if 'doubleValue' in val: return float(val['doubleValue'])
    if 'booleanValue' in val: return val['booleanValue']
    if 'timestampValue' in val: return val['timestampValue']
    if 'nullValue' in val: return None
    if 'mapValue' in val:
        fields = val['mapValue'].get('fields', {})
        return {k: parse_firestore_value(v) for k, v in fields.items()}
    if 'arrayValue' in val:
        values = val['arrayValue'].get('values', [])
        return [parse_firestore_value(v) for v in values]
    return None

def fetch_firestore_collection(collection_name):
    all_docs = []
    next_page_token = None
    
    while True:
        url = f'{FIRESTORE_URL}/{collection_name}?pageSize=100'
        if next_page_token:
            url += f'&pageToken={next_page_token}'
        
        print(f"Fetching {collection_name} from Firebase...")
        res = requests.get(url)
        if res.status_code != 200:
            print(f"Error fetching {collection_name}: {res.text}")
            break
            
        data = res.json()
        docs = data.get('documents', [])
        for doc in docs:
            fields = doc.get('fields', {})
            parsed = {k: parse_firestore_value(v) for k, v in fields.items()}
            # Firestore ID is the last part of the name
            parsed['oldId'] = doc['name'].split('/')[-1]
            all_docs.append(parsed)
            
        next_page_token = data.get('nextPageToken')
        if not next_page_token:
            break
            
    print(f"Found {len(all_docs)} documents in {collection_name}")
    return all_docs

# --- POCKETBASE AUTH ---
print("Authenticating with PocketBase...")
auth_res = requests.post(f'{POCKETBASE_URL}/api/admins/auth-with-password', 
                         json={'identity': PB_ADMIN_EMAIL, 'password': PB_ADMIN_PASS})
if auth_res.status_code != 200:
    print("PocketBase auth failed!")
    exit()
pb_token = auth_res.json()['token']
pb_headers = {'Authorization': pb_token}

def upload_to_pocketbase(collection, data_list):
    print(f"Uploading {len(data_list)} records to PocketBase {collection}...")
    count = 0
    for item in data_list:
        # Clean data for PB
        # Ensure dates are strings or handled
        res = requests.post(f'{POCKETBASE_URL}/api/collections/{collection}/records', 
                            json=item, headers=pb_headers)
        if res.status_code not in [200, 204]:
            # Try patch if duplicate? Actually create is better for migration
            # Print error but continue
            # print(f"Error uploading to {collection}: {res.text}")
            pass
        else:
            count += 1
        
        if count % 10 == 0:
            print(f"Progress: {count}/{len(data_list)}")
            time.sleep(0.05)
    print(f"Successfully uploaded {count} records to {collection}")

# --- MAIN ---
# 1. Migrate Payments
payments = fetch_firestore_collection('payments')
# Map fields if necessary
upload_to_pocketbase('payments', payments)

# 2. Migrate Orders
orders = fetch_firestore_collection('orders')
# Process items/history to JSON strings if they are lists/dicts
for o in orders:
    if 'items' in o: o['items'] = o['items'] # PB handles JSON
    if 'abonoHistory' in o: o['abonoHistory'] = o['abonoHistory']
    if 'createdAt' in o: o['createdAt'] = o['createdAt']

upload_to_pocketbase('orders', orders)

print("\nMigration Complete!")
