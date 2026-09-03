import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import Button from './Button';
import Avatar from './Avatar';
import StarRating from './StarRating';
import { createReview, updateReview } from '../services/reviewService';
import { relativeTime, timestampMillis } from '../utils/format';

// Interactive star picker (1–5) used by the review form.
function StarPicker({ value, onChange, disabled = false }) {
  const [hover, setHover] = useState(0);
  const active = hover || value;
  return (
    <div
      className="star-picker"
      role="radiogroup"
      aria-label="Rating"
      onMouseLeave={() => setHover(0)}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className={`star-picker__star ${active >= star ? 'is-active' : ''}`}
          onClick={() => onChange(star)}
          onMouseEnter={() => setHover(star)}
          disabled={disabled}
          aria-label={`${star} star${star === 1 ? '' : 's'}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

// Reviews list + submit/edit form for a business profile.
export default function ReviewsSection({ businessId, reviews = [], onChanged }) {
  const { user, profile } = useAuth();
  const { showToast } = useToast();

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  // The signed-in user's existing review (so they can edit it instead of
  // posting a duplicate).
  const myReview = useMemo(
    () => (user ? reviews.find((r) => r.authorId === user.uid) : null),
    [reviews, user]
  );

  const startEdit = (review) => {
    setEditingId(review.id);
    setRating(Number(review.rating) || 0);
    setComment(review.comment || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => {
    setEditingId(null);
    setRating(0);
    setComment('');
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!user) {
      showToast('Please log in to leave a review.', 'info');
      return;
    }
    if (!rating) {
      showToast('Please choose a star rating.', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        businessId,
        productId: null,
        authorId: user.uid,
        rating,
        comment: comment.trim(),
        authorName: profile?.name || user.displayName || 'Customer',
        authorPhoto: profile?.photoURL || user.photoURL || '',
      };
      // If the signed-in user already reviewed this business, update their
      // existing review instead of posting a duplicate.
      const targetId = editingId || myReview?.id || null;
      if (targetId) {
        await updateReview(targetId, { rating, comment: comment.trim() });
        showToast('Your review was updated.', 'success');
      } else {
        await createReview(payload);
        showToast('Thanks! Your review has been posted.', 'success');
      }
      resetForm();
      if (onChanged) onChanged();
    } catch (err) {
      showToast(err.message || 'Could not post your review. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const sorted = [...reviews].sort((a, b) => timestampMillis(b.createdAt) - timestampMillis(a.createdAt));

  return (
    <div>
      {/* Review form */}
      <div className="panel review-form-panel">
        <h2 className="panel__title">
          {editingId ? 'Edit your review' : myReview ? 'Update your review' : 'Leave a review'}
        </h2>
        {!user ? (
          <p className="text-muted">
            <Link to="/login" className="table__link">Log in</Link> to share your experience with this
            business.
          </p>
        ) : (
          <form onSubmit={submit}>
            <div className="form__group">
              <label className="form__label">Your rating</label>
              <div className="flex items-center gap-8">
                <StarPicker value={rating} onChange={setRating} disabled={saving} />
                {rating > 0 && <span className="text-muted">{rating} / 5</span>}
              </div>
            </div>
            <div className="form__group mt-16">
              <label className="form__label" htmlFor="review-comment">Your review</label>
              <textarea
                id="review-comment"
                className="form__textarea"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="How was your experience with this business?"
                disabled={saving}
              />
            </div>
            <div className="dash-actions">
              <Button type="submit" variant="primary" loading={saving}>
                {editingId ? 'Save changes' : myReview ? 'Post updated review' : 'Post review'}
              </Button>
              {(editingId || myReview) && (
                <Button type="button" variant="ghost" onClick={resetForm}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        )}
      </div>

      {/* Existing reviews */}
      {sorted.length === 0 ? (
        <p className="text-muted mt-16">No reviews yet — be the first to share your experience.</p>
      ) : (
        <div className="stack mt-16">
          {sorted.map((r) => (
            <div key={r.id} className="review-item">
              <div className="review-item__head">
                <Avatar src={r.authorPhoto} name={r.authorName || 'Customer'} size="sm" />
                <div className="review-item__meta">
                  <strong>{r.authorName || 'Customer'}</strong>
                  <span className="text-muted">{relativeTime(r.createdAt)}</span>
                </div>
                {user && r.authorId === user.uid && (
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm review-item__edit"
                    onClick={() => startEdit(r)}
                  >
                    Edit
                  </button>
                )}
              </div>
              <div className="review-item__rating">
                <StarRating rating={r.rating} />
              </div>
              {r.comment && <p className="review-item__comment">{r.comment}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
