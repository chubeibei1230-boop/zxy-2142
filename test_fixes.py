import requests
import json
from datetime import date, datetime, timedelta

BASE = 'http://localhost:8118/api'

admin_headers = {
    'X-User-Id': '1',
    'X-User-Role': 'admin',
    'Content-Type': 'application/json'
}

user_headers = {
    'X-User-Id': '2',
    'X-User-Role': 'user',
    'Content-Type': 'application/json'
}

user2_headers = {
    'X-User-Id': '4',
    'X-User-Role': 'user',
    'Content-Type': 'application/json'
}

today = date.today()
today_str = today.strftime('%Y-%m-%d')
yesterday_str = (today - timedelta(days=1)).strftime('%Y-%m-%d')

print("=" * 60)
print("=== 测试三个问题的修复 ===")
print("=" * 60)

print("\n" + "=" * 60)
print("### 问题1：预约结束时间后才能提交反馈 ###")
print("=" * 60)

# 创建一个今天但未结束的预约（结束时间设为当前时间后2小时）
now = datetime.now()
future_end = now + timedelta(hours=2)
future_end_time = f"{future_end.hour:02d}:{future_end.minute:02d}"
past_end = now - timedelta(hours=2)
past_end_time = f"{past_end.hour:02d}:{past_end.minute:02d}"

print(f"\n当前时间: {now.strftime('%Y-%m-%d %H:%M')}")

print(f"\n--- 测试1a: 创建今日未结束的预约 (结束时间 {future_end_time}) ---")
booking_future = {
    'title': '未结束预约-测试',
    'venue_id': 1,
    'date_start': today_str,
    'date_end': today_str,
    'time_start': f"{now.hour:02d}:{now.minute:02d}",
    'time_end': future_end_time,
    'visitor_count': 20,
    'staff_ids': [1]
}
r = requests.post(f'{BASE}/bookings', headers=admin_headers, json=booking_future)
b1 = r.json()
b1_id = b1.get('id')
print(f"✓ 创建成功: id={b1_id}, 结束时间={b1.get('time_end')}")

print(f"\n--- 测试1b: 尝试对未结束预约提交反馈 (应400) ---")
fb_data = {'execution_result': 'completed', 'actual_attendance': 15}
r = requests.post(f'{BASE}/bookings/{b1_id}/feedbacks', headers=admin_headers, json=fb_data)
print(f"Status: {r.status_code}")
if r.status_code == 400:
    print(f"✓ 正确拒绝: {r.json().get('detail')}")
else:
    print(f"✗ 错误: {r.text[:200]}")

print(f"\n--- 测试1c: 创建今日已结束的预约 (结束时间 {past_end_time}) ---")
booking_past = {
    'title': '已结束预约-测试',
    'venue_id': 2,
    'date_start': today_str,
    'date_end': today_str,
    'time_start': f"{past_end.hour:02d}:{past_end.minute:02d}",
    'time_end': past_end_time,
    'visitor_count': 25,
    'staff_ids': [2]
}
r = requests.post(f'{BASE}/bookings', headers=admin_headers, json=booking_past)
b2 = r.json()
b2_id = b2.get('id')
print(f"✓ 创建成功: id={b2_id}, 结束时间={b2.get('time_end')}")

print(f"\n--- 测试1d: 对已结束预约提交反馈 (应200) ---")
r = requests.post(f'{BASE}/bookings/{b2_id}/feedbacks', headers=admin_headers, json=fb_data)
print(f"Status: {r.status_code}")
if r.status_code == 200:
    print(f"✓ 提交成功! id={r.json().get('id')}, version={r.json().get('version')}")
else:
    print(f"✗ 错误: {r.text[:200]}")

print("\n" + "=" * 60)
print("### 问题2：普通用户只能对自己创建的预约提交反馈 ###")
print("=" * 60)

print(f"\n--- 测试2a: 普通用户(user2)创建预约 ---")
booking_user2 = {
    'title': '用户2的预约',
    'venue_id': 1,
    'date_start': yesterday_str,
    'date_end': yesterday_str,
    'time_start': '09:00',
    'time_end': '11:00',
    'visitor_count': 30,
    'staff_ids': [1]
}
r = requests.post(f'{BASE}/bookings', headers=user2_headers, json=booking_user2)
b3 = r.json()
b3_id = b3.get('id')
print(f"✓ 创建成功: id={b3_id}, created_by={b3.get('created_by')} (用户2的id=4)")

print(f"\n--- 测试2b: 普通用户(user1, id=2)尝试对用户2的预约提交反馈 (应403) ---")
fb_data2 = {'execution_result': 'completed', 'actual_attendance': 25}
r = requests.post(f'{BASE}/bookings/{b3_id}/feedbacks', headers=user_headers, json=fb_data2)
print(f"Status: {r.status_code}")
if r.status_code == 403:
    print(f"✓ 正确拒绝: {r.json().get('detail')}")
else:
    print(f"✗ 错误: {r.text[:200]}")

print(f"\n--- 测试2c: 用户2(id=4)对自己的预约提交反馈 (应200) ---")
r = requests.post(f'{BASE}/bookings/{b3_id}/feedbacks', headers=user2_headers, json=fb_data2)
print(f"Status: {r.status_code}")
if r.status_code == 200:
    print(f"✓ 提交成功! version={r.json().get('version')}")
else:
    print(f"✗ 错误: {r.text[:200]}")

print(f"\n--- 测试2d: 管理员对用户2的预约提交反馈 (应200) ---")
booking_admin = {
    'title': '管理员预约-给用户2修改',
    'venue_id': 2,
    'date_start': yesterday_str,
    'date_end': yesterday_str,
    'time_start': '14:00',
    'time_end': '16:00',
    'visitor_count': 15,
    'staff_ids': [2]
}
r = requests.post(f'{BASE}/bookings', headers=admin_headers, json=booking_admin)
b4 = r.json()
b4_id = b4.get('id')
print(f"✓ 管理员创建预约: id={b4_id}")

