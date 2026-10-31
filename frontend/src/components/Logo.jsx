import React from 'react';

/** The DeepCite mark, with the name beside it unless `markOnly` is set. */
export default function Logo({ markOnly = false }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden="true"
        className="w-8 h-8 rounded-full border border-control text-text font-display font-bold text-sm flex items-center justify-center shrink-0"
      >
        D
      </span>
      {!markOnly && <span className="font-display font-bold text-base tracking-tight text-text">DeepCite</span>}
    </span>
  );
}
