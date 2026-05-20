import requests

res = requests.get('https://137-184-198-49.sslip.io/api/collections/payments/records?perPage=10')
data = res.json()

items = data.get('items', [])
print(f"Analizando {len(items)} registros en la base de datos...")

for i, item in enumerate(items):
    img = item.get('receiptImage', '')
    print(f"\n--- Registro {i+1} ---")
    print(f"Cliente: {item.get('customerName')}")
    print(f"Muestra imagen: {img[:100]}...")
    if img.startswith('http'):
        print("Tipo: URL (Enlace)")
    elif img.startswith('data:image'):
        print("Tipo: Base64 (Imagen Real)")
    else:
        print("Tipo: Desconocido")
