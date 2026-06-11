from fastapi import FastAPI, Depends, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import date, datetime, timedelta
import json
from typing import List, Optional

from database import engine, Base, get_db
import models
import schemas

Base.metadata.create_all(bind=engine)

app = FastAPI(title="讲解预约管理系统", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_current_user(x_user_id: Optional[int] = Header(None), x_user_role: Optional[str] = Header(None), db: Session = Depends(get_db)):
    if not x_user_id:
        raise HTTPException(status_code=401, detail="未登录")
    user = db.query(models.User).filter(models.User.id == x_user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="用户不存在")
    return user


def require_admin(user: models.User = Depends(get_current_user)):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="需要管理员权限")
    return user


def require_not_auditor(user: models.User = Depends(get_current_user)):
    if user.role == "auditor":
        raise HTTPException(status_code=403, detail="审计员无修改权限")
    return user


def init_default_data(db: Session):
    admin = db.query(models.User).filter(models.User.username == "admin").first()
    if not admin:
        admin = models.User(username="admin", password="admin123", role="admin", full_name="系统管理员")
        db.add(admin)
    user1 = db.query(models.User).filter(models.User.username == "user1").first()
    if not user1:
        user1 = models.User(username="user1", password="user123", role="user", full_name="预约用户1")
        db.add(user1)
    auditor = db.query(models.User).filter(models.User.username == "auditor").first()
    if not auditor:
        auditor = models.User(username="auditor", password="audit123", role="auditor", full_name="审计员")
        db.add(auditor)

    venues = db.query(models.Venue).all()
    if not venues:
        db.add_all([
            models.Venue(name="一号讲解点", description="主展厅", location="A栋1楼"),
            models.Venue(name="二号讲解点", description="专题展厅", location="B栋2楼"),
            models.Venue(name="三号讲解点", description="互动体验区", location="C栋1楼"),
        ])

    slots = db.query(models.TimeSlotRule).all()
    if not slots:
        db.add_all([
            models.TimeSlotRule(name="上午场", start_time="09:00", end_time="11:30"),
            models.TimeSlotRule(name="下午场", start_time="14:00", end_time="16:30"),
            models.TimeSlotRule(name="晚间场", start_time="19:00", end_time="21:30"),
        ])

    staff_list = db.query(models.Staff).all()
    if not staff_list:
        db.add_all([
            models.Staff(name="张讲解员", title="资深讲解员", phone="13800000001"),
            models.Staff(name="李讲解员", title="高级讲解员", phone="13800000002"),
            models.Staff(name="王讲解员", title="讲解员", phone="13800000003"),
            models.Staff(name="赵讲解员", title="讲解员", phone="13800000004"),
        ])

    db.commit()


from database import SessionLocal
init_db = SessionLocal()
try:
    init_default_data(init_db)
finally:
    init_db.close()


def validate_booking_datetime(date_start, date_end, time_start, time_end):
    if date_end < date_start:
        raise HTTPException(status_code=400, detail="结束日期不能早于开始日期")
    if date_start == date_end:
        try:
            from datetime import datetime as dt
            ts = dt.strptime(time_start, "%H:%M")
            te = dt.strptime(time_end, "%H:%M")
            if te <= ts:
                raise HTTPException(status_code=400, detail="同一天的结束时间必须晚于开始时间")
        except ValueError:
            raise HTTPException(status_code=400, detail="时间格式无效，应为 HH:MM")


def check_venue_in_use(db: Session, venue_id: int):
    count = db.query(models.Booking).filter(models.Booking.venue_id == venue_id).count()
    return count


def check_staff_in_use(db: Session, staff_id: int):
    count = db.query(models.BookingStaff).filter(models.BookingStaff.staff_id == staff_id).count()
    return count


def times_overlap(s1, e1, s2, e2):
    try:
        from datetime import datetime as dt
        t1 = dt.strptime(s1, "%H:%M").time()
        t2 = dt.strptime(e1, "%H:%M").time()
        t3 = dt.strptime(s2, "%H:%M").time()
        t4 = dt.strptime(e2, "%H:%M").time()
        return t1 < t4 and t3 < t2
    except ValueError:
        return False


def dates_overlap(ds1, de1, ds2, de2):
    return ds1 <= de2 and ds2 <= de1


