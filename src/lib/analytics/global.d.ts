import type { TrackedEvent } from './events';

declare global {
  interface Window {
    cofresso?: { events: TrackedEvent[] };
  }
}

export {};
