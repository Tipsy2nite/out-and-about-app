import { useState } from 'react';

// A round profile picture, or the person's first initial if they haven't added one.
export default function Avatar({ name, url, className = 'avatar', alt }) {
  const [broken, setBroken] = useState(false);
  const initial = (name || '?').charAt(0);
  if (!url || broken) return <span className={className} aria-hidden={alt ? undefined : 'true'}>{initial}</span>;
  return (
    <span className={`${className} avatar-photo`}>
      <img src={url} alt={alt ?? ''} loading="lazy" decoding="async" onError={() => setBroken(true)} />
    </span>
  );
}
