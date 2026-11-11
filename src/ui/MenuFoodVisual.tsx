import { lazy, Suspense } from 'react';
import type { HoloLight } from '../scene/FoodInkEffect';
import type { MenuItem } from '../data/menu';

const MenuModelPreview = lazy(() => import('./MenuModelPreview'));

/** Every live catalog surface shares the same model and loading cache. */
export function MenuFoodVisual({ item, variant = 'thumbnail', onActivate, holo }: {
  item: MenuItem;
  variant?: 'thumbnail' | 'hero' | 'detail';
  onActivate?: () => void;
  holo?: HoloLight;
}) {
  const foodId = item.modelFoodId ?? item.foodId ?? (item.previewModelUrl ? item.id : undefined);
  if (!foodId) return <span className="ordering-preview-status" role="status">暂无3D模型</span>;
  return <Suspense fallback={<span className="ordering-preview-status" role="status">加载中…</span>}>
    <MenuModelPreview key={foodId} foodId={foodId} previewModelUrl={item.previewModelUrl} name={item.name} variant={variant} holo={holo}
      onActivate={onActivate} onClose={() => {}} showClose={false} />
  </Suspense>;
}
