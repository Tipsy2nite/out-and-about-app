import { useEffect, useRef, useState } from 'react';
import { AUSTIN } from '../lib/constants.js';

// Address lookup using Photon (free OpenStreetMap geocoder, no key needed).
// Results are nudged toward Austin so local places show up first.
const PHOTON = 'https://photon.komoot.io/api/';

function describe(p) {
  const street = [p.housenumber, p.street].filter(Boolean).join(' ');
  const town = [p.city || p.town || p.village || p.district, p.state].filter(Boolean).join(', ');
  const placeName = p.name && p.name !== street ? p.name : '';
  const line1 = placeName || street || p.city || p.state || p.country || '';
  const line2 = [placeName ? street : '', town, p.postcode].filter(Boolean).join(', ');
  const full = [placeName, street, town, p.postcode].filter(Boolean).join(', ');
  return { line1, line2, full, placeName };
}

async function lookup(q, signal) {
  const url = `${PHOTON}?q=${encodeURIComponent(q)}&lat=${AUSTIN[0]}&lon=${AUSTIN[1]}&limit=6&lang=en`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error('lookup failed');
  const data = await res.json();
  const seen = new Set();
  return (data.features || [])
    .map((ft) => {
      const d = describe(ft.properties || {});
      const [lng, lat] = ft.geometry.coordinates;
      return { ...d, lat, lng, id: `${ft.properties.osm_type}${ft.properties.osm_id}` };
    })
    .filter((r) => r.full && !seen.has(r.full) && seen.add(r.full));
}

// value: the address text. onChange(text) as they type.
// onPick({ full, placeName, lat, lng }) when they choose a suggestion.
export default function AddressSearch({ value, onChange, onPick, label, placeholder, hint }) {
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | searching | none | error
  const [active, setActive] = useState(-1);
  const typed = useRef(false);   // only search after the person types (not when the form loads)
  const boxRef = useRef(null);

  useEffect(() => {
    if (!typed.current) return;
    const q = value.trim();
    if (q.length < 4) { setResults([]); setStatus('idle'); return; }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setStatus('searching');
      try {
        const r = await lookup(q, ctrl.signal);
        setResults(r);
        setActive(-1);
        setStatus(r.length ? 'idle' : 'none');
        setOpen(true);
      } catch (e) {
        if (e.name !== 'AbortError') setStatus('error');
      }
    }, 450);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [value]);

  // close the list when tapping elsewhere
  useEffect(() => {
    const away = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, []);

  const choose = (r) => {
    typed.current = false;
    onChange(r.full);
    onPick(r);
    setOpen(false);
    setResults([]);
    setStatus('idle');
  };

  const onKeyDown = (e) => {
    if (!open || !results.length) {
      if (e.key === 'Enter') e.preventDefault(); // don't submit the whole form by accident
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(results[Math.max(active, 0)]); }
    else if (e.key === 'Escape') setOpen(false);
  };

  return (
    <div className="addr" ref={boxRef}>
      <label className="field">{label}
        <input
          type="text"
          value={value}
          onChange={(e) => { typed.current = true; onChange(e.target.value); }}
          onFocus={() => results.length && setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-expanded={open && results.length > 0}
          aria-controls="addr-list"
          aria-autocomplete="list"
        />
      </label>
      {open && results.length > 0 && (
        <ul className="addr-list" id="addr-list" role="listbox">
          {results.map((r, i) => (
            <li key={r.id + i} role="option" aria-selected={i === active}>
              <button type="button" className={i === active ? 'on' : ''} onClick={() => choose(r)}>
                <strong>{r.line1}</strong>
                {r.line2 && <span className="small muted">{r.line2}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="small muted addr-hint" aria-live="polite">
        {status === 'searching' ? 'Looking it up…'
          : status === 'none' ? "Couldn't find that one. Try adding the city, or tap the map instead."
          : status === 'error' ? "Address lookup isn't working right now. You can still tap the map."
          : hint}
      </p>
    </div>
  );
}
