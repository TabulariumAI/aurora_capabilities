const paths = {
  reprocess: <><path d="M20 11a8 8 0 1 0 2 5.3" /><path d="M20 4v7h-7" /></>,
  clear: <path d="m6 6 12 12M6 18 18 6" />,
  add: <path d="M12 5v14M5 12h14" />,
  remove: <><path d="M5 7h14M10 11v6M14 11v6M8 7l1 13h6l1-13M9 7V5h6v2" /></>,
  edit: <><path d="M4 17.5V20h2.5L18 8.5 15.5 6 4 17.5Z" /><path d="m14.5 7 2.5 2.5" /></>,
  copy: <><rect height="11" rx="1.5" width="11" x="8" y="8" /><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8" /></>,
  expand: <><rect height="16" rx="2" width="16" x="4" y="4" /><path d="M8 12h8M12 8v8" /></>,
  collapse: <><rect height="16" rx="2" width="16" x="4" y="4" /><path d="M8 12h8" /></>,
};

export function ComputeIcon({ name }: { name: keyof typeof paths }) {
  return (
    <svg aria-hidden="true" fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="18">
      {paths[name]}
    </svg>
  );
}
