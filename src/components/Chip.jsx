export default function Chip({ on, onClick, children }) {
  return (
    <button type="button" className={on ? 'chip chip-on' : 'chip'} aria-pressed={on} onClick={onClick}>
      {children}
    </button>
  );
}

export function ChipGroup({ options, value, onChange, multi = false }) {
  const toggle = (opt) => {
    if (!multi) return onChange(opt);
    onChange(value.includes(opt) ? value.filter((v) => v !== opt) : [...value, opt]);
  };
  return (
    <div className="chips">
      {options.map((opt) => {
        const [val, label] = Array.isArray(opt) ? opt : [opt, opt];
        const on = multi ? value.includes(val) : value === val;
        return <Chip key={val} on={on} onClick={() => toggle(val)}>{label}</Chip>;
      })}
    </div>
  );
}
