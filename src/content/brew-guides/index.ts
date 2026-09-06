export interface BrewGuide {
  slug: string;
  title: string;
  summary: string;
  method: string;
  ratio: string;
  grind: string;
  waterTempC: number;
  totalTime: string;
  steps: string[];
  tips: string[];
  recommendedSlugs: string[];
}

export const brewGuides: BrewGuide[] = [
  {
    slug: 'pour-over',
    title: 'Pour Over (V60 / Cofresso Dripper)',
    summary: 'Clean, bright and expressive. The best way to taste what a single origin is doing.',
    method: 'Pour over',
    ratio: '1:16 (22 g coffee to 350 g water)',
    grind: 'Medium-fine, like table salt',
    waterTempC: 94,
    totalTime: '3:00 – 3:30',
    steps: [
      'Rinse the filter with hot water and discard the rinse water.',
      'Add 22 g of coffee and level the bed. Start your timer as you begin pouring.',
      'Bloom with 60 g of water in a spiral. Wait 40 seconds while it degasses.',
      'Pour to 200 g in slow circles by 1:15, keeping the water level steady.',
      'Pour to 350 g by 2:00. Give the dripper a gentle swirl to flatten the bed.',
      'Drawdown should finish between 3:00 and 3:30. Adjust grind finer if faster, coarser if slower.',
    ],
    tips: [
      'Weigh everything. Ratio drift is the number one cause of inconsistent cups.',
      'Ethiopian and Kenyan coffees shine here. Try the Yirgacheffe.',
    ],
    recommendedSlugs: ['ethiopia-yirgacheffe', 'kenya-nyeri', 'costa-rica-tarrazu'],
  },
  {
    slug: 'french-press',
    title: 'French Press',
    summary: 'Full-bodied and forgiving. Great for blends and darker roasts.',
    method: 'Immersion',
    ratio: '1:15 (30 g coffee to 450 g water)',
    grind: 'Coarse, like sea salt',
    waterTempC: 93,
    totalTime: '4:00 + 4:00 settle',
    steps: [
      'Preheat the press with hot water, then discard it.',
      'Add 30 g of coarse coffee and pour 450 g of water over it. Start the timer.',
      'At 4:00, stir the crust gently and scoop off the foam and floating grounds.',
      'Wait another 4 minutes without plunging. Fines settle and the cup gets cleaner.',
      'Press the plunger just below the surface and pour immediately.',
    ],
    tips: [
      'Skip the hard plunge. Pressing to the bottom stirs up sediment.',
      'Morning Frame and Sumatra Mandheling are built for this.',
    ],
    recommendedSlugs: ['morning-frame', 'sumatra-mandheling', 'brazil-cerrado'],
  },
  {
    slug: 'espresso',
    title: 'Espresso',
    summary: 'Concentrated and syrupy. Dial in with a scale and a timer, not vibes.',
    method: 'Pressure',
    ratio: '1:2 (18 g in, 36 g out)',
    grind: 'Fine, like powdered sugar with a little grit',
    waterTempC: 93,
    totalTime: '25 – 32 seconds',
    steps: [
      'Dose 18 g into a clean, dry portafilter basket.',
      'Distribute evenly and tamp level with firm, consistent pressure.',
      'Lock in and start the shot immediately. Aim for first drips around 6 to 8 seconds.',
      'Stop at 36 g of liquid in the cup. Note the time.',
      'Under 25 seconds and sour? Grind finer. Over 32 seconds and bitter? Grind coarser.',
    ],
    tips: [
      'Change one variable at a time.',
      'Dark Mode Espresso is designed for this ratio and will forgive a lot.',
    ],
    recommendedSlugs: ['dark-mode-espresso', 'guatemala-antigua', 'costa-rica-tarrazu'],
  },
  {
    slug: 'cold-brew',
    title: 'Cold Brew',
    summary: 'Low acidity, huge sweetness, and it keeps in the fridge for a week.',
    method: 'Cold immersion',
    ratio: '1:8 concentrate (100 g coffee to 800 g water), dilute 1:1 to serve',
    grind: 'Extra coarse',
    waterTempC: 20,
    totalTime: '16 hours',
    steps: [
      'Combine 100 g of extra-coarse coffee with 800 g of cold filtered water in a jar.',
      'Stir until every ground is wet. Cover.',
      'Steep in the fridge for 14 to 18 hours.',
      'Strain through a paper filter or a fine sieve lined with a filter.',
      'Dilute with equal parts water or milk over ice. Keeps for 7 days refrigerated.',
    ],
    tips: [
      'Hot Reload is blended specifically for this recipe.',
      'Too strong? Dilute more. Too weak? Steep longer next time, not finer.',
    ],
    recommendedSlugs: ['hot-reload-cold-brew', 'brazil-cerrado', 'peru-cajamarca'],
  },
];
