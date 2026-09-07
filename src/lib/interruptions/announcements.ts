/**
 * The announcement bar rotates through these. Index 0 is what the server renders and what the
 * bar shows with `UX_INTERRUPTIONS=off`, so it has to stand on its own.
 */
export interface Announcement {
  id: string;
  text: string;
  /** Append the live countdown to local midnight. */
  countdown?: boolean;
}

export const announcements: readonly Announcement[] = [
  { id: 'shipping', text: 'Free shipping on orders over $45 · Subscribe & save 15%' },
  { id: 'drop', text: "Today's roast drop ends in", countdown: true },
  { id: 'fresh', text: 'New single origins land every Friday · Roasted to order, never sooner' },
] as const;
