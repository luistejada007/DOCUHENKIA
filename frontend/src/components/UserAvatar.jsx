import { useState } from 'react';

export default function UserAvatar({ user, className = '' }) {
  const [failedUrl, setFailedUrl] = useState('');
  const avatarUrl = user?.avatarUrl || '';
  const initials = (user?.name || 'U').trim().charAt(0).toUpperCase() || 'U';

  return (
    <span className={`avatar ${className}`.trim()} aria-label={`Foto de ${user?.name || 'usuario'}`}>
      {avatarUrl && failedUrl !== avatarUrl
        ? <img src={avatarUrl} alt="" onError={() => setFailedUrl(avatarUrl)} />
        : initials}
    </span>
  );
}