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


def booking_to_dict(b: models.Booking):
    return {
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
        "created_by": b.created_by,
        "creator_name": b.creator.full_name if b.creator else None,
        "created_at": str(b.created_at),
        "updated_at": str(b.updated_at),
        "is_cross_day": b.date_end > b.date_start,
        "staff_list": [{"id": s.staff.id, "name": s.staff.name, "title": s.staff.title} for s in b.staff_assignments]
    }


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
    db.delete(db_staff)
    db.commit()
    return {"success": True}


@app.get("/api/bookings")
def list_bookings(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user)
):
    q = db.query(models.Booking)
    if start_date:
        q = q.filter(models.Booking.date_end >= start_date)
    if end_date:
        q = q.filter(models.Booking.date_start <= end_date)
    bookings = q.order_by(models.Booking.date_start, models.Booking.time_start).all()
    return [booking_to_dict(b) for b in bookings]


@app.get("/api/bookings/by-date/{target_date}")
def get_bookings_by_date(target_date: date, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    bookings = db.query(models.Booking).filter(
        models.Booking.date_start <= target_date,
        models.Booking.date_end >= target_date
    ).order_by(models.Booking.time_start).all()

    result = []
    for b in bookings:
        b_dict = booking_to_dict(b)
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
        stats[str(cur)] = {"date": str(cur), "booking_count": 0, "total_visitors": 0, "cross_day_count": 0}

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
            d += timedelta(days=1)

    return list(stats.values())


@app.post("/api/bookings")
def create_booking(payload: schemas.BookingCreate, db: Session = Depends(get_db), user: models.User = Depends(require_not_auditor)):
    booking_data = payload.model_dump()
    staff_ids = booking_data.pop("staff_ids", [])
    change_reason = booking_data.pop("change_reason", None)

    db_booking = models.Booking(**booking_data, created_by=user.id)
    db.add(db_booking)
    db.flush()

    for sid in staff_ids:
        bs = models.BookingStaff(booking_id=db_booking.id, staff_id=sid)
        db.add(bs)

    after_data = json.dumps(booking_to_dict(db_booking), ensure_ascii=False)
    log = models.ChangeLog(
        booking_id=db_booking.id,
        operator_id=user.id,
        change_type="create",
        after_data=after_data,
        change_reason=change_reason or "创建预约"
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

    for key, val in update_data.items():
        if hasattr(db_booking, key) and val is not None:
            setattr(db_booking, key, val)

    if staff_ids is not None:
        db.query(models.BookingStaff).filter(models.BookingStaff.booking_id == booking_id).delete()
        for sid in staff_ids:
            db.add(models.BookingStaff(booking_id=booking_id, staff_id=sid))

    db.flush()
    after_data = json.dumps(booking_to_dict(db_booking), ensure_ascii=False)
    change_type = "adjust" if payload.status == "adjusted" or change_reason else "update"
    log = models.ChangeLog(
        booking_id=booking_id,
        operator_id=user.id,
        change_type=change_type,
        before_data=before_data,
        after_data=after_data,
        change_reason=change_reason or "更新预约"
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
    snapshot_data = json.dumps([booking_to_dict(b) for b in bookings], ensure_ascii=False)
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8118)
