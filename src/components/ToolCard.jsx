import { useNavigate } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import './ToolCard.css';

export default function ToolCard({ tool, index }) {
  const navigate = useNavigate();
  const tagClass = tool.tags[0] ? `tag tag-${tool.tags[0]}` : '';

  return (
    <button
      className="tool-card"
      onClick={() => navigate(`/tool/${tool.id}`)}
      aria-label={`Open ${tool.name}`}
      style={{ animationDelay: `${(index % 12) * 40}ms` }}
    >
      <div className="tool-card__icon-wrap">
        <span className="tool-card__icon">{tool.icon}</span>
      </div>
      <div className="tool-card__info">
        <h3 className="tool-card__name">{tool.name}</h3>
        <p className="tool-card__desc">{tool.description}</p>
      </div>
      <div className="tool-card__bottom">
        {tool.tags[0] && (
          <span className={tagClass}>{tool.tags[0]}</span>
        )}
        <ArrowUpRight size={14} className="tool-card__arrow" aria-hidden="true" />
      </div>
    </button>
  );
}
