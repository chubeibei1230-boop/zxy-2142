from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Date
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    password = Column(String(100), nullable=False)
    role = Column(String(20), nullable=False, default="user")  # admin, user, auditor
    full_name = Column(String(100))

    bookings = relationship("Booking", back_populates="creator", foreign_keys="Booking.created_by")
    changes = relationship("ChangeLog", back_populates="operator")


class Venue(Base):
    __tablename__ = "venues"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    location = Column(String(200))
    is_active = Column(Integer, default=1)

    bookings = relationship("Booking", back_populates="venue")


class TimeSlotRule(Base):
    __tablename__ = "time_slot_rules"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), nullable=False)
    start_time = Column(String(10), nullable=False)
    end_time = Column(String(10), nullable=False)
    is_active = Column(Integer, default=1)


class Staff(Base):
    __tablename__ = "staff"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    title = Column(String(100))
    phone = Column(String(20))
    is_active = Column(Integer, default=1)

    bookings = relationship("BookingStaff", back_populates="staff")


class Booking(Base):
    __tablename__ = "bookings"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    venue_id = Column(Integer, ForeignKey("venues.id"), nullable=False)
    date_start = Column(Date, nullable=False)
    date_end = Column(Date, nullable=False)
    time_start = Column(String(10), nullable=False)
    time_end = Column(String(10), nullable=False)
    visitor_count = Column(Integer, default=0)
    remark = Column(Text)
    status = Column(String(20), default="confirmed")  # confirmed, adjusted, cancelled
    execution_status = Column(String(20), default="pending")  # pending, ongoing, completed, no_show, cancelled_temp, abnormal
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    venue = relationship("Venue", back_populates="bookings")
    creator = relationship("User", back_populates="bookings", foreign_keys=[created_by])
    staff_assignments = relationship("BookingStaff", back_populates="booking", cascade="all, delete-orphan")
    change_logs = relationship("ChangeLog", back_populates="booking", cascade="all, delete-orphan")
    feedbacks = relationship("BookingFeedback", back_populates="booking", cascade="all, delete-orphan")


class BookingStaff(Base):
    __tablename__ = "booking_staff"

    id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=False)
    staff_id = Column(Integer, ForeignKey("staff.id"), nullable=False)

    booking = relationship("Booking", back_populates="staff_assignments")
    staff = relationship("Staff", back_populates="bookings")


class ChangeLog(Base):
    __tablename__ = "change_logs"

    id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=False)
    operator_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    change_type = Column(String(50), nullable=False)  # create, update, adjust, cancel, delete
    before_data = Column(Text)
    after_data = Column(Text)
    change_reason = Column(Text)
    created_at = Column(DateTime, server_default=func.now())

    booking = relationship("Booking", back_populates="change_logs")
    operator = relationship("User", back_populates="changes")


class ScheduleSnapshot(Base):
    __tablename__ = "schedule_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    snapshot_date = Column(Date, nullable=False)
    snapshot_data = Column(Text, nullable=False)
    created_at = Column(DateTime, server_default=func.now())


class BookingFeedback(Base):
    __tablename__ = "booking_feedbacks"

    id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=False)
    actual_attendance = Column(Integer, default=0)
    actual_staff = Column(String(500))
    execution_result = Column(String(20), nullable=False)  # completed, no_show, cancelled_temp, abnormal
    feedback_note = Column(Text)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_by = Column(Integer, ForeignKey("users.id"))
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    change_reason = Column(Text)
    version = Column(Integer, default=1)

    booking = relationship("Booking", back_populates="feedbacks")
    creator = relationship("User", foreign_keys=[created_by])
    updater = relationship("User", foreign_keys=[updated_by])
