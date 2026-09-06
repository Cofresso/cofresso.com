// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_BUFFERED_EVENTS, track } from './track';

describe('track', () => {
  beforeEach(() => {
    delete window.cofresso;
  });

  it('buffers events on window and dispatches a DOM event', () => {
    const listener = vi.fn();
    window.addEventListener('cofresso:event', listener);
    track({ name: 'page_view', path: '/shop' });
    expect(window.cofresso?.events).toHaveLength(1);
    expect(window.cofresso?.events[0].event).toEqual({ name: 'page_view', path: '/shop' });
    expect(listener).toHaveBeenCalledTimes(1);
    const detail = (listener.mock.calls[0][0] as CustomEvent).detail;
    expect(detail.event.name).toBe('page_view');
    window.removeEventListener('cofresso:event', listener);
  });

  it('caps the buffer', () => {
    for (let i = 0; i < MAX_BUFFERED_EVENTS + 5; i++)
      track({ name: 'search', query: String(i), resultCount: 0 });
    expect(window.cofresso?.events).toHaveLength(MAX_BUFFERED_EVENTS);
    expect((window.cofresso?.events[0].event as { query: string }).query).toBe('5');
  });
});
