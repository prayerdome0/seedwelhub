import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function SearchBar({ placeholder = 'Search Seedwel Hub…', variant = 'regular', defaultValue = '' }) {
  const [query, setQuery] = useState(defaultValue || '');
  const navigate = useNavigate();

  const handleSubmit = (event) => {
    event.preventDefault();
    const q = query.trim();
    if (q) navigate(`/search?q=${encodeURIComponent(q)}`);
  };

  return (
    <form className={`search-bar search-bar--${variant}`} onSubmit={handleSubmit} role="search">
      <input
        type="search"
        className="search-bar__input"
        placeholder={placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search"
      />
      <button type="submit" className="search-bar__btn" aria-label="Search">
        <span className="search-bar__icon" aria-hidden="true">⌕</span>
      </button>
    </form>
  );
}
