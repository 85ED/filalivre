export function FilaLivreLogo({ className = 'w-10 h-10', variant = 'dark' }: { className?: string; variant?: 'dark' | 'light' }) {
  const fill = variant === 'light' ? '#ffffff' : '#171717';
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect x="20" y="8" width="24" height="48" rx="12" fill={fill} />
      <clipPath id="pole-clip">
        <rect x="20" y="8" width="24" height="48" rx="12" />
      </clipPath>
      <g clipPath="url(#pole-clip)">
        <path d="M20 32 C26 24, 38 24, 44 16" stroke="#ef4444" strokeWidth="4" strokeLinecap="round" />
        <path d="M20 44 C26 36, 38 36, 44 28" stroke="#ef4444" strokeWidth="4" strokeLinecap="round" />
        <path d="M20 38 C26 30, 38 30, 44 22" stroke="#3b82f6" strokeWidth="4" strokeLinecap="round" />
        <path d="M20 50 C26 42, 38 42, 44 34" stroke="#3b82f6" strokeWidth="4" strokeLinecap="round" />
        <rect x="22" y="12" width="20" height="40" rx="10" fill="white" opacity="0.15" />
      </g>
      <circle cx="32" cy="10" r="6" fill={fill} />
      <circle cx="32" cy="54" r="6" fill={fill} />
    </svg>
  );
}
