'use client';

// YouTube 平台图标
export function YouTubeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
      <rect x="2" y="4" width="20" height="16" rx="4" fill="#FF0000" style={{ opacity: 0.9 }} />
      <path d="M10 8.5L16 12L10 15.5V8.5Z" fill="#ffffff" />
    </svg>
  );
}

// Bilibili 平台图标
export function BilibiliIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
      <rect x="3" y="6" width="18" height="13" rx="3" fill="#00A1D6" style={{ opacity: 0.9 }} />
      <path d="M6 6L8 3M18 6L16 3" stroke="#00A1D6" strokeWidth="2" strokeLinecap="round" style={{ opacity: 0.7 }} />
      <circle cx="9" cy="12" r="1.5" fill="#ffffff" />
      <circle cx="15" cy="12" r="1.5" fill="#ffffff" />
    </svg>
  );
}
