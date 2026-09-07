import type { TrackedEvent } from './events';

declare global {
  interface Window {
    cofresso?: { events: TrackedEvent[] };
    CFQ?: unknown[];
  }
}

export {};
