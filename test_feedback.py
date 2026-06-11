import requests
import json
from datetime import date, timedelta

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

auditor_headers = {
    'X-User-Id': '3',
    'X-User-Role': 'auditor',
    'Content-Type': 'application/json'
}

today = date.today()
yesterday = today - timedelta(days=1)
yesterday_str = yesterday.strftime('%Y-%m-%d')
today_str = today.strftime('%Y-%m-%d')

print("=" * 60)
print("=== 测试执行反馈功能 ===")
print("=" * 60)

# Test 1: Create a past booking
print(f"\n=== Test 1: 创建昨日预约 (可反馈) ===")
booking_data = {
    'title': '执行反馈测试预约',
    'venue_id': 1,
    'date_start': yesterday_str,
    'date_end': yesterday_str,
    'time_start': '09:00',
    'time_end': '11:30',
    'visitor_count': 30,
    'staff_ids': [1, 2]
}
r = requests.post(f'{BASE}/bookings', headers=admin_headers, json=booking_data)
print(f'Status: {r.status_code}')
try:
    booking = r.json()
    booking_id = booking.get('id')
    print(f'✓ 创建成功: id={booking_id}, execution_status={booking.get("execution_status")}')
except Exception as e:
    print(f'✗ 失败: {e}')
    booking_id = None

# Test 2: Try to submit feedback for non-past booking (should fail)
print(f"\n=== Test 2: 创建今日预约 (未结束不可反馈) ===")
booking2_data = {
    'title': '今日预约(不可反馈)',
    'venue_id': 2,
    'date_start': today_str,
    'date_end': today_str,
    'time_start': '14:00',
    'time_end': '16:30',
    'visitor_count': 20,
    'staff_ids': [3]
}
r2 = requests.post(f'{BASE}/bookings', headers=admin_headers, json=booking2_data)
try:
    booking2 = r2.json()
    booking2_id = booking2.get('id')
    print(f'✓ 创建成功: id={booking2_id}')
except Exception as e:
    print(f'响应: {r2.text[:200]}')

# Test 3: Try auditor to submit feedback (should fail)
if booking_id:
    print(f"\n=== Test 3: 审计员尝试提交反馈 (应403) ===")
    fb_data = {
        'execution_result': 'completed',
        'actual_attendance': 28,
        'actual_staff': '张讲解员、李讲解员',
        'feedback_note': '测试反馈 - 审计员'
    }
    r3 = requests.post(f'{BASE}/bookings/{booking_id}/feedbacks', headers=auditor_headers, json=fb_data)
    print(f'Status: {r3.status_code}')
    if r3.status_code == 403:
        print('✓ 正确拒绝审计员提交反馈')
    else:
        try:
            print(f'响应: {r3.json()}')
        except:
            print(f'响应: {r3.text[:200]}')

# Test 4: Submit valid feedback as admin
if booking_id:
    print(f"\n=== Test 4: 管理员提交执行反馈 ===")
    fb_data = {
        'execution_result': 'completed',
        'actual_attendance': 28,
        'actual_staff': '张讲解员、李讲解员',
        'feedback_note': '讲解顺利完成，观众反响良好，提问环节活跃。'
    }
    r4 = requests.post(f'{BASE}/bookings/{booking_id}/feedbacks', headers=admin_headers, json=fb_data)
    print(f'Status: {r4.status_code}')
    try:
        fb = r4.json()
        if r4.status_code == 200:
            print(f'✓ 提交成功: id={fb.get("id")}, version={fb.get("version")}, result={fb.get("execution_result")}')
        else:
            print(f'响应: {fb}')
    except Exception as e:
        print(f'✗ 错误: {e}, 文本: {r4.text[:200]}')

# Test 5: Check booking execution_status after feedback
if booking_id:
    print(f"\n=== Test 5: 验证预约执行状态已更新 ===")
    r5 = requests.get(f'{BASE}/bookings/by-date/{yesterday_str}', headers=admin_headers)
    try:
        bookings = r5.json()
        for b in bookings:
            if b['id'] == booking_id:
                print(f'✓ execution_status = {b.get("execution_status")}')
                print(f'✓ has_feedback = {b.get("has_feedback")}')
                if b.get('feedback'):
                    print(f'✓ feedback.execution_result = {b["feedback"].get("execution_result")}')
                    print(f'✓ feedback.actual_attendance = {b["feedback"].get("actual_attendance")}')
    except Exception as e:
        print(f'错误: {e}')

