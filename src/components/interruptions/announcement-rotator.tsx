'use client';

import { useEffect, useState } from 'react';
import { announcements } from '@/lib/interruptions/announcements';
import { interruptionsConfig } from '@/lib/interruptions/config';
import { formatCountdown, msUntilLocalMidnight } from '@/lib/interruptions/countdown';

/**
 * Rotates the announcement bar copy, one message of which carries a live countdown to local
 * midnight.
 *
 * Hydration: the server renders message 0 and nothing else, because the index starts at 0 and
 * the countdown starts as a placeholder — neither the clock nor the rotation is consulted
 * during the first render. Both intervals start after hydration, and the countdown has ticked
 * long before the message carrying it comes round at `announcement.rotateMs`.
 */
export function AnnouncementRotator() {
  const [index, setIndex] = useState(0);
  const [remainingMs, setRemainingMs] = useState<number | null>(null);

  useEffect(() => {
    const interval = setInterval(
      () => setIndex((current) => (current + 1) % announcements.length),
      interruptionsConfig.announcement.rotateMs,
    );
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setRemainingMs(msUntilLocalMidnight(new Date())), 1000);
    return () => clearInterval(interval);
  }, []);

  const announcement = announcements[index];

  return (
    <span key={announcement.id} data-announcement={announcement.id}>
      {announcement.text}
      {announcement.countdown ? (
        <>
          {' '}
          <span className="font-semibold tabular-nums" data-testid="announcement-countdown">
            {remainingMs === null ? '--:--:--' : formatCountdown(remainingMs)}
          </span>
        </>
      ) : null}
    </span>
  );
}
