import useTheme from '../lib/theme.js';

// Moon/sun button in the top bar: flips between light and dark.
export function ThemeToggle() {
  const { mode, setChoice } = useTheme();
  const dark = mode === 'dark';
  const label = dark ? 'Switch to light mode' : 'Switch to dark mode';
  return (
    <button type="button" className="theme-btn" aria-label={label} title={label} aria-pressed={dark}
      onClick={() => setChoice(dark ? 'light' : 'dark')}>
      {dark
        ? (
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <circle cx="12" cy="12" r="4.5" fill="var(--sun)" />
            <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
          </svg>
        )
        : (
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round">
            <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
          </svg>
        )}
    </button>
  );
}

// Three-way choice for the settings page.
const OPTIONS = [['system', 'Match my device'], ['light', 'Light'], ['dark', 'Dark']];
export function ThemePicker() {
  const { choice, setChoice } = useTheme();
  return (
    <fieldset>
      <legend>Appearance</legend>
      <div className="chips" role="radiogroup" aria-label="Appearance">
        {OPTIONS.map(([value, label]) => (
          <button key={value} type="button" role="radio" aria-checked={choice === value}
            className={choice === value ? 'chip chip-on' : 'chip'} onClick={() => setChoice(value)}>{label}</button>
        ))}
      </div>
      <p className="small muted" style={{ margin: 0 }}>Changes right away and is remembered on this device.</p>
    </fieldset>
  );
}

export default ThemeToggle;
