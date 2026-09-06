import { Container } from '@/components/ui/container';
import { Skeleton } from '@/components/ui/skeleton';

export default function ShopLoading() {
  return (
    <Container className="py-12">
      <Skeleton className="mb-3 h-4 w-16" />
      <Skeleton className="mb-8 h-12 w-72" />
      <Skeleton className="mb-8 h-20 w-full rounded-2xl" />
      <div className="grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-3">
            <Skeleton className="aspect-[4/5] w-full rounded-2xl" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ))}
      </div>
    </Container>
  );
}
