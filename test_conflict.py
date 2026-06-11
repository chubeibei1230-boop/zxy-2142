import requests

headers = {
    'X-User-Id': '1',
    'X-User-Role': 'admin',
    'Content-Type': 'application/json'
}

print("=== Test 1: Create booking WITHOUT force_save (should fail with 409) ===")
data = {
    'title': '测试冲突预约',
    'venue_id': 1,
    'date_start': '2026-06-11',
    'date_end': '2026-06-11',
    'time_start': '09:00',
    'time_end': '11:30',
    'staff_ids': [1]
}
r = requests.post('http://localhost:8118/api/bookings', headers=headers, json=data)
print(f'Status: {r.status_code}')
try:
    print(f'Response: {r.json()}')
except:
    print(f'Response Text: {r.text}')

print("\n=== Test 2: Create booking WITH force_save but NO reason (should fail 400) ===")
data2 = dict(data)
data2['force_save'] = True
r2 = requests.post('http://localhost:8118/api/bookings', headers=headers, json=data2)
print(f'Status: {r2.status_code}')
try:
    print(f'Response: {r2.json()}')
except:
    print(f'Response Text: {r2.text}')

print("\n=== Test 3: Create booking WITH force_save AND reason (should succeed) ===")
data3 = dict(data)
data3['force_save'] = True
data3['change_reason'] = '测试强制保存覆盖冲突'
r3 = requests.post('http://localhost:8118/api/bookings', headers=headers, json=data3)
print(f'Status: {r3.status_code}')
try:
    resp = r3.json()
    print(f'Response (id, title, conflict info): id={resp.get("id")}, title={resp.get("title")}')
except:
    print(f'Response Text: {r3.text}')

print("\n=== Test 4: As normal user (role=user) with force_save (should fail 403) ===")
user_headers = {
    'X-User-Id': '2',
    'X-User-Role': 'user',
    'Content-Type': 'application/json'
}
data4 = dict(data)
data4['force_save'] = True
data4['change_reason'] = '普通用户尝试强制保存'
r4 = requests.post('http://localhost:8118/api/bookings', headers=user_headers, json=data4)
print(f'Status: {r4.status_code}')
try:
    print(f'Response: {r4.json()}')
except:
    print(f'Response Text: {r4.text}')

print("\n=== Test 5: As auditor (role=auditor) trying to create (should fail 403) ===")
aud_headers = {
    'X-User-Id': '3',
    'X-User-Role': 'auditor',
    'Content-Type': 'application/json'
}
data5 = {
    'title': '审计员创建测试',
    'venue_id': 2,
    'date_start': '2026-06-15',
    'date_end': '2026-06-15',
    'time_start': '14:00',
    'time_end': '16:30',
    'staff_ids': []
}
r5 = requests.post('http://localhost:8118/api/bookings', headers=aud_headers, json=data5)
print(f'Status: {r5.status_code}')
try:
    print(f'Response: {r5.json()}')
except:
    print(f'Response Text: {r5.text}')

print("\nAll tests completed!")
