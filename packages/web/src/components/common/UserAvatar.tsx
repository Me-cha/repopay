import { useState } from 'react';

const TINTS: [string, string][] = [
  ['#E3F3EA', '#14532D'],
  ['#FFEAD8', '#7C2D12'],
  ['#E4EEF8', '#1E3A5F'],
  ['#F3ECE1', '#5C4022'],
];

function tintFor(name: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return TINTS[Math.abs(hash) % TINTS.length] ?? ['#EAEAEA', '#141414'];
}

export function UserAvatar({ login, size = 28 }: { login: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const validGithubHandle = Boolean(login) && /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/.test(login);
  const [bg, fg] = tintFor(login || 'U');

  if (failed || !validGithubHandle) {
    return (
      <span
        className="c2-avatar-fallback"
        style={{
          width: `${String(size)}px`,
          height: `${String(size)}px`,
          fontSize: `${String(Math.max(11, Math.round(size * 0.44)))}px`,
          background: bg,
          color: fg,
        }}
        aria-hidden="true"
      >
        {(login || 'U').charAt(0).toUpperCase()}
      </span>
    );
  }

  return (
    <img
      src={`https://github.com/${encodeURIComponent(login)}.png?size=${String(size * 2)}`}
      alt={`@${login}`}
      className="c2-avatar"
      style={{ width: `${String(size)}px`, height: `${String(size)}px` }}
      onError={() => { setFailed(true); }}
    />
  );
}