r = requests.post(f'{BASE}/bookings/{b4_id}/feedbacks', headers=admin_headers, json={'execution_result': 'completed', 'actual_attendance': 12})
print(f"管理员提交反馈: Status={r.status_code}")
if r.status_code == 200:
    print(f"✓ 管理员提交成功!")

print(f"\n--- 测试2e: 用户2尝试修改管理员的反馈 (应403) ---")
r = requests.put(f'{BASE}/bookings/{b4_id}/feedbacks', headers=user2_headers, json={'execution_result': 'abnormal', 'change_reason': '用户2尝试修改'})
print(f"Status: {r.status_code}")
if r.status_code == 403:
    print(f"✓ 正确拒绝: {r.json().get('detail')}")
else:
    print(f"✗ 错误: {r.text[:200]}")

print("\n" + "=" * 60)
print("### 问题3：反馈修改痕迹能还原每次修改前后的完整内容 ###")
print("=" * 60)

print(f"\n--- 测试3a: 管理员创建昨日预约并提交初始反馈 ---")
booking_test = {
    'title': '修改痕迹测试预约',
    'venue_id': 1,
    'date_start': yesterday_str,
    'date_end': yesterday_str,
    'time_start': '10:00',
    'time_end': '12:00',
    'visitor_count': 40,
    'staff_ids': [1, 2]
}
r = requests.post(f'{BASE}/bookings', headers=admin_headers, json=booking_test)
b5 = r.json()
b5_id = b5.get('id')
print(f"✓ 创建成功: id={b5_id}")

fb1_data = {
    'execution_result': 'completed',
    'actual_attendance': 38,
    'actual_staff': '张讲解员、李讲解员',
    'feedback_note': '初始反馈：讲解顺利完成，观众反应良好。'
}
r = requests.post(f'{BASE}/bookings/{b5_id}/feedbacks', headers=admin_headers, json=fb1_data)
fb1 = r.json()
print(f"✓ 初始反馈提交成功: v1, 到场={fb1.get('actual_attendance')}, 结果={fb1.get('execution_result')}")

print(f"\n--- 测试3b: 第一次修改反馈 ---")
fb2_data = {
    'execution_result': 'abnormal',
    'actual_attendance': 35,
    'actual_staff': '张讲解员（李讲解员临时请假）',
    'feedback_note': '修改：实际到场35人，李讲解员临时有事没来。',
    'change_reason': '修正人数和人员信息'
}
r = requests.put(f'{BASE}/bookings/{b5_id}/feedbacks', headers=admin_headers, json=fb2_data)
fb2 = r.json()
print(f"✓ 修改成功: v2, 到场={fb2.get('actual_attendance')}, 结果={fb2.get('execution_result')}")
print(f"  before_snapshot: {fb2.get('before_snapshot')[:80]}...")

print(f"\n--- 测试3c: 第二次修改反馈 ---")
fb3_data = {
    'execution_result': 'completed',
    'actual_attendance': 37,
    'actual_staff': '张讲解员、王讲解员（替班）',
    'feedback_note': '再次修改：实际到场37人，王讲解员替班。',
    'change_reason': '补充替班人员信息'
}
r = requests.put(f'{BASE}/bookings/{b5_id}/feedbacks', headers=admin_headers, json=fb3_data)
fb3 = r.json()
print(f"✓ 修改成功: v3, 到场={fb3.get('actual_attendance')}, 结果={fb3.get('execution_result')}")
print(f"  before_snapshot: {fb3.get('before_snapshot')[:80]}...")

print(f"\n--- 测试3d: 查询反馈历史，验证每个版本都有修改前快照 ---")
r = requests.get(f'{BASE}/bookings/{b5_id}/feedbacks', headers=admin_headers)
feedbacks = r.json()
print(f"✓ 共 {len(feedbacks)} 条反馈记录")

for i, fb in enumerate(reversed(feedbacks)):
    print(f"\n  === 版本 v{fb['version']} ===")
    print(f"  执行结果: {fb['execution_result']}")
    print(f"  实际到场: {fb['actual_attendance']} 人")
    print(f"  实际人员: {fb['actual_staff']}")
    print(f"  备注: {fb['feedback_note']}")
    print(f"  变更原因: {fb.get('change_reason')}")
    
    if fb.get('before_snapshot'):
        before = json.loads(fb['before_snapshot'])
        print(f"\n  📝 修改前内容 (v{before['version']}):")
        print(f"    执行结果: {before['execution_result']}")
        print(f"    实际到场: {before['actual_attendance']} 人")
        print(f"    实际人员: {before['actual_staff']}")
        print(f"    备注: {before['feedback_note']}")
        
        print(f"\n  ✅ 差异对比:")
        if before['execution_result'] != fb['execution_result']:
            print(f"    执行结果: {before['execution_result']} → {fb['execution_result']}")
        if before['actual_attendance'] != fb['actual_attendance']:
            print(f"    实际到场: {before['actual_attendance']} → {fb['actual_attendance']}")
        if before['actual_staff'] != fb['actual_staff']:
            print(f"    实际人员: {before['actual_staff']} → {fb['actual_staff']}")
        if before['feedback_note'] != fb['feedback_note']:
            print(f"    备注: {before['feedback_note'][:30]}... → {fb['feedback_note'][:30]}...")
    else:
        print(f"  (初始版本，无修改前快照)")

print("\n" + "=" * 60)
print("=== 所有测试完成 ===")
print("=" * 60)
