'use client';

import { useId, useState } from 'react';
import styles from './PieChart.module.css';

export type PieDatum = { label: string; value: number; detail?: string };

// Shared pastel palette; SVG fills bypass the application's legacy utility palette.
const palette = ['#A8C7E8', '#F4B8C4', '#B8DCC4', '#D1C2EB', '#F6D69B', '#A9D9D8', '#EBC4A7', '#C4CBEA'];
const colorAt = (index: number) => palette[index] || `hsl(${(index * 137.508) % 360} 52% 80%)`;
const percentage = (value: number) => `${(value * 100).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%`;

export default function PieChart({ title, data, formatValue = value => value.toLocaleString('vi-VN'), caption, emptyText = 'Chưa có dữ liệu' }: {
  title: string;
  data: PieDatum[];
  formatValue?: (value: number) => string;
  caption?: string;
  emptyText?: string;
}) {
  const id = useId();
  const [active, setActive] = useState<number | null>(null);
  const values = data.map(item => Number.isFinite(item.value) ? item.value : 0);
  const total = values.reduce((sum, value) => sum + Math.max(0, value), 0);
  const slices = data.map((item, index) => ({
    ...item,
    value: values[index],
    share: total > 0 ? Math.max(0, values[index]) / total : 0,
    start: total > 0 ? values.slice(0, index).reduce((sum, value) => sum + Math.max(0, value), 0) / total : 0,
    color: colorAt(index),
  }));

  return <figure className={styles.chart} aria-labelledby={id}>
    <figcaption id={id} className={styles.title}>{title}</figcaption>
    {caption && <p className={styles.caption}>{caption}</p>}
    <div className={styles.layout}>
      <svg viewBox="0 0 240 240" className={styles.disc} role="img" aria-label={`${title}: ${total > 0 ? 'xem số liệu và tỷ lệ trong chú giải' : emptyText}`}>
        {total === 0 ? <circle cx="120" cy="120" r="108" fill="#E3DFD6" /> : slices.map((slice, index) => {
          if (slice.share === 0) return null;
          const startAngle = slice.start * 2 * Math.PI - Math.PI / 2;
          const endAngle = startAngle + slice.share * 2 * Math.PI;
          const path = `M120,120 L${120 + 108 * Math.cos(startAngle)},${120 + 108 * Math.sin(startAngle)} A108,108 0 ${slice.share > .5 ? 1 : 0},1 ${120 + 108 * Math.cos(endAngle)},${120 + 108 * Math.sin(endAngle)} Z`;
          const props = {
            fill: slice.color,
            opacity: active === null || active === index ? 1 : .35,
            onMouseEnter: () => setActive(index),
            onMouseLeave: () => setActive(null),
          };
          const label = `${slice.label}: ${formatValue(slice.value)} (${percentage(slice.share)})`;
          return slice.share === 1
            ? <circle key={index} cx="120" cy="120" r="108" {...props}><title>{label}</title></circle>
            : <path key={index} d={path} stroke="#FAF7F0" strokeWidth="2" {...props}><title>{label}</title></path>;
        })}
      </svg>
      <div className={styles.legend}>
        {total === 0 && <p className={styles.caption} role="status">{emptyText}</p>}
        <ul aria-label={`Chú giải ${title}`}>{slices.map((slice, index) => <li key={index} onMouseEnter={() => setActive(index)} onMouseLeave={() => setActive(null)}>
          <span className={styles.swatch} style={{ backgroundColor: slice.color }} />
          <span className={styles.label}>{slice.label}{slice.detail && <small>{slice.detail}</small>}</span>
          <span className={styles.value}><b>{formatValue(slice.value)}</b><small>{slice.value < 0 ? 'Giá trị âm' : percentage(slice.share)}</small></span>
        </li>)}</ul>
        {values.some(value => value < 0) && <p className={styles.caption}>Giá trị âm được giữ trong chú giải và không tính vào tỷ trọng biểu đồ.</p>}
      </div>
    </div>
  </figure>;
}
