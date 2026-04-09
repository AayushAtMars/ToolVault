import { useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { tools } from '../data/tools';
import { categories } from '../data/tools';
import './ToolPage.css';

export default function ToolPage({ children }) {
  const { slug } = useParams();
  const tool = tools.find((t) => t.id === slug);

  if (!tool) {
    return (
      <div className="tool-page">
        <div className="tool-page__inner container">
          <div className="tool-page__empty">
            <h2>Tool not found</h2>
            <Link to="/" className="btn btn-ghost">← Back to Home</Link>
          </div>
        </div>
      </div>
    );
  }

  const cat = categories.find((c) => c.id === tool.category);

  return (
    <div className="tool-page">
      <div className="tool-page__inner container">
        <div className="tool-page__header">
          <Link to="/" className="tool-page__back" aria-label="Back to home">
            <ArrowLeft size={18} />
            <span>Back</span>
          </Link>
          <div className="tool-page__breadcrumb">
            <span className="tool-page__cat">{cat?.icon} {cat?.name}</span>
            <span className="tool-page__sep">/</span>
            <span className="tool-page__current">{tool.name}</span>
          </div>
        </div>

        <div className="tool-page__title-row">
          <span className="tool-page__icon">{tool.icon}</span>
          <div>
            <h1 className="tool-page__title">{tool.name}</h1>
            <p className="tool-page__desc">{tool.description}</p>
          </div>
          {tool.tags[0] && (
            <span className={`tag tag-${tool.tags[0]}`}>{tool.tags[0]}</span>
          )}
        </div>

        <div className="tool-page__content">
          {children}
        </div>

        <div className="tool-page__privacy">
          🔒 Your files are processed locally in your browser. Nothing is uploaded to any server.
        </div>
      </div>
    </div>
  );
}
