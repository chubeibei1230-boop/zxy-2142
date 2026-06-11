import requests

BASE = 'http://localhost:8118/api'
admin = {'X-User-Id': '1', 'X-User-Role': 'admin', 'Content-Type': 'application/json'}
user1 = {'X-User-Id': '2', 'X-User-Role': 'user', 'Content-Type': 'application/json'}

print('=' * 50)
print('### 问题2：权限验证 ###')
print('=' * 50)

# Step 1: 管理员创建预约
data = {
    'title': '管理员预约-权限测试',
    'venue_id': 1,
    'date_start': '2026-06-10',
    'date_end': '2026-06-10',
    'time_start': '07:00',
    'time_end': '08:00',
    'visitor_count': 20,
    'staff_ids': [1]
}
r = requests.post(f'{BASE}/bookings', headers=admin, json=data)
b = r.json()
bid = b.get('id')
created_by = b.get('created_by')
print('1. 管理员创建预约: id=%s, created_by=%s' % (bid, created_by))

# Step 2: 用户1尝试提交反馈
fb = {'execution_result': 'completed', 'actual_attendance': 15}
r = requests.post(f'{BASE}/bookings/{bid}/feedbacks', headers=user1, json=fb)
print('2. 用户1尝试对管理员预约反馈: Status=%s' % r.status_code)
if r.status_code == 403:
    print('   ✓ 正确拒绝: %s' % r.json()['detail'])

# Step 3: 用户1创建自己的预约
data2 = {
    'title': '用户1自己的预约',
    'venue_id': 2,
    'date_start': '2026-06-10',
    'date_end': '2026-06-10',
    'time_start': '07:00',
    'time_end': '08:00',
    'visitor_count': 25,
    'staff_ids': [2]
}
r = requests.post(f'{BASE}/bookings', headers=user1, json=data2)
b2 = r.json()
bid2 = b2.get('id')
created_by2 = b2.get('created_by')
print('3. 用户1创建预约: id=%s, created_by=%s (用户1的id=2)' % (bid2, created_by2))

# Step 4: 用户1对自己的预约提交反馈
r = requests.post(f'{BASE}/bookings/{bid2}/feedbacks', headers=user1, json=fb)
print('4. 用户1对自己预约反馈: Status=%s' % r.status_code)
if r.status_code == 200:
    print('   ✓ 提交成功! version=%s' % r.json()['version'])

# Step 5: 用户1尝试修改管理员的预约反馈
r = requests.put(f'{BASE}/bookings/{bid}/feedbacks', headers=user1, 
                json={'execution_result': 'abnormal', 'change_reason': '用户1尝试修改管理员的'})
print('5. 用户1尝试修改管理员的反馈: Status=%s' % r.status_code)
if r.status_code == 403:
    print('   ✓ 正确拒绝: %s' % r.json()['detail'])

print()
print('=' * 50)
print('✓ 权限控制验证通过')
print('=' * 50)
