// Light / dark mode. The choice is remembered on this device.
// 'system' follows the phone or computer's own setting.
import { useEffect, useState } from 'react';

const KEY = 'oa-theme';
const EVENT = 'oa-theme-change';
const COLORS = { light: '#FBF5E9', dark: '#151D18' };
const media = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

export function getChoice() {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch { return 'system'; }
}

export function resolve(choice) {
  if (choice === 'light' || choice === 'dark') return choice;
  return media?.matches ? 'dark' : 'light';
}

export function applyTheme(choice = getChoice()) {
  const mode = resolve(choice);
  document.documentElement.dataset.theme = mode;
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', COLORS[mode]));
  return mode;
}

export function setChoice(choice) {
  try {
    if (choice === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, choice);
  } catch { /* private browsing: still switch for this visit */ }
  applyTheme(choice);
  window.dispatchEvent(new CustomEvent(EVENT, { detail: choice }));
}

// Follow the device setting live while the choice is 'system'
media?.addEventListener?.('change', () => { if (getChoice() === 'system') { applyTheme('system'); window.dispatchEvent(new CustomEvent(EVENT, { detail: 'system' })); } });

export default function useTheme() {
  const [choice, setLocal] = useState(getChoice);
  const [mode, setMode] = useState(() => resolve(getChoice()));
  useEffect(() => {
    const sync = () => { const c = getChoice(); setLocal(c); setMode(applyTheme(c)); };
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener(EVENT, sync); window.removeEventListener('storage', sync); };
  }, []);
  return { choice, mode, setChoice };
}
