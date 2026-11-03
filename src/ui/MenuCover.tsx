import { useState } from 'react';

export interface MenuCoverProps { src: string; name: string; className?: string }

/** Real catalog artwork with a legible fallback if the asset fails. */
export function MenuCover({ src, name, className = '' }: MenuCoverProps) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  return <div className={`ordering-cover ${className}`}>
    {src && failedSource !== src
      ? <img src={src} alt={name} onError={() => setFailedSource(src)} />
      : <span className="ordering-cover-fallback" role="img" aria-label={name}>{name.slice(0, 1)}</span>}
  </div>;
}
