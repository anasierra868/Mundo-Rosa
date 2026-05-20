import requests

PB_URL = "https://137-184-198-49.sslip.io"

def setup_cod_payments():
    print("Setting up cod_payments collection...")
    
    # Check if exists
    try:
        resp = requests.get(f"{PB_URL}/api/collections/cod_payments")
        if resp.status_code == 200:
            print("Collection exists. Verifying rules...")
        else:
            # Create collection
            collection_data = {
                "name": "cod_payments",
                "type": "base",
                "schema": [
                    {"name": "customerName", "type": "text", "required": True},
                    {"name": "advisorName", "type": "text", "required": False},
                    {"name": "amount", "type": "number", "required": True},
                    {"name": "createdAt", "type": "date", "required": False}
                ],
                "listRule": "",
                "viewRule": "",
                "createRule": "",
                "updateRule": "",
                "deleteRule": ""
            }
            create_resp = requests.post(f"{PB_URL}/api/collections", json=collection_data)
            if create_resp.status_code in [200, 201, 204]:
                print("Collection cod_payments created successfully.")
            else:
                print(f"Error creating collection: {create_resp.text}")
                
        # Ensure rules are public (empty string means public in PB)
        update_data = {
            "listRule": "",
            "viewRule": "",
            "createRule": "",
            "updateRule": "",
            "deleteRule": ""
        }
        # Get current collection ID or use name
        requests.patch(f"{PB_URL}/api/collections/cod_payments", json=update_data)
        print("Permissions set to public.")
        
    except Exception as e:
        print(f"Critical error: {e}")

if __name__ == "__main__":
    setup_cod_payments()
