import React from 'react';

/** The one icon set: outline paths on a 24px grid, drawn at 16 or 20px. */
const PATHS = {
  'chevrons-right': ['M13 5l7 7-7 7M5 5l7 7-7 7'],
  'chevrons-left': ['M11 19l-7-7 7-7m8 14l-7-7 7-7'],
  'chevron-left': ['M15 19l-7-7 7-7'],
  'chevron-right': ['M9 5l7 7-7 7'],
  plus: ['M12 4v16m8-8H4'],
  minus: ['M20 12H4'],
  settings: [
    'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z',
    'M15 12a3 3 0 11-6 0 3 3 0 016 0z',
  ],
  'arrow-left': ['M10 19l-7-7m0 0l7-7m-7 7h18'],
  'arrow-right': ['M14 5l7 7m0 0l-7 7m7-7H3'],
  document: ['M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'],
  chat: ['M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z'],
  upload: ['M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12'],
  more: ['M12 5h.01M12 12h.01M12 19h.01'],
  trash: ['M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16'],
  close: ['M6 18L18 6M6 6l12 12'],
  sun: ['M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z'],
  moon: ['M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z'],
  monitor: ['M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z'],
  search: ['M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z'],
  check: ['M5 13l4 4L19 7'],
  code: ['M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4'],
  image: ['M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z'],
  spinner: ['M12 3a9 9 0 109 9'],
};

/**
 * @param {Object} props
 * @param {keyof typeof PATHS} props.name
 * @param {16|20} [props.size]
 * @param {string} [props.className]
 */
export default function Icon({ name, size = 16, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
