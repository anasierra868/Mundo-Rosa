import requests
import json
import time
import random
import string

POCKETBASE_URL = 'http://137.184.198.49'
PB_ADMIN_EMAIL = 'admin@mundorosa.com'
PB_ADMIN_PASS = 'mundorosa2026'

def generate_dni():
    timestamp = int(time.time() * 1000)
    rand = ''.join(random.choices(string.ascii_lowercase + string.digits, k=7))
    return f"cust_{timestamp}_{rand}"

print("Authenticating...")
auth_res = requests.post(f'{POCKETBASE_URL}/api/admins/auth-with-password', 
                         json={'identity': PB_ADMIN_EMAIL, 'password': PB_ADMIN_PASS})
pb_token = auth_res.json()['token']
pb_headers = {'Authorization': pb_token}

def get_base_name(code):
    if not code: return ""
    return code.split(' (SEPARADO #')[0].split(' (separado #')[0].strip().upper()

def migrate():
    print("Fetching orders...")
    res = requests.get(f'{POCKETBASE_URL}/api/collections/orders/records?perPage=1000', headers=pb_headers)
    orders = res.json().get('items', [])
    print(f"Found {len(orders)} orders.")

    # Group orders by name to assign same DNI to same name
    name_to_dni = {}
    
    # First, collect existing customerIds if any
    for o in orders:
        name = get_base_name(o.get('code'))
        cid = o.get('customerId')
        if cid and name:
            name_to_dni[name] = cid

    count = 0
    for o in orders:
        name = get_base_name(o.get('code'))
        if not name: continue
        
        current_dni = o.get('customerId')
        
        if not current_dni:
            if name not in name_to_dni:
                name_to_dni[name] = generate_dni()
            
            target_dni = name_to_dni[name]
            print(f"Assigning DNI {target_dni} to {name} (Order {o['id']})")
            
            update_res = requests.patch(f'{POCKETBASE_URL}/api/collections/orders/records/{o["id"]}', 
                                        json={'customerId': target_dni}, 
                                        headers=pb_headers)
            if update_res.status_code == 200:
                count += 1
            else:
                print(f"Error updating order {o['id']}: {update_res.text}")
        
        if count % 20 == 0 and count > 0:
            time.sleep(0.1)

    print(f"Finished! Updated {count} orders with DNI.")

if __name__ == "__main__":
    migrate()
