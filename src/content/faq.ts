export interface FaqItem {
  question: string;
  answer: string;
}

export const faqItems: FaqItem[] = [
  {
    question: 'When do you roast and ship?',
    answer:
      'We roast Monday through Thursday and ship every order within 48 hours of roasting. Most US orders arrive in 2 to 4 business days.',
  },
  {
    question: 'How does Subscribe & Save work?',
    answer:
      'Choose a delivery interval of 2, 4 or 6 weeks on any coffee and save 15% on every bag. You can pause, skip or cancel at any time from the link in your confirmation email.',
  },
  {
    question: 'Do you offer free shipping?',
    answer:
      'Yes. Orders over $45 after discounts ship free in the US. Everything else ships for a flat $6.',
  },
  {
    question: 'Whole bean or ground?',
    answer:
      'We recommend whole bean for freshness, but we will grind to order for drip, espresso, French press or pour over at no charge.',
  },
  {
    question: 'How should I store my coffee?',
    answer:
      'Keep the bag sealed in a cool, dark cupboard. Do not refrigerate. Coffee is best from 5 to 30 days after the roast date printed on the bag.',
  },
  {
    question: 'Can I return coffee?',
    answer:
      'If a bag is not right for you, email hello@cofresso.com within 30 days and we will replace it or refund you. Equipment can be returned unused within 30 days.',
  },
  {
    question: 'Is this a real store?',
    answer:
      'Cofresso is a fully working demo storefront used by Coframe to test tooling. Orders are simulated and no cards are ever charged.',
  },
];
