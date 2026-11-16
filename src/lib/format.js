export function eventDateParts(iso) {
  const d = new Date(iso);
  return {
    day: d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
    date: d.getDate(),
    month: d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
    time: d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
    long: d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
  };
}

export function timeAgo(iso) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.round(hrs / 24)}d`;
}

// value for <input type="datetime-local"> one week from now at 10:00
export function defaultStart() {
  const d = new Date(Date.now() + 7 * 86400000);
  d.setHours(10, 0, 0, 0);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// "12:00 PM – 2:00 PM" (or just the start time when there's no end time).
// Ends on a later day? Says so: "9:00 PM – 1:00 AM (next day)".
export function timeRange(startIso, endIso) {
  const start = eventDateParts(startIso).time;
  if (!endIso) return start;
  const s = new Date(startIso);
  const e = new Date(endIso);
  const end = eventDateParts(endIso).time;
  const days = Math.round((new Date(e.getFullYear(), e.getMonth(), e.getDate()) - new Date(s.getFullYear(), s.getMonth(), s.getDate())) / 86400000);
  if (days === 0) return `${start} – ${end}`;
  if (days === 1) return `${start} – ${end} (next day)`;
  return `${start} – ${eventDateParts(endIso).long}, ${end}`;
}

// When a gathering is over: its end time, or 3 hours after it starts if the host didn't give one.
export function eventEndMs(event) {
  return event.ends_at ? new Date(event.ends_at).getTime() : new Date(event.starts_at).getTime() + 3 * 3600000;
}

// "HH:MM" for <input type="time"> from an ISO time
export function localTime(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Turns a start ("YYYY-MM-DDTHH:MM", local) plus an end time ("HH:MM") into the end Date.
// An end time at or before the start time means it runs past midnight into the next day.
export function endFromTime(startLocal, endTime) {
  if (!startLocal || !endTime) return null;
  const start = new Date(startLocal);
  const [h, m] = endTime.split(':').map(Number);
  const end = new Date(start);
  end.setHours(h, m, 0, 0);
  if (end <= start) end.setDate(end.getDate() + 1);
  return end;
}
