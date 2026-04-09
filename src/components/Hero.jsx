import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import './Hero.css';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
};

export default function Hero() {
  return (
    <section className="hero">
      <div className="hero__bg">
        <div className="hero__dots" />
        {/* Floating cards */}
        <div className="hero__float hero__float--1">
          <span className="hero__float-icon">📄</span>
          <span className="hero__float-label">PDF Tools</span>
        </div>
        <div className="hero__float hero__float--2">
          <span className="hero__float-icon">🖼️</span>
          <span className="hero__float-label">Image Editor</span>
        </div>
        <div className="hero__float hero__float--3">
          <span className="hero__float-icon">{ }</span>
          <span className="hero__float-label">JSON Format</span>
        </div>
        <div className="hero__float hero__float--4">
          <span className="hero__float-icon">🤖</span>
          <span className="hero__float-label">AI Powered</span>
        </div>
      </div>

      <div className="hero__content container">
        <motion.div
          className="hero__badge"
          custom={0}
          initial="hidden"
          animate="visible"
          variants={fadeUp}
        >
          <span className="hero__badge-dot">✦</span>
          <span>50+ tools · Always Free</span>
        </motion.div>

        <motion.h1
          className="hero__title"
          custom={1}
          initial="hidden"
          animate="visible"
          variants={fadeUp}
        >
          Every Tool<br />
          You'll Ever Need
        </motion.h1>

        <motion.p
          className="hero__subtitle"
          custom={2}
          initial="hidden"
          animate="visible"
          variants={fadeUp}
        >
          A beautifully crafted collection of free online tools for PDF, images,
          text, code, and more — no signup, no limits.
        </motion.p>

        <motion.div
          className="hero__ctas"
          custom={3}
          initial="hidden"
          animate="visible"
          variants={fadeUp}
        >
          <a href="#tools" className="btn btn-primary hero__cta-primary">
            Browse Tools
            <ArrowRight size={16} />
          </a>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost"
          >
            View on GitHub
          </a>
        </motion.div>

        <motion.div
          className="hero__proof"
          custom={4}
          initial="hidden"
          animate="visible"
          variants={fadeUp}
        >
          <div className="hero__avatars">
            {['😊', '🎨', '💻', '🚀', '🔥'].map((emoji, i) => (
              <span key={i} className="hero__avatar" style={{ zIndex: 5 - i }}>
                {emoji}
              </span>
            ))}
          </div>
          <span className="hero__proof-text">
            Trusted by <strong>2M+</strong> users worldwide
          </span>
        </motion.div>
      </div>
    </section>
  );
}
