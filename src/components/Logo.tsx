"use client";

export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className="shrink-0">
      <defs>
        <linearGradient id="moxie-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#b9b9c3" />
        </linearGradient>
      </defs>
      <path d="M9.2 3.5 4 12l5.2 8.5h3.1L7.2 12l5.1-8.5z" fill="url(#moxie-mark)" />
      <path d="M15.4 3.5 10.2 12l5.2 8.5h3.1L13.4 12l5.1-8.5z" fill="url(#moxie-mark)" opacity=".55" />
    </svg>
  );
}
