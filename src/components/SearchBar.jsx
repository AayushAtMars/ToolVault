import { Search } from 'lucide-react';
import './SearchBar.css';

export default function SearchBar({ query, setQuery }) {
  return (
    <div className="search" id="tools">
      <div className="search__inner container">
        <div className="search__input-wrap">
          <Search size={18} className="search__icon" aria-hidden="true" />
          <input
            type="text"
            className="search__input"
            placeholder="Search 50+ tools..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search tools"
          />
          <kbd className="search__kbd" aria-hidden="true">⌘K</kbd>
        </div>
      </div>
    </div>
  );
}
