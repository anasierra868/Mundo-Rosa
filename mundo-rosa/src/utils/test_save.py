import requests

PB_URL = "https://137-184-198-49.sslip.io"

def test_save():
    print("Testing save to cod_payments...")
    data = {
        "customerName": "TEST CUSTOMER",
        "advisorName": "TEST ADVISOR",
        "amount": 1000
    }
    resp = requests.post(f"{PB_URL}/api/collections/cod_payments/records", json=data)
    print(f"Status: {resp.status_code}")
    print(f"Response: {resp.text}")

if __name__ == "__main__":
    test_save()
