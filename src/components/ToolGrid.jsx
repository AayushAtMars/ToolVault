import { categories } from '../data/tools';
import ToolCard from './ToolCard';
import './ToolGrid.css';

export default function ToolGrid({ tools }) {
  // Group tools by category
  const grouped = {};
  tools.forEach((tool) => {
    if (!grouped[tool.category]) grouped[tool.category] = [];
    grouped[tool.category].push(tool);
  });

  const sortedCategories = categories
    .filter((c) => c.id !== 'all' && grouped[c.id]?.length > 0);

  if (tools.length === 0) {
    return (
      <div className="tool-grid__empty container">
        <div className="tool-grid__empty-icon">🔍</div>
        <h3>No tools found</h3>
        <p>Try adjusting your search or filters.</p>
      </div>
    );
  }

  return (
    <div className="tool-grid container">
      {sortedCategories.map((cat) => (
        <section key={cat.id} className="tool-grid__section" id={cat.id}>
          <div className="tool-grid__header">
            <span className="tool-grid__header-icon">{cat.icon}</span>
            <span className="tool-grid__header-name">{cat.name}</span>
            <span className="tool-grid__header-line" />
            <span className="tool-grid__header-count">
              {grouped[cat.id].length} {grouped[cat.id].length === 1 ? 'tool' : 'tools'}
            </span>
          </div>
          <div className="tool-grid__mosaic">
            {grouped[cat.id].map((tool, i) => (
              <ToolCard key={tool.id} tool={tool} index={i} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
