import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';
import { squarePhoto } from '../lib/photo.js';
import Avatar from './Avatar.jsx';

const MAX_BYTES = 15 * 1024 * 1024; // original file; we shrink it before upload

function storagePath(url) {
  const marker = '/avatars/';
  const i = url ? url.indexOf(marker) : -1;
  return i === -1 ? null : decodeURIComponent(url.slice(i + marker.length).split('?')[0]);
}

export default function PhotoPicker() {
  const { user, profile, refreshProfile } = useAuth();
  const input = useRef(null);
  const [preview, setPreview] = useState(null); // { blob, url }
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview]);

  const choose = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(''); setMsg('');
    if (!file.type.startsWith('image/')) { setError('Please choose a photo.'); return; }
    if (file.size > MAX_BYTES) { setError('That photo is too big. Try one under 15 MB.'); return; }
    try {
      const blob = await squarePhoto(file);
      setPreview({ blob, url: URL.createObjectURL(blob) });
    } catch (err) { setError(err.message); }
  };

  const save = async () => {
    setBusy(true); setError('');
    const ext = preview.blob.type === 'image/webp' ? 'webp' : 'jpg';
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('avatars')
      .upload(path, preview.blob, { contentType: preview.blob.type, cacheControl: '31536000', upsert: false });
    if (upErr) { setBusy(false); setError(`Upload didn't work: ${upErr.message}`); return; }
    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    const old = storagePath(profile.avatar_url);
    const { error: saveErr } = await supabase.from('profiles').update({ avatar_url: data.publicUrl }).eq('id', user.id);
    if (saveErr) {
      await supabase.storage.from('avatars').remove([path]);
      setBusy(false); setError(`Couldn't save your photo: ${saveErr.message}`); return;
    }
    if (old) await supabase.storage.from('avatars').remove([old]);
    await refreshProfile();
    setPreview(null); setBusy(false); setMsg('Photo saved.');
  };

  const remove = async () => {
    if (!window.confirm('Remove your profile photo?')) return;
    setBusy(true); setError('');
    const old = storagePath(profile.avatar_url);
    const { error: err } = await supabase.from('profiles').update({ avatar_url: null }).eq('id', user.id);
    if (!err && old) await supabase.storage.from('avatars').remove([old]);
    await refreshProfile();
    setBusy(false); setMsg(err ? `Didn't remove: ${err.message}` : 'Photo removed.');
  };

  return (
    <section className="photo-picker">
      <div className="row">
        {preview
          ? <span className="avatar avatar-xxl avatar-photo"><img src={preview.url} alt="Preview of your new profile photo" /></span>
          : <Avatar name={profile.display_name} url={profile.avatar_url} className="avatar avatar-xxl" alt="Your profile photo" />}
        <div className="stack" style={{ gap: 8 }}>
          <strong>Profile photo</strong>
          <input ref={input} type="file" accept="image/*" onChange={choose} hidden />
          {preview ? (
            <div className="row">
              <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save photo'}</button>
              <button type="button" className="linkish" onClick={() => setPreview(null)} disabled={busy}>Cancel</button>
            </div>
          ) : (
            <div className="row">
              <button type="button" className="btn btn-sm" onClick={() => input.current?.click()} disabled={busy}>
                {profile.avatar_url ? 'Change photo' : 'Add a photo'}
              </button>
              {profile.avatar_url && <button type="button" className="linkish" onClick={remove} disabled={busy}>Remove</button>}
            </div>
          )}
        </div>
      </div>
      <p className="small muted">A clear photo of just you, so people recognize you at gatherings. No kids, no other people, nothing you don't have the rights to. See the <Link to="/guidelines">guidelines</Link>.</p>
      {error && <p className="error" role="alert">{error}</p>}
      {msg && <p className="small" role="status">{msg}</p>}
    </section>
  );
}
