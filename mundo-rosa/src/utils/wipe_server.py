import requests
import time

BASE_URL = "http://137.184.198.49"
ADMIN_EMAIL = "admin@mundorosa.com"
ADMIN_PASS = "mundorosa2026"

def wipe():
    auth_res = requests.post(f"{BASE_URL}/api/admins/auth-with-password", json={"identity": ADMIN_EMAIL, "password": ADMIN_PASS})
    token = auth_res.json()["token"]
    headers = {"Authorization": token}

    for coll in ["products", "sold_out"]:
        print(f"Wiping {coll}...")
        while True:
            res = requests.get(f"{BASE_URL}/api/collections/{coll}/records?perPage=200", headers=headers).json()
            items = res.get("items", [])
            if not items: break
            print(f"  Deleting {len(items)} items...")
            for item in items:
                try: requests.delete(f"{BASE_URL}/api/collections/{coll}/records/{item['id']}", headers=headers)
                except: pass
            time.sleep(0.1)
    print("DONE: WIPED.")

if __name__ == "__main__":
    wipe()
