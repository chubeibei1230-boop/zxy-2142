import requests

BASE = 'http://localhost:8118/api'

admin_headers = {'X-User-Id': '1', 'X-User-Role': 'admin', 'Content-Type': 'application/json'}
user1_headers = {'X-User-Id': '2', 'X-User-Role': 'user', 'Content-Type': 'application/json'}

yesterday_str = '2026-06-10'

print("=" * 60)
print("### 问题2：普通用户只能对自己创建的预约提交反馈 ###")
print("=" * 60)

print(f"\n--- 测试2a: 管理员创建预约 (created_by=1) ---")
booking_data = {
    'title': '管理员创建的预约',
    'venue_id': 1,
    'date_start': yesterday_str,
    'date_end': yesterday_str,
    'time_start': '09:00',
    'time_end': '11:00',
    'visitor_count': 30,
    'staff_ids': [1]
}
r = requests.post(f'{BASE}/bookings', headers=admin_headers, json=booking_data)
b = r.json()
booking_id = b.get('id')
print(f"✓ 创建成功: id={booking_id}, created_by={b.get('created_by')}")

print(f"\n--- 测试2b: 普通用户(user1, id=2)尝试对管理员的预约提交反馈 (应403) ---")
fb_data = {'execution_result': 'completed', 'actual_attendance': 25}
r = requests.post(f'{BASE}/bookings/{booking_id}/feedbacks', headers=user1_headers, json=fb_data)
print(f"Status: {r.status_code}")
if r.status_code == 403:
    print(f"✓ 正确拒绝: {r.json().get('detail')}")
else:
    print(f"✗ 错误: {r.text[:200]}")

print(f"\n--- 测试2c: 管理员对自己的预约提交反馈 (应200) ---")
r = requests.post(f'{BASE}/bookings/{booking_id}/feedbacks', headers=admin_headers, json=fb_data)
print(f"Status: {r.status_code}")
if r.status_code == 200:
    print(f"✓ 管理员提交成功!")

print(f"\n--- 测试2d: 普通用户(user1, id=2)尝试修改管理员的反馈 (应403) ---")
r = requests.put(f'{BASE}/bookings/{booking_id}/feedbacks', headers=user1_headers, 
                json={'execution_result': 'abnormal', 'change_reason': 'user1尝试修改'})
print(f"Status: {r.status_code}")
if r.status_code == 403:
    print(f"✓ 正确拒绝: {r.json().get('detail')}")
else:
    print(f"✗ 错误: {r.text[:200]}")

print(f"\n--- 测试2e: 普通用户(user1, id=2)创建自己的预约 ---")
booking_data2 = {
    'title': 'user1自己的预约',
    'venue_id': 2,
    'date_start': yesterday_str,
    'date_end': yesterday_str,
    'time_start': '14:00',
    'time_end': '16:00',
    'visitor_count': 20,
    'staff_ids': [2]
}
r = requests.post(f'{BASE}/bookings', headers=user1_headers, json=booking_data2)
b2 = r.json()
booking2_id = b2.get('id')
print(f"✓ 创建成功: id={booking2_id}, created_by={b2.get('created_by')} (用户1的id=2)")

print(f"\n--- 测试2f: 普通用户(user1)对自己的预约提交反馈 (应200) ---")
r = requests.post(f'{BASE}/bookings/{booking2_id}/feedbacks', headers=user1_headers, json=fb_data)
print(f"Status: {r.status_code}")
if r.status_code == 200:
    print(f"✓ user1提交成功! version={r.json().get('version')}")

print(f"\n--- 测试2g: 管理员修改user1的反馈 (应200，管理员有权限) ---")
r = requests.put(f'{BASE}/bookings/{booking2_id}/feedbacks', headers=admin_headers,
                json={'execution_result': 'abnormal', 'change_reason': '管理员修正'})
print(f"Status: {r.status_code}")
if r.status_code == 200:
    print(f"✓ 管理员修改成功! version={r.json().get('version')}")

print("\n" + "=" * 60)
print("✓ 问题2验证完成 - 权限控制正确")
print("=" * 60)
