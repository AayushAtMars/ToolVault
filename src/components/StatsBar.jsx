import './StatsBar.css';

const stats = [
  { value: '50+', label: 'Tools' },
  { value: '100%', label: 'Free' },
  { value: 'No', label: 'Watermarks' },
  { value: 'No', label: 'Login' },
  { value: '2M+', label: 'Files Processed' },
];

export default function StatsBar() {
  return (
    <section className="stats" aria-label="Statistics">
      <div className="stats__inner container">
        {stats.map((stat, i) => (
          <div key={i} className="stats__item">
            <span className="stats__value">{stat.value}</span>
            <span className="stats__label">{stat.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
