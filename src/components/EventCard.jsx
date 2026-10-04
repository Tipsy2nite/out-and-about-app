import { Link } from 'react-router-dom';
import { TINTS } from '../lib/constants.js';
import { eventDateParts } from '../lib/format.js';

export default function EventCard({ event, going, rating }) {
  const d = eventDateParts(event.starts_at);
  const off = event.status !== 'scheduled';
  return (
    <Link to={`/events/${event.id}`} className="ticket">
      <div className="ticket-stub" style={{ background: TINTS[event.category] }}>
        <span className="stub-day">{d.day}</span>
        <span className="stub-date">{d.date}</span>
        <span className="stub-month">{d.month}</span>
      </div>
      <div className="ticket-body">
        <span className="ticket-kind">{event.category} · {event.size}</span>
        <span className="ticket-title">{event.title}</span>
        <span className="muted">{d.time} · {event.area_label}{event.is_private_location ? ' (general area)' : ''}</span>
        <span className="ticket-tags">
          {event.access_entry === 'Step-free' && <span className="pill">Step-free</span>}
          {event.audience !== 'everyone' && <span className="pill">For {event.audience}</span>}
          {rating?.review_count > 0 && <span className="pill pill-star">★ {Number(rating.avg_rating).toFixed(1)} host</span>}
          {off && <span className="pill pill-dark">{event.status}</span>}
          {going && <span className="pill pill-dark">You're in</span>}
        </span>
      </div>
    </Link>
  );
}
