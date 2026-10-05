import { useEffect, useState } from 'react';

const DISMISS_KEY = 'oa-install-dismissed';
const DISMISS_DAYS = 30;

function isInstalled() {
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
}
function isIOS() {
  const ua = window.navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
}
function isPhoneSized() {
  return window.matchMedia?.('(max-width: 900px)').matches;
}
function dismissedRecently() {
  try {
    const t = Number(localStorage.getItem(DISMISS_KEY) || 0);
    return Date.now() - t < DISMISS_DAYS * 86400000;
  } catch { return false; }
}

// "Get the app" card. On Android/Chrome it offers a one-tap Install button;
// on iPhone it shows the two taps needed in Safari. Hidden once installed.
// variant="banner": dismissible card on phones. variant="settings": always shown (Me page).
export default function InstallApp({ variant = 'banner' }) {
  const [prompt, setPrompt] = useState(() => window.__oaInstallPrompt || null);
  const [installed, setInstalled] = useState(isInstalled);
  const [hidden, setHidden] = useState(() => variant === 'banner' && (dismissedRecently() || !isPhoneSized()));
  const [showSteps, setShowSteps] = useState(false);

  useEffect(() => {
    const ready = () => setPrompt(window.__oaInstallPrompt || null);
    const done = () => setInstalled(true);
    window.addEventListener('oa-install-ready', ready);
    window.addEventListener('oa-installed', done);
    return () => { window.removeEventListener('oa-install-ready', ready); window.removeEventListener('oa-installed', done); };
  }, []);

  const ios = isIOS();
  if (installed || hidden) return null;
  if (!prompt && !ios && variant === 'banner') return null; // browser can't install; don't nag

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* private mode */ }
    setHidden(true);
  };

  const install = async () => {
    if (!prompt) { setShowSteps(true); return; }
    prompt.prompt();
    const choice = await prompt.userChoice.catch(() => null);
    window.__oaInstallPrompt = null;
    setPrompt(null);
    if (choice?.outcome === 'accepted') setInstalled(true);
  };

  return (
    <section className={`install-card${variant === 'settings' ? ' install-settings' : ''}`} aria-label="Get the Out & About app">
      <img src="/icons/icon-192.png" alt="" width="56" height="56" className="install-icon" />
      <div className="install-body">
        <strong>Get the Out &amp; About app</strong>
        <span className="small">Opens from your home screen like any app. No app store needed.</span>
        {(ios && !prompt) || showSteps ? (
          <ol className="install-steps small">
            {ios ? <>
              <li>In <strong>Safari</strong>, tap the <strong>Share</strong> button <span aria-hidden="true">(square with an arrow)</span>.</li>
              <li>Scroll down and tap <strong>Add to Home Screen</strong>, then <strong>Add</strong>.</li>
            </> : <>
              <li>Open your browser's menu <span aria-hidden="true">(⋮ or ⋯)</span>.</li>
              <li>Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li>
            </>}
          </ol>
        ) : (
          <div className="row" style={{ gap: 10 }}>
            <button type="button" className="btn btn-primary btn-sm" onClick={install}>Install app</button>
          </div>
        )}
      </div>
      {variant === 'banner' && <button type="button" className="install-x" aria-label="Not now" onClick={dismiss}>×</button>}
    </section>
  );
}
