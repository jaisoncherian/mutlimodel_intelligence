import React from 'react';

/**
 * Gold Standard: ActivityCard
 * Pure React JSX component
 */
export const ActivityCard = ({
  username,
  action,
  timestamp,
  avatarUrl,
  repoName,
}) => {
  const isMerged = action === 'MERGED';

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg bg-surface-dark p-4 min-h-14 shadow-sm ring-1 ring-white/10">
      <div className="flex items-center gap-3">
        <img
          src={avatarUrl}
          alt={`${username}'s avatar`}
          className="size-8 rounded-full border border-white/20 object-cover"
        />
        <div className="flex flex-col">
          <p className="text-sm font-medium text-white">
            <span className="font-semibold">{username}</span>{' '}
            {isMerged ? 'merged PR in' : 'committed to'}{' '}
            <span className="font-semibold text-primary">{repoName}</span>
          </p>
          <span className="text-xs text-secondary">{timestamp}</span>
        </div>
      </div>
      <div className="flex items-center">
        <span
          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
            isMerged
              ? 'bg-purple-950 text-purple-300 border border-purple-800'
              : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
          }`}
        >
          {action}
        </span>
      </div>
    </div>
  );
};

export default ActivityCard;
