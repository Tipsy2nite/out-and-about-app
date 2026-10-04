// Star ratings for hosts: a read-only display, a summary line, and a picker.

export function Stars({ value, size }) {
  const full = Math.min(5, Math.floor(Number(value || 0) + 0.25)); // 4.5 shows 4 stars, 4.8 shows 5
  return (
    <span className={`stars${size === 'lg' ? ' stars-lg' : ''}`} aria-hidden="true">
      {'★★★★★'.slice(0, full)}<span className="stars-off">{'★★★★★'.slice(full)}</span>
    </span>
  );
}

// "★★★★★ 4.8 · 12 reviews" or "No reviews yet"
export function HostRating({ rating, compact }) {
  if (!rating || !rating.review_count) return <span className="small muted">{compact ? 'New host' : 'No reviews yet'}</span>;
  const n = Number(rating.review_count);
  const avg = Number(rating.avg_rating).toFixed(1);
  return (
    <span className="rating" aria-label={`Rated ${avg} out of 5 from ${n} review${n === 1 ? '' : 's'}`}>
      <Stars value={rating.avg_rating} /> <strong>{avg}</strong>
      <span className="small muted"> · {n} review{n === 1 ? '' : 's'}</span>
    </span>
  );
}

const LABELS = ['', 'Not great', 'Meh', 'Good', 'Great', 'Amazing'];

export function StarPicker({ value, onChange }) {
  return (
    <div className="star-picker" role="radiogroup" aria-label="Your rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} star${n === 1 ? '' : 's'}: ${LABELS[n]}`}
          className={`star-btn${n <= value ? ' star-on' : ''}`} onClick={() => onChange(n)}>★</button>
      ))}
      {value > 0 && <span className="small strong">{LABELS[value]}</span>}
    </div>
  );
}
