import requests
import json

base_url = 'http://137.184.198.49'
auth_res = requests.post(f'{base_url}/api/admins/auth-with-password', json={
    'identity': 'admin@mundorosa.com',
    'password': 'mundorosa2026'
})
token = auth_res.json().get('token')
headers = {'Authorization': token, 'Content-Type': 'application/json'}

# 1. Update Orders Schema
orders_col = requests.get(f'{base_url}/api/collections/orders', headers=headers).json()
col_id = orders_col['id']
current_order_fields = [f['name'] for f in orders_col.get('schema', [])]

new_order_fields = [
    {'name': 'type', 'type': 'text'},
    {'name': 'customerId', 'type': 'text'},
    {'name': 'separacionLocation', 'type': 'text'},
    {'name': 'paymentDate', 'type': 'text'},
    {'name': 'createdAt', 'type': 'json'},
    {'name': 'abonoHistory', 'type': 'json'}
]

for nf in new_order_fields:
    if nf['name'] not in current_order_fields:
        field = {
            'name': nf['name'],
            'type': nf['type'],
        }
        if nf['type'] == 'json':
            field['options'] = {'maxSize': 2000000}
        orders_col['schema'].append(field)

r1 = requests.patch(f"{base_url}/api/collections/{col_id}", json=orders_col, headers=headers)
print(f"Update orders result: {r1.status_code}")
if r1.status_code != 200: print(r1.text)

# 2. Update Payments Schema
payments_col = requests.get(f'{base_url}/api/collections/payments', headers=headers).json()
p_col_id = payments_col['id']
current_payment_fields = [f['name'] for f in payments_col.get('schema', [])]

new_payment_fields = [
    {'name': 'receiptImage', 'type': 'text'},
    {'name': 'reviewed', 'type': 'bool'},
    {'name': 'imageUrl', 'type': 'text'},
    {'name': 'createdAt', 'type': 'json'},
    {'name': 'lastEditedAt', 'type': 'json'}
]

for nf in new_payment_fields:
    if nf['name'] not in current_payment_fields:
        field = {
            'name': nf['name'],
            'type': nf['type'],
        }
        if nf['type'] == 'json':
            field['options'] = {'maxSize': 2000000}
        payments_col['schema'].append(field)

r2 = requests.patch(f"{base_url}/api/collections/{p_col_id}", json=payments_col, headers=headers)
print(f"Update payments result: {r2.status_code}")
if r2.status_code != 200: print(r2.text)
