"""
Crea la colección 'customer_timers' en PocketBase para el sistema de temporizadores.
"""
import requests

BASE = "https://137-184-198-49.sslip.io"

# 1. Autenticarse como admin
auth = requests.post(f"{BASE}/api/admins/auth-with-password", json={
    "identity": "admin@mundorosa.com",
    "password": "mundorosa2026"
})

if auth.status_code != 200:
    auth = requests.post(f"{BASE}/api/admins/auth-with-password", json={
        "identity": "patioroz@gmail.com",
        "password": "Ana_45003235_Ep"
    })

if auth.status_code != 200:
    print(f"❌ Error de autenticación: {auth.status_code} - {auth.text}")
    exit(1)

token = auth.json()["token"]
headers = {"Authorization": token}

# 2. Crear la colección customer_timers
collection_data = {
    "name": "customer_timers",
    "type": "base",
    "schema": [
        {
            "name": "customerName",
            "type": "text",
            "required": True
        },
        {
            "name": "durationMs",
            "type": "number",
            "required": True
        },
        {
            "name": "startedAt",
            "type": "text",
            "required": False
        }
    ],
    "listRule": "",
    "viewRule": "",
    "createRule": "",
    "updateRule": "",
    "deleteRule": ""
}

resp = requests.post(f"{BASE}/api/collections", json=collection_data, headers=headers)

if resp.status_code in (200, 201):
    print(f"✅ Colección 'customer_timers' creada exitosamente!")
    print(f"   ID: {resp.json().get('id')}")
else:
    print(f"❌ Error al crear la colección: {resp.status_code}")
    print(resp.text)
