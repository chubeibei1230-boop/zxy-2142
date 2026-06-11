from pydantic import BaseModel
from typing import List, Optional
from datetime import date, datetime


class UserBase(BaseModel):
    username: str
    full_name: Optional[str] = None
    role: str = "user"


class UserCreate(UserBase):
    password: str


class UserLogin(BaseModel):
    username: str
    password: str


class User(UserBase):
    id: int

    class Config:
        from_attributes = True


class VenueBase(BaseModel):
    name: str
    description: Optional[str] = None
    location: Optional[str] = None
    is_active: int = 1


class VenueCreate(VenueBase):
    pass


class Venue(VenueBase):
    id: int

    class Config:
        from_attributes = True


class TimeSlotRuleBase(BaseModel):
    name: str
    start_time: str
    end_time: str
    is_active: int = 1


class TimeSlotRuleCreate(TimeSlotRuleBase):
    pass


class TimeSlotRule(TimeSlotRuleBase):
    id: int

    class Config:
        from_attributes = True


class StaffBase(BaseModel):
    name: str
    title: Optional[str] = None
    phone: Optional[str] = None
    is_active: int = 1


class StaffCreate(StaffBase):
    pass


class Staff(StaffBase):
    id: int

    class Config:
        from_attributes = True


class BookingStaffBase(BaseModel):
    staff_id: int


class BookingStaffCreate(BookingStaffBase):
    pass


class BookingStaff(BookingStaffBase):
    id: int
    staff: Optional[Staff] = None

    class Config:
        from_attributes = True


class BookingBase(BaseModel):
    title: str
    venue_id: int
    date_start: date
    date_end: date
    time_start: str
    time_end: str
    visitor_count: int = 0
    remark: Optional[str] = None
    status: str = "confirmed"


class BookingCreate(BookingBase):
    staff_ids: List[int] = []
    change_reason: Optional[str] = None
    force_save: bool = False


class BookingUpdate(BaseModel):
    title: Optional[str] = None
    venue_id: Optional[int] = None
    date_start: Optional[date] = None
    date_end: Optional[date] = None
    time_start: Optional[str] = None
    time_end: Optional[str] = None
    visitor_count: Optional[int] = None
    remark: Optional[str] = None
    status: Optional[str] = None
    staff_ids: Optional[List[int]] = None
    change_reason: Optional[str] = None
    force_save: bool = False


class Booking(BookingBase):
    id: int
    created_by: int
    created_at: datetime
    updated_at: datetime
    venue: Optional[Venue] = None
    creator: Optional[User] = None
    staff_assignments: List[BookingStaff] = []

    class Config:
        from_attributes = True


class ChangeLogBase(BaseModel):
    booking_id: int
    operator_id: int
    change_type: str
    before_data: Optional[str] = None
    after_data: Optional[str] = None
    change_reason: Optional[str] = None


class ChangeLog(ChangeLogBase):
    id: int
    created_at: datetime
    operator: Optional[User] = None

    class Config:
        from_attributes = True


class ScheduleSnapshotBase(BaseModel):
    snapshot_date: date
    snapshot_data: str


class ScheduleSnapshot(ScheduleSnapshotBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class ConflictCheckRequest(BaseModel):
    venue_id: int
    date_start: date
    date_end: date
    time_start: str
    time_end: str
    staff_ids: List[int] = []
    exclude_booking_id: Optional[int] = None


class ConflictInfo(BaseModel):
    booking_id: int
    booking_title: str
    venue_name: str
    date_start: str
    date_end: str
    time_start: str
    time_end: str
    conflict_type: str
    staff_name: Optional[str] = None


class ConflictCheckResponse(BaseModel):
    has_conflict: bool
    conflicts: List[ConflictInfo] = []


class DayBookingStats(BaseModel):
    date: date
    booking_count: int
    total_visitors: int
    cross_day_booking_count: int
    conflict_count: int = 0
