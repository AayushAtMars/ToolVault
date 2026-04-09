import './FeatureSection.css';

const features = [
  {
    icon: '🔒',
    color: '#16A34A',
    title: 'Privacy First',
    body: 'All files are processed in your browser. Nothing is uploaded to our servers — your data stays on your device.',
  },
  {
    icon: '⚡',
    color: '#2563EB',
    title: 'Instant Processing',
    body: 'No wait times, no queues. Every tool runs instantly using modern browser APIs for blazing-fast results.',
  },
  {
    icon: '💎',
    color: '#9333EA',
    title: 'Always Free',
    body: 'Every single tool is 100% free — no hidden fees, no premium tiers, no sign-up walls. Ever.',
  },
];

export default function FeatureSection() {
  return (
    <section className="features" aria-label="Why AayuTools">
      <div className="features__inner container">
        <h2 className="features__heading">Why AayuTools?</h2>
        <div className="features__grid">
          {features.map((f, i) => (
            <div key={i} className="features__card">
              <div
                className="features__icon"
                style={{ background: `${f.color}14`, color: f.color }}
              >
                {f.icon}
              </div>
              <h3 className="features__title">{f.title}</h3>
              <p className="features__body">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
