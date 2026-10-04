import { useId, useState } from 'react';

// Type something and press Enter (or tap Add) to make it a tag. Tap a
// suggestion to add it. Tap the × on a tag to remove it.
export default function TagInput({ label, hint, value, onChange, suggestions = [], max = 15, maxLength = 40, placeholder }) {
  const [draft, setDraft] = useState('');
  const id = useId();
  const full = value.length >= max;

  const add = (raw) => {
    const t = raw.trim().replace(/\s+/g, ' ').slice(0, maxLength);
    if (!t || full || value.some((v) => v.toLowerCase() === t.toLowerCase())) { setDraft(''); return; }
    onChange([...value, t]);
    setDraft('');
  };
  const onKey = (e) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(draft); }
    else if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1));
  };
  const open = suggestions.filter((s) => !value.some((v) => v.toLowerCase() === s.toLowerCase())).slice(0, 8);

  return (
    <div className="tag-input">
      <label className="strong" htmlFor={id}>{label}</label>
      {hint && <span className="small muted">{hint}</span>}
      {value.length > 0 && (
        <ul className="chips tag-list" aria-label={`${label}: ${value.length} added`}>
          {value.map((v) => (
            <li key={v} className="tag">{v}
              <button type="button" className="tag-x" aria-label={`Remove ${v}`} onClick={() => onChange(value.filter((x) => x !== v))}>×</button>
            </li>
          ))}
        </ul>
      )}
      <div className="tag-entry">
        <input id={id} value={draft} maxLength={maxLength} disabled={full} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKey}
          placeholder={full ? `That's the max (${max})` : placeholder} />
        <button type="button" className="btn btn-sm" onClick={() => add(draft)} disabled={full || !draft.trim()}>Add</button>
      </div>
      {open.length > 0 && !full && (
        <div className="chips tag-suggest">
          {open.map((s) => <button key={s} type="button" className="chip chip-sm" onClick={() => add(s)}>+ {s}</button>)}
        </div>
      )}
    </div>
  );
}
