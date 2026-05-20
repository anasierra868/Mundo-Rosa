import requests

def check_pb():
    base_url = 'http://137.184.198.49'
    auth_res = requests.post(f'{base_url}/api/admins/auth-with-password', json={
        'identity': 'admin@mundorosa.com',
        'password': 'mundorosa2026'
    })
    token = auth_res.json()['token']
    
    headers = {'Authorization': token}
    
    # List collections to see names
    collections = requests.get(f'{base_url}/api/collections?perPage=50', headers=headers).json()
    print("Colecciones encontradas:")
    for c in collections['items']:
        print(f"- {c['name']} (Campos: {[f['name'] for f in c['schema']]})")

if __name__ == "__main__":
    check_pb()