def check_booking_conflicts(db: Session, venue_id: int, date_start, date_end, time_start: str, time_end: str, staff_ids: list, exclude_booking_id: int = None):
    conflicts = []

    q = db.query(models.Booking).filter(
        models.Booking.status != "cancelled"
    )
    if exclude_booking_id:
        q = q.filter(models.Booking.id != exclude_booking_id)

    bookings = q.all()

    for b in bookings:
        if not dates_overlap(date_start, date_end, b.date_start, b.date_end):
            continue

        if date_start == b.date_start and date_end == b.date_end and date_start == date_end:
            if not times_overlap(time_start, time_end, b.time_start, b.time_end):
                continue
        elif date_start < b.date_end and date_end > b.date_start:
            pass

        if b.venue_id == venue_id:
            conflicts.append({
                "booking_id": b.id,
                "booking_title": b.title,
                "venue_name": b.venue.name if b.venue else "未知",
                "date_start": str(b.date_start),
                "date_end": str(b.date_end),
                "time_start": b.time_start,
                "time_end": b.time_end,
                "conflict_type": "venue",
                "staff_name": None
            })

        for sid in staff_ids:
            for bs in b.staff_assignments:
                if bs.staff_id == sid:
                    overlaps_time = True
                    if date_start == b.date_start and date_end == b.date_end and date_start == date_end:
                        overlaps_time = times_overlap(time_start, time_end, b.time_start, b.time_end)
                    if overlaps_time:
                        staff = db.query(models.Staff).filter(models.Staff.id == sid).first()
                        conflicts.append({
                            "booking_id": b.id,
                            "booking_title": b.title,
                            "venue_name": b.venue.name if b.venue else "未知",
                            "date_start": str(b.date_start),
                            "date_end": str(b.date_end),
                            "time_start": b.time_start,
                            "time_end": b.time_end,
                            "conflict_type": "staff",
                            "staff_name": staff.name if staff else "未知"
                        })

    seen = set()
    unique = []
    for c in conflicts:
        key = (c["booking_id"], c["conflict_type"], c.get("staff_name"))
        if key not in seen:
            seen.add(key)
            unique.append(c)

    return unique


def booking_to_dict(b: models.Booking, include_conflicts=False, db=None, include_feedback=False):
    latest_feedback = None
    if b.feedbacks and len(b.feedbacks) > 0:
        latest_feedback = max(b.feedbacks, key=lambda f: f.version)

    result = {
        "id": b.id,
        "title": b.title,
        "venue_id": b.venue_id,
        "venue_name": b.venue.name if b.venue else None,
        "date_start": str(b.date_start),
        "date_end": str(b.date_end),
        "time_start": b.time_start,
        "time_end": b.time_end,
        "visitor_count": b.visitor_count,
        "remark": b.remark,
        "status": b.status,
        "execution_status": b.execution_status,
        "created_by": b.created_by,
        "creator_name": b.creator.full_name if b.creator else None,
        "created_at": str(b.created_at),
        "updated_at": str(b.updated_at),
        "is_cross_day": b.date_end > b.date_start,
        "staff_list": [{"id": s.staff.id, "name": s.staff.name, "title": s.staff.title} for s in b.staff_assignments],
        "has_feedback": latest_feedback is not None,
    }
    if include_feedback and latest_feedback:
        result["feedback"] = {
            "id": latest_feedback.id,
            "actual_attendance": latest_feedback.actual_attendance,
            "actual_staff": latest_feedback.actual_staff,
            "execution_result": latest_feedback.execution_result,
            "feedback_note": latest_feedback.feedback_note,
            "change_reason": latest_feedback.change_reason,
            "created_by": latest_feedback.created_by,
            "creator_name": latest_feedback.creator.full_name if latest_feedback.creator else None,
            "created_at": str(latest_feedback.created_at),
            "updated_by": latest_feedback.updated_by,
            "updater_name": latest_feedback.updater.full_name if latest_feedback.updater else None,
            "updated_at": str(latest_feedback.updated_at) if latest_feedback.updated_at else None,
            "version": latest_feedback.version
        }
    if include_conflicts and db:
        staff_ids = [s.staff_id for s in b.staff_assignments]
        conflicts = check_booking_conflicts(
            db, b.venue_id, b.date_start, b.date_end,
            b.time_start, b.time_end, staff_ids,
            exclude_booking_id=b.id
        )
        result["has_conflict"] = len(conflicts) > 0
        result["conflicts"] = conflicts
    return result


@app.post("/api/auth/login")
def login(payload: schemas.UserLogin, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == payload.username, models.User.password == payload.password).first()
    if not user:
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    return {"success": True, "user": {"id": user.id, "username": user.username, "role": user.role, "full_name": user.full_name}}


@app.get("/api/users/me")
def get_me(user: models.User = Depends(get_current_user)):
    return {"id": user.id, "username": user.username, "role": user.role, "full_name": user.full_name}


