import type { Contribution } from '../lib/api';

export function ModelBars({ items }: { items: Contribution[] }) {
  const ordered = [...items].sort((a, b) => b.weight - a.weight);
  return (
    <div className="model-bars">
      {ordered.map((item) => (
        <div className="model-row" key={item.model} title={`${item.model}: ${Math.round(item.weight * 100)}% contribution`}>
          <div className="model-name">{item.model}</div>
          <div className="bar"><span style={{ width: `${Math.max(2, item.weight * 100)}%` }} /></div>
          <div className="model-pct">{Math.round(item.weight * 100)}%</div>
        </div>
      ))}
    </div>
  );
}
