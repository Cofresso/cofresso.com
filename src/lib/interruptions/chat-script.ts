/**
 * The canned live-chat script. Three quick replies, three answers, no backend — the point is
 * the interruption, not the conversation.
 */
export interface ChatQuickReply {
  id: string;
  label: string;
  answer: string;
}

export const chatGreeting =
  'Hi! Rae from the roastery here. Ask away — I answer fast, if predictably.';

export const chatQuickReplies: readonly ChatQuickReply[] = [
  {
    id: 'espresso',
    label: 'Which coffee for espresso?',
    answer:
      'Dark Mode Espresso is built for the machine — chocolate and dried fig, forgiving on the grind. Morning Frame pulls beautifully too if you like it brighter.',
  },
  {
    id: 'order-status',
    label: 'Where is my order?',
    answer:
      'Pop your order number and email into the order lookup at /orders and it will show you the latest status. Roasted-to-order bags ship within two business days.',
  },
  {
    id: 'shipping',
    label: 'How fast is shipping?',
    answer:
      'Standard shipping is $6 and lands in 2-5 business days, free over $45. We roast Monday to Thursday and ship the same afternoon.',
  },
] as const;

export const chatFallback =
  'I only know three things, and you have found the edges of all of them. Email hello@cofresso.com and a human will pick it up.';
