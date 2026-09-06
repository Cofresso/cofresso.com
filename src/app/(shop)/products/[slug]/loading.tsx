import { Container } from '@/components/ui/container';
import { Skeleton } from '@/components/ui/skeleton';

export default function ProductLoading() {
  return (
    <Container className="py-10">
      <Skeleton className="mb-6 h-4 w-48" />
      <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
        <Skeleton className="aspect-[4/5] w-full rounded-3xl" />
        <div className="flex flex-col gap-6">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-12 w-3/4" />
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-12 w-full rounded-full" />
        </div>
      </div>
    </Container>
  );
}
