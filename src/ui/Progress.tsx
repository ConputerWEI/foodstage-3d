import type { FoodStage } from '../data/foods';

export function Progress({ stage, bites, stages }: { stage: number; bites: number; stages: readonly FoodStage[] }) {
  const total = stages.reduce((sum, item) => sum + item.bites, 0);
  const eaten = stages.slice(0, stage).reduce((sum, item) => sum + item.bites, 0) + bites;
  const percent = total ? Math.max(0, Math.min(100, Math.round(eaten / total * 100))) : 0;
  return <div className="progress" role="progressbar" aria-label="品尝进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-valuetext={`${percent}%`}>
    <span className="progress-count" aria-hidden="true">{percent}%</span>
    <span className="progress-track" aria-hidden="true"><span style={{ width: `${percent}%` }} /></span>
  </div>;
}
