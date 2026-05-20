import requests
import json
import time

# --- CONFIGURATION ---
JSON_PATH = r'C:\Users\patio\Downloads\nalga\RESPALDO_MUNDO_ROSA_2026-05-10.json'
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

def import_orders():
    # 1. Load JSON
    print(f"Loading JSON from {JSON_PATH}...")
    with open(JSON_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    orders = data.get('orders', [])
    print(f"Found {len(orders)} orders in JSON.")

    # 2. Delete ALL current orders
    print("Deleting current orders from PocketBase...")
    # Fetch all first
    curr_res = requests.get(f'{POCKETBASE_URL}/api/collections/orders/records?perPage=500', headers=pb_headers)
    curr_items = curr_res.json().get('items', [])
    for item in curr_items:
        requests.delete(f'{POCKETBASE_URL}/api/collections/orders/records/{item["id"]}', headers=pb_headers)
    print(f"Deleted {len(curr_items)} old orders.")

    # 3. Upload new orders
    print(f"Uploading {len(orders)} orders...")
    count = 0
    for o in orders:
        # Prepare item for PB
        # Convert createdAt Firestore format to ISO string if needed
        # Actually, PB handles the JSON object if we pass it as a dict to a JSON field
        
        # Clean ID (let PB generate new ones)
        if 'id' in o: del o['id']
        
        # Ensure all required fields exist or map correctly
        # PocketBase schema: code, customerName, items, total, status, type, customerId, abonoHistory, createdAt (json)
        
        res = requests.post(f'{POCKETBASE_URL}/api/collections/orders/records', 
                            json=o, headers=pb_headers)
        
        if res.status_code in [200, 204, 201]:
            count += 1
        else:
            print(f"Error uploading order: {res.text}")
            
        if count % 20 == 0:
            print(f"Progress: {count}/{len(orders)}")
            time.sleep(0.05)

    print(f"\nSUCCESS! Restored {count} orders.")

if __name__ == "__main__":
    import_orders()
