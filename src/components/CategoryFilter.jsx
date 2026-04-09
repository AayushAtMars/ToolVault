import { categories } from '../data/tools';
import './CategoryFilter.css';

export default function CategoryFilter({ active, setActive }) {
  return (
    <div className="filters container">
      <div className="filters__scroll">
        {categories.map((cat) => (
          <button
            key={cat.id}
            className={`filters__pill ${active === cat.id ? 'filters__pill--active' : ''}`}
            onClick={() => setActive(cat.id)}
            aria-pressed={active === cat.id}
          >
            {cat.name}
          </button>
        ))}
      </div>
    </div>
  );
}
