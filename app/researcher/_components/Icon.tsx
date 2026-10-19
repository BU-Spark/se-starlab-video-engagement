import type { CSSProperties } from 'react';

export type IconName =
  | 'plus'
  | 'arrowUp'
  | 'arrowDown'
  | 'trash'
  | 'video'
  | 'text'
  | 'survey'
  | 'upload'
  | 'check'
  | 'chevron'
  | 'flask'
  | 'save'
  | 'info'
  | 'close'
  | 'thumbUp'
  | 'thumbDown';

export default function Icon({ name, size = 20, style }: { name: IconName; size?: number; style?: CSSProperties }) {
  const paths: Record<Exclude<IconName, 'thumbDown'>, React.ReactNode> = {
    plus: <path d="M12 5v14M5 12h14" />,
    arrowUp: <path d="m6 12 6-6 6 6M12 6v12" />,
    arrowDown: <path d="m6 12 6 6 6-6M12 6v12" />,
    trash: (
      <>
        <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5" />
      </>
    ),
    video: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="3" />
        <path d="m10 8 6 4-6 4Z" />
      </>
    ),
    text: (
      <>
        <path d="M5 5h14M12 5v14M8 19h8M5 5v3M19 5v3" />
      </>
    ),
    survey: (
      <>
        <rect x="4" y="3" width="16" height="18" rx="3" />
        <path d="M11 8h5M11 12h5M11 16h5M8 8h.01M8 12h.01M8 16h.01" />
      </>
    ),
    upload: (
      <>
        <path d="m8 8 4-4 4 4M12 4v11M4 15v5h16v-5" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    chevron: <path d="m9 5 7 7-7 7" />,
    flask: (
      <>
        <path d="M9 3h6M10 3v6L4 19a1 1 0 0 0 1 2h14a1 1 0 0 0 1-2L14 9V3M7 15h10" />
      </>
    ),
    save: (
      <>
        <path d="M5 3h12l4 4v14H3V3h2Z" />
        <path d="M7 3v6h9V3M7 21v-8h10v8" />
      </>
    ),
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v6M12 7h.01" />
      </>
    ),
    close: <path d="m6 6 12 12M6 18 18 6" />,
    thumbUp: (
      <>
        <path d="M7 10h3l3-7c2 0 3 1 2 4l-1 3h5a2 2 0 0 1 2 2l-2 7a2 2 0 0 1-2 1H7ZM3 10h4v10H3Z" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={style}
    >
      <g transform={name === 'thumbDown' ? 'rotate(180 12 12)' : undefined}>
        {paths[name === 'thumbDown' ? 'thumbUp' : name]}
      </g>
    </svg>
  );
}
