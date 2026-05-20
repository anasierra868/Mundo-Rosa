import json
import datetime
import random
import string

def gen_id():
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=15))

def convert_ts(ts):
    if isinstance(ts, dict) and "seconds" in ts:
        return datetime.datetime.fromtimestamp(ts["seconds"]).strftime('%Y-%m-%d %H:%M:%S.000Z')
    return datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S.000Z')

with open(r'C:\RESPALDO MUNDO ROSA\orders_backup.json', 'r', encoding='utf-8') as f:
    orders = json.load(f)

with open(r'C:\RESPALDO MUNDO ROSA\payments_backup.json', 'r', encoding='utf-8') as f:
    payments = json.load(f)

sql = []

# Restaurar Pedidos
for o in orders:
    oid = gen_id()
    created = convert_ts(o.get('createdAt'))
    code = o.get('code', '').replace("'", "''")
    cid = o.get('customerId', '')
    items = json.dumps(o.get('items', [])).replace("'", "''")
    total = o.get('total', 0)
    otype = o.get('type', 'Por Mayor')
    status = o.get('status', 'pending')
    pdate = o.get('paymentDate', '')
    ahistory = json.dumps(o.get('abonoHistory', [])).replace("'", "''")
    
    sql.append(f"INSERT INTO orders (id, created, updated, code, customerId, items, total, type, status, paymentDate, abonoHistory) VALUES ('{oid}', '{created}', '{created}', '{code}', '{cid}', '{items}', {total}, '{otype}', '{status}', '{pdate}', '{ahistory}');")

# Restaurar Abonos
for p in payments:
    pid = gen_id()
    created = convert_ts(p.get('createdAt'))
    cname = p.get('customerName', '').replace("'", "''")
    amount = p.get('amount', 0)
    date = p.get('date', '')
    ptype = p.get('type', '')
    aname = p.get('advisorName', '').replace("'", "''")
    img = p.get('receiptImage', '')
    rev = 1 if p.get('reviewed') else 0
    
    sql.append(f"INSERT INTO payments (id, created, updated, customerName, amount, date, type, advisorName, receiptImage, reviewed) VALUES ('{pid}', '{created}', '{created}', '{cname}', {amount}, '{date}', '{ptype}', '{aname}', '{img}', {rev});")

with open('restauracion.sql', 'w', encoding='utf-8') as f:
    f.write('\n'.join(sql))

print("Archivo restauracion.sql generado con exito.")
