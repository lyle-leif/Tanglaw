// Icons copied from design/prototype.html

export const Logo = () => (
  <svg width="34" height="34" viewBox="0 0 40 40" aria-hidden="true">
    <g stroke="#F2A93B" strokeWidth="2.5" strokeLinecap="round">
      <path d="M20 3v5M20 32v5M3 20h5M32 20h5M8 8l3.5 3.5M28.5 28.5 32 32M8 32l3.5-3.5M28.5 11.5 32 8" />
    </g>
    <circle cx="20" cy="20" r="8" fill="#F2A93B" />
    <circle cx="20" cy="20" r="3.2" fill="#13233F" />
  </svg>
);

export const Avatar = () => (
  <svg width="36" height="36" viewBox="0 0 40 40" aria-hidden="true">
    <circle cx="20" cy="20" r="20" fill="#13233F" />
    <g stroke="#F2A93B" strokeWidth="2" strokeLinecap="round">
      <path d="M20 7v3M20 30v3M7 20h3M30 20h3M11 11l2 2M27 27l2 2M11 29l2-2M27 13l2-2" />
    </g>
    <circle cx="20" cy="20" r="6" fill="#F2A93B" />
  </svg>
);

export const Check = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <path d="m7.5 12.5 3 3 6-6.5" />
  </svg>
);

export const Stop = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M8 2h8l6 6v8l-6 6H8l-6-6V8z" />
    <path d="M8 12h8" />
  </svg>
);

export const Shield = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8A5A00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: "none" }}>
    <path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z" />
    <path d="M12 8v4M12 16h.01" />
  </svg>
);

export const Lock = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);

export const Send = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#13233F" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" />
  </svg>
);

export const Hosp = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#13233F" strokeWidth="2" aria-hidden="true" style={{ flex: "none" }}>
    <path d="M3 21h18M5 21V7l7-4 7 4v14M10 10h4M12 8v4M9 21v-4h6v4" />
  </svg>
);

export const Spin = () => <span className="spin" aria-hidden="true" />;
