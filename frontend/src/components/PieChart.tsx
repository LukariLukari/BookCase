'use client';

import { useId, useState } from 'react';

export type PieDatum = { label: string; value: number; color?: string; detail?: string };
const colors = ['#16587b', '#e67e45', '#6d9479', '#b18bc2', '#d6ac55', '#71aeb2', '#9b705c', '#8d9cc8'];

/** Values in a chart must share a unit. Negative values remain visible in the legend. */
export default function PieChart({ title, data, formatValue = value => value.toLocaleString('vi-VN'), emptyText = 'Chưa có dữ liệu', caption }: {
  title: string;
  data: PieDatum[];
  formatValue?: (value: number) => string;
  emptyText?: string;
  caption?: string;
}) {
  const id = useId();
  const [active, setActive] = useState<number | null>(null);
  const values = data.map(item => Number.isFinite(item.value) ? item.value : 0);
  const total = values.reduce((sum, value) => sum + Math.max(0, value), 0);
  const slices = data.map((item, index) => {
    const share = total > 0 ? Math.max(0, values[index]) / total : 0;
    const start = total > 0 ? values.slice(0, index).reduce((sum, value) => sum + Math.max(0, value), 0) / total : 0;
    return { ...item, value: values[index], share, start, color: item.color || colors[index % colors.length] };
  });
  return <figure className="pie-chart" aria-labelledby={id}>
    <figcaption id={id} className="pie-chart-title">{title}</figcaption>
    {caption && <p className="pie-chart-caption">{caption}</p>}
    <div className="pie-chart-layout">
      <svg className="pie-chart-disc" viewBox="0 0 240 240" role="img" aria-label={`${title}${total > 0 ? '' : `: ${emptyText}`}`}>
        {total === 0 ? <circle cx="120" cy="120" r="108" fill="#dcd8ce" /> : slices.map((slice, index) => {
          if (!slice.share) return null;
          const angle = (slice.start * 2 * Math.PI) - Math.PI / 2;
          const end = angle + slice.share * 2 * Math.PI;
          const path = `M120,120 L${120 + 108 * Math.cos(angle)},${120 + 108 * Math.sin(angle)} A108,108 0 ${slice.share > .5 ? 1 : 0},1 ${120 + 108 * Math.cos(end)},${120 + 108 * Math.sin(end)} Z`;
          const props = { fill: slice.color, opacity: active === null || active === index ? 1 : .35, onMouseEnter: () => setActive(index), onMouseLeave: () => setActive(null) };
          const label = `${slice.label}: ${formatValue(slice.value)} (${(slice.share * 100).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%)`;
          return slice.share === 1 ? <circle key={index} cx="120" cy="120" r="108" {...props}><title>{label}</title></circle> : <path key={index} d={path} stroke="var(--background)" strokeWidth="2" {...props}><title>{label}</title></path>;
        })}
      </svg>
      <div className="pie-chart-key">
        {total === 0 && <p className="pie-chart-caption" role="status">{emptyText}</p>}
        <ul aria-label={`Chú giải ${title}`}>{slices.map((slice, index) => <li key={index} onMouseEnter={() => setActive(index)} onMouseLeave={() => setActive(null)}>
          <span className="pie-chart-swatch" style={{ backgroundColor: slice.color }} />
          <span className="pie-chart-label">{slice.label}{slice.detail && <small>{slice.detail}</small>}</span>
          <span className="pie-chart-value"><b>{formatValue(slice.value)}</b><small>{slice.value < 0 ? 'Giá trị âm' : `${(slice.share * 100).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%`}</small></span>
        </li>)}</ul>
        {values.some(value => value < 0) && <p className="pie-chart-caption">Giá trị âm được giữ trong chú giải và không tính vào tỷ trọng biểu đồ.</p>}
      </div>
    </div>
  </figure>;
}