@app.get("/api/venues")
def list_venues(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    venues = db.query(models.Venue).all()
    return [schemas.Venue.model_validate(v).model_dump() for v in venues]


@app.post("/api/venues")
def create_venue(venue: schemas.VenueCreate, db: Session = Depends(get_db), user: models.User = Depends(require_admin)):
    db_venue = models.Venue(**venue.model_dump())
    db.add(db_venue)
    db.commit()
    db.refresh(db_venue)
    return schemas.Venue.model_validate(db_venue).model_dump()


@app.put("/api/venues/{venue_id}")
def update_venue(venue_id: int, venue: schemas.VenueCreate, db: Session = Depends(get_db), user: models.User = Depends(require_admin)):
    db_venue = db.query(models.Venue).filter(models.Venue.id == venue_id).first()
    if not db_venue:
        raise HTTPException(status_code=404, detail="讲解点不存在")
    for key, val in venue.model_dump().items():
        setattr(db_venue, key, val)
    db.commit()
    db.refresh(db_venue)
    return schemas.Venue.model_validate(db_venue).model_dump()


@app.delete("/api/venues/{venue_id}")
def delete_venue(venue_id: int, db: Session = Depends(get_db), user: models.User = Depends(require_admin)):
    db_venue = db.query(models.Venue).filter(models.Venue.id == venue_id).first()
    if not db_venue:
        raise HTTPException(status_code=404, detail="讲解点不存在")
    in_use = check_venue_in_use(db, venue_id)
    if in_use > 0:
        raise HTTPException(status_code=400, detail=f"该讲解点已被 {in_use} 个预约使用，无法删除。请先删除或修改相关预约。")
    db.delete(db_venue)
    db.commit()
    return {"success": True}


@app.get("/api/time-slots")
def list_time_slots(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    slots = db.query(models.TimeSlotRule).all()
    return [schemas.TimeSlotRule.model_validate(s).model_dump() for s in slots]


@app.post("/api/time-slots")
def create_time_slot(slot: schemas.TimeSlotRuleCreate, db: Session = Depends(get_db), user: models.User = Depends(require_admin)):
    db_slot = models.TimeSlotRule(**slot.model_dump())
    db.add(db_slot)
    db.commit()
    db.refresh(db_slot)
    return schemas.TimeSlotRule.model_validate(db_slot).model_dump()


@app.put("/api/time-slots/{slot_id}")
def update_time_slot(slot_id: int, slot: schemas.TimeSlotRuleCreate, db: Session = Depends(get_db), user: models.User = Depends(require_admin)):
    db_slot = db.query(models.TimeSlotRule).filter(models.TimeSlotRule.id == slot_id).first()
    if not db_slot:
        raise HTTPException(status_code=404, detail="时段不存在")
    for key, val in slot.model_dump().items():
        setattr(db_slot, key, val)
    db.commit()
    db.refresh(db_slot)
    return schemas.TimeSlotRule.model_validate(db_slot).model_dump()


@app.delete("/api/time-slots/{slot_id}")
def delete_time_slot(slot_id: int, db: Session = Depends(get_db), user: models.User = Depends(require_admin)):
    db_slot = db.query(models.TimeSlotRule).filter(models.TimeSlotRule.id == slot_id).first()
    if not db_slot:
        raise HTTPException(status_code=404, detail="时段不存在")
    db.delete(db_slot)
    db.commit()
    return {"success": True}


@app.get("/api/staff")
def list_staff(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    staff_list = db.query(models.Staff).all()
    return [schemas.Staff.model_validate(s).model_dump() for s in staff_list]


@app.post("/api/staff")
def create_staff(staff: schemas.StaffCreate, db: Session = Depends(get_db), user: models.User = Depends(require_admin)):
    db_staff = models.Staff(**staff.model_dump())
    db.add(db_staff)
    db.commit()
    db.refresh(db_staff)
    return schemas.Staff.model_validate(db_staff).model_dump()


@app.put("/api/staff/{staff_id}")
def update_staff(staff_id: int, staff: schemas.StaffCreate, db: Session = Depends(get_db), user: models.User = Depends(require_admin)):
    db_staff = db.query(models.Staff).filter(models.Staff.id == staff_id).first()
    if not db_staff:
        raise HTTPException(status_code=404, detail="人员不存在")
    for key, val in staff.model_dump().items():
        setattr(db_staff, key, val)
    db.commit()
    db.refresh(db_staff)
    return schemas.Staff.model_validate(db_staff).model_dump()


@app.delete("/api/staff/{staff_id}")
def delete_staff(staff_id: int, db: Session = Depends(get_db), user: models.User = Depends(require_admin)):
    db_staff = db.query(models.Staff).filter(models.Staff.id == staff_id).first()
    if not db_staff:
        raise HTTPException(status_code=404, detail="人员不存在")
    in_use = check_staff_in_use(db, staff_id)
    if in_use > 0:
        raise HTTPException(status_code=400, detail=f"该人员已被 {in_use} 个预约安排，无法删除。请先从相关预约中移除该人员。")
    db.delete(db_staff)
    db.commit()
    return {"success": True}


@app.get("/api/bookings")
def list_bookings(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    execution_status: Optional[str] = None,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user)
):
    q = db.query(models.Booking)
    if start_date:
        q = q.filter(models.Booking.date_end >= start_date)
    if end_date:
        q = q.filter(models.Booking.date_start <= end_date)
    if execution_status:
        status_list = [s.strip() for s in execution_status.split(',') if s.strip()]
        if status_list:
            q = q.filter(models.Booking.execution_status.in_(status_list))
    bookings = q.order_by(models.Booking.date_start, models.Booking.time_start).all()
    return [booking_to_dict(b, include_feedback=True) for b in bookings]


@app.get("/api/bookings/by-date/{target_date}")
def get_bookings_by_date(target_date: date, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    bookings = db.query(models.Booking).filter(
        models.Booking.date_start <= target_date,
        models.Booking.date_end >= target_date
    ).order_by(models.Booking.time_start).all()

    result = []
    for b in bookings:
        b_dict = booking_to_dict(b, include_conflicts=True, db=db, include_feedback=True)
        is_start_day = b.date_start == target_date
        is_end_day = b.date_end == target_date
        is_cross = b.date_end > b.date_start
        if is_cross and is_start_day:
            b_dict["display_tag"] = "跨日（起始日）"
        elif is_cross and is_end_day:
            b_dict["display_tag"] = "跨日（结束日）"
        elif is_cross:
            b_dict["display_tag"] = "跨日"
        else:
            b_dict["display_tag"] = None
        b_dict["is_start_day"] = is_start_day
        b_dict["count_towards_today"] = is_start_day
        result.append(b_dict)
    return result


@app.get("/api/bookings/stats/month/{year}/{month}")
def get_monthly_stats(year: int, month: int, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    if month < 1 or month > 12:
        raise HTTPException(status_code=400, detail="月份无效")
    start_of_month = date(year, month, 1)
    if month == 12:
        start_of_next = date(year + 1, 1, 1)
    else:
        start_of_next = date(year, month + 1, 1)
    end_of_month = start_of_next - timedelta(days=1)

    bookings = db.query(models.Booking).filter(
        models.Booking.date_start <= end_of_month,
        models.Booking.date_end >= start_of_month
    ).all()

    stats = {}
    for d in range((end_of_month - start_of_month).days + 1):
        cur = start_of_month + timedelta(days=d)
        stats[str(cur)] = {
            "date": str(cur),
            "booking_count": 0,
            "total_visitors": 0,
            "cross_day_count": 0,
            "conflict_count": 0,
            "pending_count": 0,
            "ongoing_count": 0,
            "completed_count": 0,
            "need_feedback_count": 0
        }

    conflict_pairs = set()
    active_bookings = [b for b in bookings if b.status != "cancelled"]
    for i in range(len(active_bookings)):
        for j in range(i + 1, len(active_bookings)):
            bi = active_bookings[i]
            bj = active_bookings[j]
            if not dates_overlap(bi.date_start, bi.date_end, bj.date_start, bj.date_end):
                continue
            has_conflict = False
            if bi.venue_id == bj.venue_id:
                same_day = (bi.date_start == bi.date_end == bj.date_start == bj.date_end)
                if same_day:
                    has_conflict = times_overlap(bi.time_start, bi.time_end, bj.time_start, bj.time_end)
                else:
                    has_conflict = True
            if not has_conflict:
                si_ids = {s.staff_id for s in bi.staff_assignments}
                sj_ids = {s.staff_id for s in bj.staff_assignments}
                shared = si_ids & sj_ids
                if shared:
                    same_day = (bi.date_start == bi.date_end == bj.date_start == bj.date_end)
                    if same_day:
                        has_conflict = times_overlap(bi.time_start, bi.time_end, bj.time_start, bj.time_end)
                    else:
                        has_conflict = True
            if has_conflict:
                conflict_pairs.add((bi.id, bj.id))

    booking_conflict_ids = set()
    for (id1, id2) in conflict_pairs:
        booking_conflict_ids.add(id1)
        booking_conflict_ids.add(id2)

    today = date.today()
    now = datetime.now().time()

    for b in bookings:
        d = b.date_start
        while d <= b.date_end:
            if start_of_month <= d <= end_of_month:
                key = str(d)
                is_start_day = b.date_start == d
                stats[key]["booking_count"] += 1
                if is_start_day:
                    stats[key]["total_visitors"] += (b.visitor_count or 0)
                if b.date_end > b.date_start:
                    stats[key]["cross_day_count"] += 1
                if b.id in booking_conflict_ids:
                    stats[key]["conflict_count"] += 1
                exec_status = b.execution_status or "pending"
                if exec_status == "pending":
                    stats[key]["pending_count"] += 1
                    if b.date_end < today or (b.date_end == today and b.time_end < str(now)[:5]):
                        has_fb = any(f.version > 0 for f in b.feedbacks) if b.feedbacks else False
                        if not has_fb:
                            stats[key]["need_feedback_count"] += 1
                elif exec_status == "ongoing":
                    stats[key]["ongoing_count"] += 1
                elif exec_status in ["completed", "no_show", "cancelled_temp", "abnormal"]:
                    stats[key]["completed_count"] += 1
            d += timedelta(days=1)

    return list(stats.values())


@app.post("/api/bookings/check-conflict")
def check_conflict(payload: schemas.ConflictCheckRequest, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    conflicts = check_booking_conflicts(
        db, payload.venue_id, payload.date_start, payload.date_end,
        payload.time_start, payload.time_end, payload.staff_ids,
        payload.exclude_booking_id
    )
    return {"has_conflict": len(conflicts) > 0, "conflicts": conflicts}


@app.post("/api/bookings")
def create_booking(payload: schemas.BookingCreate, db: Session = Depends(get_db), user: models.User = Depends(require_not_auditor)):
    validate_booking_datetime(payload.date_start, payload.date_end, payload.time_start, payload.time_end)

    booking_data = payload.model_dump()
    staff_ids = booking_data.pop("staff_ids", [])
    change_reason = booking_data.pop("change_reason", None)
    force_save = booking_data.pop("force_save", False)

    conflicts = check_booking_conflicts(
        db, payload.venue_id, payload.date_start, payload.date_end,
        payload.time_start, payload.time_end, staff_ids
    )
    if conflicts and not force_save:
        raise HTTPException(status_code=409, detail={
            "message": "存在资源冲突，请调整后再保存，或注明原因后强制保存",
            "conflicts": conflicts
        })
    if conflicts and force_save:
        if user.role != "admin":
            raise HTTPException(status_code=403, detail="仅管理员可强制保存存在冲突的预约")
        if not change_reason or not change_reason.strip():
            raise HTTPException(status_code=400, detail="强制保存冲突预约必须填写调整/覆盖原因")

    db_booking = models.Booking(**booking_data, created_by=user.id)
    db.add(db_booking)
    db.flush()

    for sid in staff_ids:
        bs = models.BookingStaff(booking_id=db_booking.id, staff_id=sid)
        db.add(bs)

    after_data = json.dumps(booking_to_dict(db_booking), ensure_ascii=False)
    log_reason = change_reason or "创建预约"
    if conflicts and force_save:
        log_reason = f"[强制保存-冲突] {change_reason}"
    log = models.ChangeLog(
        booking_id=db_booking.id,
        operator_id=user.id,
        change_type="create",
        after_data=after_data,
        change_reason=log_reason
    )
    db.add(log)

    db.commit()
    db.refresh(db_booking)
    return booking_to_dict(db_booking)


@app.put("/api/bookings/{booking_id}")
def update_booking(booking_id: int, payload: schemas.BookingUpdate, db: Session = Depends(get_db), user: models.User = Depends(require_not_auditor)):
    db_booking = db.query(models.Booking).filter(models.Booking.id == booking_id).first()
    if not db_booking:
        raise HTTPException(status_code=404, detail="预约不存在")

    before_data = json.dumps(booking_to_dict(db_booking), ensure_ascii=False)
    update_data = payload.model_dump(exclude_unset=True)
    staff_ids = update_data.pop("staff_ids", None)
    change_reason = update_data.pop("change_reason", None)
    force_save = update_data.pop("force_save", False)

    for key, val in update_data.items():
        if hasattr(db_booking, key) and val is not None:
            setattr(db_booking, key, val)

    validate_booking_datetime(db_booking.date_start, db_booking.date_end, db_booking.time_start, db_booking.time_end)

    if staff_ids is not None:
        db.query(models.BookingStaff).filter(models.BookingStaff.booking_id == booking_id).delete()
        for sid in staff_ids:
            db.add(models.BookingStaff(booking_id=booking_id, staff_id=sid))

    final_staff_ids = staff_ids if staff_ids is not None else [s.staff_id for s in db_booking.staff_assignments]
    conflicts = check_booking_conflicts(
        db, db_booking.venue_id, db_booking.date_start, db_booking.date_end,
        db_booking.time_start, db_booking.time_end, final_staff_ids,
        exclude_booking_id=booking_id
    )
    if conflicts and not force_save:
        db.rollback()
        raise HTTPException(status_code=409, detail={
            "message": "存在资源冲突，请调整后再保存，或注明原因后强制保存",
            "conflicts": conflicts
        })
    if conflicts and force_save:
        if user.role != "admin":
            db.rollback()
            raise HTTPException(status_code=403, detail="仅管理员可强制保存存在冲突的预约")
        if not change_reason or not change_reason.strip():
            db.rollback()
            raise HTTPException(status_code=400, detail="强制保存冲突预约必须填写调整/覆盖原因")

    db.flush()
    after_data = json.dumps(booking_to_dict(db_booking), ensure_ascii=False)
    change_type = "adjust" if payload.status == "adjusted" or change_reason else "update"
    log_reason = change_reason or "更新预约"
    if conflicts and force_save:
        log_reason = f"[强制保存-冲突] {change_reason}"
        change_type = "adjust"
    log = models.ChangeLog(
        booking_id=booking_id,
        operator_id=user.id,
        change_type=change_type,
        before_data=before_data,
        after_data=after_data,
        change_reason=log_reason
    )
    db.add(log)

    db.commit()
    db.refresh(db_booking)
    return booking_to_dict(db_booking)


@app.delete("/api/bookings/{booking_id}")
def delete_booking(booking_id: int, db: Session = Depends(get_db), user: models.User = Depends(require_not_auditor)):
    db_booking = db.query(models.Booking).filter(models.Booking.id == booking_id).first()
    if not db_booking:
        raise HTTPException(status_code=404, detail="预约不存在")

    before_data = json.dumps(booking_to_dict(db_booking), ensure_ascii=False)
    log = models.ChangeLog(
        booking_id=booking_id,
        operator_id=user.id,
        change_type="delete",
        before_data=before_data,
        change_reason="删除预约"
    )
    db.add(log)
    db.delete(db_booking)
    db.commit()
    return {"success": True}


@app.get("/api/bookings/{booking_id}/change-logs")
def get_booking_change_logs(booking_id: int, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    logs = db.query(models.ChangeLog).filter(models.ChangeLog.booking_id == booking_id).order_by(models.ChangeLog.created_at.desc()).all()
    result = []
    for log in logs:
        result.append({
            "id": log.id,
            "booking_id": log.booking_id,
            "operator_id": log.operator_id,
            "operator_name": log.operator.full_name if log.operator else None,
            "change_type": log.change_type,
            "before_data": log.before_data,
            "after_data": log.after_data,
            "change_reason": log.change_reason,
            "created_at": str(log.created_at)
        })
    return result


@app.get("/api/change-logs")
def list_all_change_logs(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user)
):
    q = db.query(models.ChangeLog)
    if start_date:
        q = q.filter(models.ChangeLog.created_at >= datetime.combine(start_date, datetime.min.time()))
    if end_date:
        q = q.filter(models.ChangeLog.created_at <= datetime.combine(end_date, datetime.max.time()))
    logs = q.order_by(models.ChangeLog.created_at.desc()).all()
    result = []
    for log in logs:
        result.append({
            "id": log.id,
            "booking_id": log.booking_id,
            "operator_id": log.operator_id,
            "operator_name": log.operator.full_name if log.operator else None,
            "change_type": log.change_type,
            "before_data": log.before_data,
            "after_data": log.after_data,
            "change_reason": log.change_reason,
            "created_at": str(log.created_at)
        })
    return result


@app.post("/api/snapshots")
def create_snapshot(db: Session = Depends(get_db), user: models.User = Depends(require_admin)):
    today = date.today()
    bookings = db.query(models.Booking).filter(
        models.Booking.date_start <= today,
        models.Booking.date_end >= today
    ).all()
    snapshot_data = json.dumps([booking_to_dict(b, include_feedback=True) for b in bookings], ensure_ascii=False)
    snapshot = models.ScheduleSnapshot(snapshot_date=today, snapshot_data=snapshot_data)
    db.add(snapshot)
    db.commit()
    db.refresh(snapshot)
    return {"id": snapshot.id, "snapshot_date": str(snapshot.snapshot_date), "created_at": str(snapshot.created_at)}


@app.get("/api/snapshots")
def list_snapshots(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    snapshots = db.query(models.ScheduleSnapshot).order_by(models.ScheduleSnapshot.snapshot_date.desc()).all()
    return [{"id": s.id, "snapshot_date": str(s.snapshot_date), "created_at": str(s.created_at)} for s in snapshots]


@app.get("/api/snapshots/{snapshot_id}")
def get_snapshot(snapshot_id: int, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    snapshot = db.query(models.ScheduleSnapshot).filter(models.ScheduleSnapshot.id == snapshot_id).first()
    if not snapshot:
        raise HTTPException(status_code=404, detail="快照不存在")
    return {
        "id": snapshot.id,
        "snapshot_date": str(snapshot.snapshot_date),
        "snapshot_data": json.loads(snapshot.snapshot_data),
        "created_at": str(snapshot.created_at)
    }


@app.get("/api/reminders/upcoming")
def get_upcoming_reminders(
    days: int = 3,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user)
):
    today = date.today()
    end_date = today + timedelta(days=days)
    bookings = db.query(models.Booking).filter(
        models.Booking.date_start <= end_date,
        models.Booking.date_end >= today,
        models.Booking.status != "cancelled"
    ).order_by(models.Booking.date_start, models.Booking.time_start).all()

    now = datetime.now().time()
    reminders = []
    for b in bookings:
        b_dict = booking_to_dict(b, include_feedback=True)
        reminder_type = None

        exec_status = b.execution_status or "pending"
        has_fb = b_dict.get("has_feedback", False)

        if b.date_start == today:
            try:
                from datetime import datetime as dt
                start_dt = dt.strptime(b.time_start, "%H:%M").time()
                end_dt = dt.strptime(b.time_end, "%H:%M").time()
                time_diff_start = (dt.combine(today, start_dt) - dt.combine(today, now)).total_seconds() / 3600
                time_diff_end = (dt.combine(today, end_dt) - dt.combine(today, now)).total_seconds() / 3600

                if 0 <= time_diff_end and time_diff_start <= 0 and exec_status != "ongoing":
                    if exec_status in ["pending"]:
                        b.execution_status = "ongoing"
                        db.flush()
                        b_dict["execution_status"] = "ongoing"
                        reminder_type = "ongoing"
                    elif exec_status == "ongoing":
                        reminder_type = "ongoing"
                elif time_diff_start > 0 and time_diff_start <= 2:
                    reminder_type = "urgent"
                elif time_diff_start > 0:
                    reminder_type = "today"
            except ValueError:
                reminder_type = "today"
        elif (b.date_start - today).days <= days:
            reminder_type = "upcoming"

        if b.date_end <= today and not has_fb and exec_status in ["pending", "ongoing"]:
            if b.date_end < today or (b.date_end == today and b.time_end < str(now)[:5]):
                reminder_type = "need_feedback"

        if reminder_type:
            b_dict["reminder_type"] = reminder_type
            reminders.append(b_dict)

    db.commit()
    return reminders


VALID_RESULTS = {"completed", "no_show", "cancelled_temp", "abnormal"}


def can_submit_feedback(booking: models.Booking, user: models.User) -> bool:
    if user.role == "admin":
        return True
    if user.id == booking.created_by:
        return True
    return False


def is_booking_ended(booking: models.Booking) -> bool:
    now = datetime.now()
    end_datetime_str = f"{booking.date_end} {booking.time_end}"
    try:
        end_datetime = datetime.strptime(end_datetime_str, "%Y-%m-%d %H:%M")
        return now >= end_datetime
    except (ValueError, TypeError):
        today = date.today()
        return booking.date_end <= today


@app.post("/api/bookings/{booking_id}/feedbacks")
def create_feedback(
    booking_id: int,
    payload: schemas.BookingFeedbackCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_not_auditor)
):
    booking = db.query(models.Booking).filter(models.Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="预约不存在")

    if not can_submit_feedback(booking, user):
        raise HTTPException(status_code=403, detail="仅管理员或预约创建人可提交反馈")

    if booking.status == "cancelled":
        raise HTTPException(status_code=400, detail="已取消的预约无法提交反馈")

    if not is_booking_ended(booking):
        raise HTTPException(status_code=400, detail="预约尚未结束，暂不可提交反馈")

    if payload.execution_result not in VALID_RESULTS:
        raise HTTPException(status_code=400, detail=f"执行结果无效，可选值：{', '.join(VALID_RESULTS)}")

    existing_count = db.query(models.BookingFeedback).filter(
        models.BookingFeedback.booking_id == booking_id
    ).count()
    if existing_count > 0:
        raise HTTPException(status_code=409, detail="该预约已有反馈，请使用修改接口")

    feedback_data = payload.model_dump()
    feedback_data.pop("change_reason", None)

    db_feedback = models.BookingFeedback(
        **feedback_data,
        booking_id=booking_id,
        created_by=user.id,
        change_reason=payload.change_reason or "首次提交反馈"
    )
    db.add(db_feedback)

    before_data = json.dumps(booking_to_dict(booking, include_feedback=True), ensure_ascii=False)
    booking.execution_status = payload.execution_result
    db.flush()

    after_data = json.dumps(booking_to_dict(booking, include_feedback=True), ensure_ascii=False)
    log = models.ChangeLog(
        booking_id=booking_id,
        operator_id=user.id,
        change_type="feedback_create",
        before_data=before_data,
        after_data=after_data,
        change_reason=payload.change_reason or "提交执行反馈"
    )
    db.add(log)

    db.commit()
    db.refresh(db_feedback)

    return {
        "id": db_feedback.id,
        "booking_id": db_feedback.booking_id,
        "actual_attendance": db_feedback.actual_attendance,
        "actual_staff": db_feedback.actual_staff,
        "execution_result": db_feedback.execution_result,
        "feedback_note": db_feedback.feedback_note,
        "change_reason": db_feedback.change_reason,
        "created_by": db_feedback.created_by,
        "creator_name": db_feedback.creator.full_name if db_feedback.creator else None,
        "created_at": str(db_feedback.created_at),
        "version": db_feedback.version
    }


@app.put("/api/bookings/{booking_id}/feedbacks")
def update_feedback(
    booking_id: int,
    payload: schemas.BookingFeedbackUpdate,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_not_auditor)
):
    booking = db.query(models.Booking).filter(models.Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="预约不存在")

    if not can_submit_feedback(booking, user):
        raise HTTPException(status_code=403, detail="仅管理员或预约创建人可修改反馈")

    feedbacks = db.query(models.BookingFeedback).filter(
        models.BookingFeedback.booking_id == booking_id
    ).order_by(models.BookingFeedback.version.desc()).all()

    if not feedbacks:
        raise HTTPException(status_code=404, detail="该预约尚无反馈，请先创建反馈")

    latest = feedbacks[0]
    before_data = json.dumps(booking_to_dict(booking, include_feedback=True), ensure_ascii=False)

    update_data = payload.model_dump(exclude_unset=True)
    update_data.pop("change_reason", None)

    if "execution_result" in update_data and update_data["execution_result"] not in VALID_RESULTS:
        raise HTTPException(status_code=400, detail=f"执行结果无效，可选值：{', '.join(VALID_RESULTS)}")

    before_snapshot = json.dumps({
        "actual_attendance": latest.actual_attendance,
        "actual_staff": latest.actual_staff,
        "execution_result": latest.execution_result,
        "feedback_note": latest.feedback_note,
        "version": latest.version
    }, ensure_ascii=False)

    new_feedback = models.BookingFeedback(
        booking_id=booking_id,
        actual_attendance=latest.actual_attendance,
        actual_staff=latest.actual_staff,
        execution_result=latest.execution_result,
        feedback_note=latest.feedback_note,
        created_by=latest.created_by,
        created_at=latest.created_at,
        updated_by=user.id,
        change_reason=payload.change_reason or f"修改反馈（v{latest.version + 1}）",
        version=latest.version + 1,
        before_snapshot=before_snapshot
    )

    for key, val in update_data.items():
        if hasattr(new_feedback, key) and val is not None:
            setattr(new_feedback, key, val)

    if "execution_result" in update_data:
        booking.execution_status = update_data["execution_result"]

    db.add(new_feedback)
    db.flush()
    after_data = json.dumps(booking_to_dict(booking, include_feedback=True), ensure_ascii=False)

    log = models.ChangeLog(
        booking_id=booking_id,
        operator_id=user.id,
        change_type="feedback_update",
        before_data=before_data,
        after_data=after_data,
        change_reason=payload.change_reason or "修改执行反馈"
    )
    db.add(log)

    db.commit()
    db.refresh(new_feedback)

    return {
        "id": new_feedback.id,
        "booking_id": new_feedback.booking_id,
        "actual_attendance": new_feedback.actual_attendance,
        "actual_staff": new_feedback.actual_staff,
        "execution_result": new_feedback.execution_result,
        "feedback_note": new_feedback.feedback_note,
        "change_reason": new_feedback.change_reason,
        "created_by": new_feedback.created_by,
        "creator_name": new_feedback.creator.full_name if new_feedback.creator else None,
        "created_at": str(new_feedback.created_at),
        "updated_by": new_feedback.updated_by,
        "updater_name": new_feedback.updater.full_name if new_feedback.updater else None,
        "updated_at": str(new_feedback.updated_at),
        "version": new_feedback.version,
        "before_snapshot": new_feedback.before_snapshot
    }


@app.get("/api/bookings/{booking_id}/feedbacks")
def get_booking_feedbacks(
    booking_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user)
):
    booking = db.query(models.Booking).filter(models.Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="预约不存在")

    feedbacks = db.query(models.BookingFeedback).filter(
        models.BookingFeedback.booking_id == booking_id
    ).order_by(models.BookingFeedback.version.desc()).all()

    result = []
    for fb in feedbacks:
        result.append({
            "id": fb.id,
            "booking_id": fb.booking_id,
            "actual_attendance": fb.actual_attendance,
            "actual_staff": fb.actual_staff,
            "execution_result": fb.execution_result,
            "feedback_note": fb.feedback_note,
            "change_reason": fb.change_reason,
            "created_by": fb.created_by,
            "creator_name": fb.creator.full_name if fb.creator else None,
            "created_at": str(fb.created_at),
            "updated_by": fb.updated_by,
            "updater_name": fb.updater.full_name if fb.updater else None,
            "updated_at": str(fb.updated_at) if fb.updated_at else None,
            "version": fb.version,
            "before_snapshot": fb.before_snapshot
        })
    return result


@app.get("/api/feedbacks")
def list_all_feedbacks(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    execution_result: Optional[str] = None,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user)
):
    q = db.query(models.BookingFeedback).join(models.Booking)
    if start_date:
        q = q.filter(models.Booking.date_end >= start_date)
    if end_date:
        q = q.filter(models.Booking.date_start <= end_date)
    if execution_result:
        result_list = [s.strip() for s in execution_result.split(',') if s.strip()]
        if result_list:
            q = q.filter(models.BookingFeedback.execution_result.in_(result_list))

    feedbacks = q.order_by(models.BookingFeedback.created_at.desc()).all()
    result = []
    for fb in feedbacks:
        result.append({
            "id": fb.id,
            "booking_id": fb.booking_id,
            "booking_title": fb.booking.title if fb.booking else None,
            "venue_name": fb.booking.venue.name if fb.booking and fb.booking.venue else None,
            "booking_date_start": str(fb.booking.date_start) if fb.booking else None,
            "booking_date_end": str(fb.booking.date_end) if fb.booking else None,
            "booking_time_start": fb.booking.time_start if fb.booking else None,
            "booking_time_end": fb.booking.time_end if fb.booking else None,
            "creator_name": fb.booking.creator.full_name if fb.booking and fb.booking.creator else None,
            "actual_attendance": fb.actual_attendance,
            "actual_staff": fb.actual_staff,
            "execution_result": fb.execution_result,
            "feedback_note": fb.feedback_note,
            "change_reason": fb.change_reason,
            "created_by": fb.created_by,
            "feedback_creator_name": fb.creator.full_name if fb.creator else None,
            "created_at": str(fb.created_at),
            "updated_by": fb.updated_by,
            "updater_name": fb.updater.full_name if fb.updater else None,
            "updated_at": str(fb.updated_at) if fb.updated_at else None,
            "version": fb.version
        })
    return result


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8118)
