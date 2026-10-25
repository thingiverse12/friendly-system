import type { ReactNode, SVGProps } from 'react';

export type IconName =
  | 'home'
  | 'target'
  | 'receipt'
  | 'trophy'
  | 'medal'
  | 'user'
  | 'plus'
  | 'minus'
  | 'arrowRight'
  | 'chevronRight'
  | 'chevronLeft'
  | 'check'
  | 'copy'
  | 'shield'
  | 'trash'
  | 'close'
  | 'edit'
  | 'logout'
  | 'calendar'
  | 'lock'
  | 'users'
  | 'sparkle'
  | 'info'
  | 'clock'
  | 'wallet'
  | 'arrowUpRight'
  | 'arrowDownLeft'
  | 'eye'
  | 'menu'
  | 'link';

const paths: Record<IconName, ReactNode> = {
  home: <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1v-9.5Z" />,
  target: (
    <>
      <circle cx="12" cy="12" r="8.2" />
      <circle cx="12" cy="12" r="4.4" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  receipt: (
    <>
      <path d="M6 3.5h12v17l-2.4-1.6-2.4 1.6L12 19l-1.2 1.5L8.4 19 6 20.5v-17Z" />
      <path d="M9 8h6M9 11.5h6M9 15h3.5" />
    </>
  ),
  trophy: (
    <>
      <path d="M8 4h8v5.2a4 4 0 0 1-8 0V4Z" />
      <path d="M8 5.5H5.4v1.9A3.1 3.1 0 0 0 8.5 10.5M16 5.5h2.6v1.9a3.1 3.1 0 0 1-3.1 3.1" />
      <path d="M12 13.2V17m-3 3.4h6l-.6-2.3H9.6L9 20.4Z" />
    </>
  ),
  medal: (
    <>
      <circle cx="12" cy="14.5" r="4.6" />
      <path d="m9.2 10.6-1.6-7m7.2 7 1.6-7M12 12.6l.8 1.6 1.7.2-1.3 1.2.4 1.7-1.6-.9-1.6.9.4-1.7-1.3-1.2 1.7-.2.8-1.6Z" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8.4" r="3.6" />
      <path d="M5 20c.6-3.6 3.4-5.6 7-5.6s6.4 2 7 5.6" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  arrowRight: <path d="M4.5 12h14m-5.5-5.5L18.5 12 13 17.5" />,
  chevronRight: <path d="m9.5 5.5 6.5 6.5-6.5 6.5" />,
  chevronLeft: <path d="m14.5 5.5-6.5 6.5 6.5 6.5" />,
  check: <path d="m4.8 12.4 4.6 4.6L19.4 7" />,
  copy: (
    <>
      <rect x="8.5" y="8.5" width="11" height="11" rx="2.2" />
      <path d="M15.5 5.5H6.7A2.2 2.2 0 0 0 4.5 7.7v8.8" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3.5 5 6v5.6c0 4.2 2.8 7.3 7 8.9 4.2-1.6 7-4.7 7-8.9V6l-7-2.5Z" />
      <path d="m9 12 2.2 2.2L15.4 10" />
    </>
  ),
  trash: (
    <>
      <path d="M4.8 6.8h14.4M9.5 6.8V4.6h5v2.2M6.8 6.8l.9 13h8.6l.9-13M10.4 10.6v5.6M13.6 10.6v5.6" />
    </>
  ),
  close: <path d="m6 6 12 12M18 6 6 18" />,
  edit: <path d="M4.5 19.5 5.4 15l9.2-9.2 4 4-9.2 9.2-4.9.5ZM13.4 6.8l4 4" />,
  logout: <path d="M14.5 8V5.5a1.5 1.5 0 0 0-1.5-1.5H6.5A1.5 1.5 0 0 0 5 5.5v13A1.5 1.5 0 0 0 6.5 20H13a1.5 1.5 0 0 0 1.5-1.5V16M10 12h10m-3-3.2L20.2 12 17 15.2" />,
  calendar: (
    <>
      <rect x="4.5" y="6" width="15" height="14" rx="2.2" />
      <path d="M8 3.6v4.4M16 3.6v4.4M4.5 10.6h15" />
    </>
  ),
  lock: (
    <>
      <rect x="5.4" y="10.4" width="13.2" height="9.6" rx="2.4" />
      <path d="M8.4 10.4V8a3.6 3.6 0 0 1 7.2 0v2.4M12 14.4v2.2" />
    </>
  ),
  users: (
    <>
      <circle cx="9.4" cy="9" r="3.2" />
      <path d="M3.5 19.5c.5-3.2 2.9-5 5.9-5s5.4 1.8 5.9 5" />
      <path d="M15.6 6.2a3.2 3.2 0 0 1 0 6.2M17 14.8c2 .5 3.2 2.2 3.5 4.7" />
    </>
  ),
  sparkle: <path d="M12 3.5 13.6 9l5.5 1.6-5.5 1.6L12 17.7l-1.6-5.5L4.9 10.6 10.4 9 12 3.5ZM18.5 16.5l.7 2.1 2.1.7-2.1.7-.7 2.1-.7-2.1-2.1-.7 2.1-.7.7-2.1Z" />,
  info: (
    <>
      <circle cx="12" cy="12" r="8.4" />
      <path d="M12 11v5.2M12 8.1v.2" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.4" />
      <path d="M12 7.4V12l3.2 2" />
    </>
  ),
  wallet: (
    <>
      <rect x="3.6" y="6.4" width="16.8" height="12" rx="2.6" />
      <path d="M3.6 10.4h16.8M16.4 14.6h1.8" />
    </>
  ),
  arrowUpRight: <path d="M7 17 17 7M9.4 7H17v7.6" />,
  arrowDownLeft: <path d="M17 7 7 17M14.6 17H7V9.4" />,
  eye: (
    <>
      <path d="M2.8 12S6.2 5.8 12 5.8 21.2 12 21.2 12 17.8 18.2 12 18.2 2.8 12 2.8 12Z" />
      <circle cx="12" cy="12" r="2.8" />
    </>
  ),
  menu: <path d="M4.5 7h15M4.5 12h15M4.5 17h15" />,
  link: <path d="M10.5 13.5a4 4 0 0 0 5.7 0l2.1-2.1a4 4 0 0 0-5.7-5.7l-1 1M13.5 10.5a4 4 0 0 0-5.7 0l-2.1 2.1a4 4 0 0 0 5.7 5.7l1-1" />,
};

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 22, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {paths[name]}
    </svg>
  );
}
