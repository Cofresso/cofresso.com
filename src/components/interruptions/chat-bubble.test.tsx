import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { ChatBubble } from './chat-bubble';
import { InterruptionStateProvider } from './state';

function renderChat() {
  return render(
    <InterruptionStateProvider>
      <ChatBubble />
    </InterruptionStateProvider>,
  );
}

describe('ChatBubble', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    delete window.cofresso;
  });

  it('opens the panel and moves focus into it', async () => {
    const user = userEvent.setup();
    renderChat();
    await user.click(screen.getByTestId('chat-bubble'));
    const panel = screen.getByTestId('chat-panel');
    expect(panel).toHaveAttribute('role', 'dialog');
    await waitFor(() => expect(panel).toHaveFocus());
  });

  it('restores focus to the bubble when closed from the close button', async () => {
    const user = userEvent.setup();
    renderChat();
    const bubble = screen.getByTestId('chat-bubble');
    await user.click(bubble);
    await waitFor(() => expect(screen.getByTestId('chat-panel')).toHaveFocus());

    await user.click(screen.getByRole('button', { name: 'Close chat' }));
    expect(screen.queryByTestId('chat-panel')).toBeNull();
    await waitFor(() => expect(bubble).toHaveFocus());
  });

  it('restores focus to the bubble when closed with Escape', async () => {
    const user = userEvent.setup();
    renderChat();
    const bubble = screen.getByTestId('chat-bubble');
    await user.click(bubble);
    await waitFor(() => expect(screen.getByTestId('chat-panel')).toHaveFocus());

    await user.keyboard('{Escape}');
    expect(screen.queryByTestId('chat-panel')).toBeNull();
    await waitFor(() => expect(bubble).toHaveFocus());
  });

  it('answers a quick reply once the typing indicator has run', async () => {
    const user = userEvent.setup();
    renderChat();
    await user.click(screen.getByTestId('chat-bubble'));
    expect(screen.getAllByTestId('chat-message')).toHaveLength(1);

    await user.click(screen.getByTestId('chat-reply-1'));
    expect(screen.getAllByTestId('chat-message')).toHaveLength(2);
    expect(screen.getByTestId('chat-typing')).toBeInTheDocument();

    await waitFor(() => expect(screen.getAllByTestId('chat-message')).toHaveLength(3));
    expect(screen.queryByTestId('chat-typing')).toBeNull();
    expect(screen.getAllByTestId('chat-message')[2]).toHaveTextContent('Dark Mode Espresso');
  });

  it('reports the opening to analytics and remembers it for the session', async () => {
    const user = userEvent.setup();
    renderChat();
    await user.click(screen.getByTestId('chat-bubble'));
    expect(window.cofresso?.events.map((e) => e.event)).toEqual([{ name: 'chat_opened' }]);
    expect(window.sessionStorage.getItem('cofresso:chat')).toContain('"opened":true');
  });
});
