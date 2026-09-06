import { ButtonLink } from '@/components/ui/button';

export function EmptyCart({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div
      className="flex flex-col items-center gap-4 px-6 py-16 text-center"
      data-testid="empty-cart"
    >
      <p className="text-4xl">☕</p>
      <h3 className="text-2xl">Your cart is empty</h3>
      <p className="text-latte max-w-xs text-sm">
        Fresh roasts ship within 48 hours of roasting. Find your next favorite.
      </p>
      <ButtonLink href="/shop" onClick={onNavigate}>
        Shop coffee
      </ButtonLink>
    </div>
  );
}
