import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import Spinner from '../components/Spinner';
import ProductCard from '../components/ProductCard';
import { EmptyState, ErrorState } from '../components/PageState';
import useAsync from '../hooks/useAsync';
import { getWishlistForUser, removeFromWishlist } from '../services/wishlistService';

// Saved / Favorites — the buyer's shortlist of products they want to come back
// to. Backed by the existing wishlist collection.
export default function SavedPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { data, loading, error, retry } = useAsync(
    () => (user ? getWishlistForUser(user.uid) : Promise.resolve([])),
    [user]
  );

  const handleRemove = async (item) => {
    try {
      await removeFromWishlist(user.uid, item.productId);
      showToast('Removed from saved items.', 'success');
      retry();
    } catch (err) {
      showToast(err.message || 'Could not remove the item.', 'error');
    }
  };

  if (!user) {
    return (
      <div className="container page">
        <EmptyState
          title="Sign in to view saved items"
          message="Log in to see everything you've saved."
          action={<Link to="/login" className="btn btn--primary">Log In</Link>}
        />
      </div>
    );
  }

  const items = data || [];

  return (
    <div className="container page">
      <div className="page__header">
        <h1 className="page__title">Saved &amp; Favorites</h1>
        <p className="page__subtitle">Products you've bookmarked to come back to.</p>
      </div>

      {loading && <Spinner size="large" />}
      {!loading && error && <ErrorState message={error} onRetry={retry} />}

      {!loading && !error && items.length === 0 && (
        <EmptyState
          title="Nothing saved yet"
          message="Tap the heart on any product to save it here."
          action={<Link to="/marketplace" className="btn btn--primary">Browse Marketplace</Link>}
        />
      )}

      {!loading && !error && items.length > 0 && (
        <div className="grid grid--4">
          {items.map((item) => (
            <div key={item.id} className="saved-item">
              <ProductCard product={{ ...(item.product || {}), id: item.productId }} />
              <button
                type="button"
                className="btn btn--outline btn--sm btn--block saved-item__remove"
                onClick={() => handleRemove(item)}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
