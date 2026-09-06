import { Container } from '@/components/ui/container';
import { Skeleton } from '@/components/ui/skeleton';

export default function MarketingLoading() {
  return (
    <Container className="py-16">
      <Skeleton className="mb-4 h-4 w-24" />
      <Skeleton className="mb-6 h-14 w-2/3" />
      <Skeleton className="h-6 w-1/2" />
    </Container>
  );
}