# Test 6: Duplicate feedback submit (should fail)
if booking_id:
    print(f"\n=== Test 6: 重复提交反馈 (应409) ===")
    fb_data2 = {
        'execution_result': 'abnormal',
        'actual_attendance': 10
    }
    r6 = requests.post(f'{BASE}/bookings/{booking_id}/feedbacks', headers=admin_headers, json=fb_data2)
    print(f'Status: {r6.status_code}')
    if r6.status_code == 409:
        print('✓ 正确拒绝重复提交')
    else:
        try:
            print(f'响应: {r6.json()}')
        except:
            print(f'响应: {r6.text[:200]}')

# Test 7: Update existing feedback
if booking_id:
    print(f"\n=== Test 7: 修改执行反馈 ===")
    update_data = {
        'execution_result': 'abnormal',
        'actual_attendance': 25,
        'actual_staff': '张讲解员(临时有事提前离场)',
        'feedback_note': '更新：中途观众有事先走了一批，实际到场25人。',
        'change_reason': '修正人数和补充备注'
    }
    r7 = requests.put(f'{BASE}/bookings/{booking_id}/feedbacks', headers=admin_headers, json=update_data)
    print(f'Status: {r7.status_code}')
    try:
        fb = r7.json()
        if r7.status_code == 200:
            print(f'✓ 修改成功: version={fb.get("version")}, result={fb.get("execution_result")}, attendance={fb.get("actual_attendance")}')
        else:
            print(f'响应: {fb}')
    except Exception as e:
        print(f'✗ 错误: {e}, 文本: {r7.text[:200]}')

# Test 8: List all feedbacks
print(f"\n=== Test 8: 查询全部执行反馈 ===")
r8 = requests.get(f'{BASE}/feedbacks', headers=admin_headers)
try:
    feedbacks = r8.json()
    print(f'✓ 共 {len(feedbacks)} 条反馈记录')
    for fb in feedbacks:
        print(f'  - #{fb.get("id")} 预约#{fb.get("booking_id")} [{fb.get("execution_result")}] 到场{fb.get("actual_attendance")}人 v{fb.get("version")}')
except Exception as e:
    print(f'错误: {e}')

# Test 9: Check reminder API
print(f"\n=== Test 9: 检查提醒接口 (含待反馈提醒) ===")
r9 = requests.get(f'{BASE}/reminders/upcoming?days=3', headers=admin_headers)
try:
    reminders = r9.json()
    print(f'✓ 共 {len(reminders)} 条提醒')
    for r in reminders:
        rtype = r.get('reminder_type')
        print(f'  - [{rtype}] {r.get("title")} ({r.get("date_start")})')
        if rtype == 'need_feedback':
            print(f'    ⚠️ 需要反馈!')
except Exception as e:
    print(f'错误: {e}')

# Test 10: Check monthly stats has execution counts
print(f"\n=== Test 10: 月度统计含执行状态 ===")
r10 = requests.get(f'{BASE}/bookings/stats/month/{today.year}/{today.month}', headers=admin_headers)
try:
    stats = r10.json()
    # Find yesterday's stats
    for s in stats:
        if s['date'] == yesterday_str:
            print(f'✓ {yesterday_str}: pending={s.get("pending_count")}, ongoing={s.get("ongoing_count")}, completed={s.get("completed_count")}, need_feedback={s.get("need_feedback_count")}')
            break
except Exception as e:
    print(f'错误: {e}')

# Test 11: Check change logs include feedback operations
print(f"\n=== Test 11: 变更日志含反馈操作 ===")
if booking_id:
    r11 = requests.get(f'{BASE}/bookings/{booking_id}/change-logs', headers=auditor_headers)
    try:
        logs = r11.json()
        print(f'✓ 共 {len(logs)} 条变更记录')
        for log in logs:
            if 'feedback' in log.get('change_type', ''):
                print(f'  - [{log.get("change_type")}] {log.get("operator_name")} - {log.get("change_reason")}')
    except Exception as e:
        print(f'错误: {e}')

print("\n" + "=" * 60)
print("=== 测试完成 ===")
print("=" * 60)
