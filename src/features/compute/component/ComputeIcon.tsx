const paths = {
  add: <path d="M12 5v14M5 12h14" />,
  remove: <><path d="M5 7h14M10 11v6M14 11v6M8 7l1 13h6l1-13M9 7V5h6v2" /></>,
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
