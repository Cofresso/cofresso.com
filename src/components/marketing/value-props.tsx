import { Container } from '@/components/ui/container';
import { IconCheck, IconLeaf, IconTruck } from '@/components/ui/icons';

const props = [
  {
    icon: IconTruck,
    title: 'Roasted, then shipped',
    body: 'Every bag leaves within 48 hours of roasting with the roast date printed on it.',
  },
  {
    icon: IconLeaf,
    title: 'Traceable to the farm',
    body: 'Producer, altitude and process on every single origin. No mystery blends.',
  },
  {
    icon: IconCheck,
    title: 'Ground to order',
    body: 'Whole bean, drip, espresso, French press or pour over. Same price.',
  },
];

export function ValueProps() {
  return (
    <section className="border-latte/20 bg-foam border-b">
      <Container className="grid gap-8 py-10 sm:grid-cols-3">
        {props.map(({ icon: Icon, title, body }) => (
          <div key={title} className="flex gap-4">
            <span className="bg-copper/10 text-copper flex size-10 shrink-0 items-center justify-center rounded-full">
              <Icon />
            </span>
            <div>
              <h3 className="font-body text-sm font-semibold">{title}</h3>
              <p className="text-latte mt-1 text-sm">{body}</p>
            </div>
          </div>
        ))}
      </Container>
    </section>
  );
}
