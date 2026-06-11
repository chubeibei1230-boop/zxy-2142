const BASE_URL = 'http://localhost:8118/api';

function getAuthHeaders() {
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  if (user) {
    return {
      'X-User-Id': String(user.id),
      'X-User-Role': user.role,
      'Content-Type': 'application/json'
    };
  }
  return { 'Content-Type': 'application/json' };
}

async function request(url, options = {}) {
  const res = await fetch(BASE_URL + url, {
    ...options,
    headers: { ...getAuthHeaders(), ...(options.headers || {}) }
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: '请求失败' }));
    throw new Error(err.detail || '请求失败');
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  login: (data) => request('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  getMe: () => request('/users/me'),

  listVenues: () => request('/venues'),
  createVenue: (data) => request('/venues', { method: 'POST', body: JSON.stringify(data) }),
  updateVenue: (id, data) => request(`/venues/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteVenue: (id) => request(`/venues/${id}`, { method: 'DELETE' }),

  listTimeSlots: () => request('/time-slots'),
  createTimeSlot: (data) => request('/time-slots', { method: 'POST', body: JSON.stringify(data) }),
  updateTimeSlot: (id, data) => request(`/time-slots/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTimeSlot: (id) => request(`/time-slots/${id}`, { method: 'DELETE' }),

  listStaff: () => request('/staff'),
  createStaff: (data) => request('/staff', { method: 'POST', body: JSON.stringify(data) }),
  updateStaff: (id, data) => request(`/staff/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteStaff: (id) => request(`/staff/${id}`, { method: 'DELETE' }),

  listBookings: (start, end) => {
    const params = new URLSearchParams();
    if (start) params.set('start_date', start);
    if (end) params.set('end_date', end);
    return request(`/bookings?${params.toString()}`);
  },
  getBookingsByDate: (date) => request(`/bookings/by-date/${date}`),
  getMonthlyStats: (year, month) => request(`/bookings/stats/month/${year}/${month}`),
  createBooking: (data) => request('/bookings', { method: 'POST', body: JSON.stringify(data) }),
  updateBooking: (id, data) => request(`/bookings/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteBooking: (id) => request(`/bookings/${id}`, { method: 'DELETE' }),
  getBookingChangeLogs: (id) => request(`/bookings/${id}/change-logs`),
  checkConflict: (data) => request('/bookings/check-conflict', { method: 'POST', body: JSON.stringify(data) }),

  listChangeLogs: (start, end) => {
    const params = new URLSearchParams();
    if (start) params.set('start_date', start);
    if (end) params.set('end_date', end);
    return request(`/change-logs?${params.toString()}`);
  },

  createSnapshot: () => request('/snapshots', { method: 'POST' }),
  listSnapshots: () => request('/snapshots'),
  getSnapshot: (id) => request(`/snapshots/${id}`),

  getUpcomingReminders: (days = 3) => request(`/reminders/upcoming?days=${days}`)
};
