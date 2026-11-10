export function CassetteLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 44" className={className} aria-hidden="true" fill="none">
      <rect x="1.5" y="1.5" width="61" height="41" rx="5" stroke="currentColor" strokeWidth="3" />
      <rect x="10" y="9" width="44" height="15" rx="2.5" stroke="currentColor" strokeWidth="2.5" />
      <circle cx="20" cy="16.5" r="4.5" stroke="currentColor" strokeWidth="2.5" />
      <circle cx="44" cy="16.5" r="4.5" stroke="currentColor" strokeWidth="2.5" />
      <path d="M17 33h10l3 5h4l3-5h10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
