export default function StarRating({ rating = 0, count, size = 'md' }) {
  const value = Number(rating) || 0;
  const rounded = Math.round(value * 2) / 2;
  return (
    <div className={`rating rating--${size}`} aria-label={`${value} out of 5 stars`}>
      <div className="rating__stars">
        {[1, 2, 3, 4, 5].map((star) => (
          <span key={star} className={`star ${rounded >= star ? 'star--filled' : ''}`} aria-hidden="true">
            ★
          </span>
        ))}
      </div>
      {count !== undefined && <span className="rating__count">({count})</span>}
    </div>
  );
}
