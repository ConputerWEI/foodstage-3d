import { UtensilsCrossed } from 'lucide-react';

export function FoodMark({ className = '' }: { className?: string }) {
  return <UtensilsCrossed className={className} size={60} strokeWidth={1.8} style={{ height: 'auto' }} aria-hidden="true" />;
}
