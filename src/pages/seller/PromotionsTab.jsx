import { useMemo, useState } from 'react';
import Button from '../../components/Button';
import Spinner from '../../components/Spinner';
import PromoCountdown from '../../components/PromoCountdown';
import { EmptyState, ErrorState } from '../../components/PageState';
import useAsync from '../../hooks/useAsync';
import { useToast } from '../../contexts/ToastContext';
import { getProductsByBusiness } from '../../services/productService';
import {
  getPromotionsByBusiness,
  createPromotion,
  updatePromotion,
  setPromotionEnabled,
  deletePromotion,
  createBanner,
  getBannersByBusiness,
  deleteBanner,
} from '../../services/promotionService';
import { uploadImageToCloudinary } from '../../cloudinary/upload';
import { formatCurrency, formatDateTime } from '../../utils/format';
import {
  PROMOTION_TYPES,
  PROMOTION_STATUS,
  DISCOUNT_TIERS,
  computePricing,
  validatePromotion,
  combineDateTime,
  splitDateTime,
} from '../../utils/promotions';

function emptyForm(currency = 'UGX') {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const week = new Date(now.getTime() + 7 * 86400000);
  const later = `${week.getFullYear()}-${pad(week.getMonth() + 1)}-${pad(week.getDate())}`;
  return {
    title: '',
    description: '',
    productIds: [],
    type: PROMOTION_TYPES.PERCENTAGE,
    percent: '10',
    newPrice: '',
    originalPrice: '',
    currency,
    image: '',
    startDate: today,
    startTime: '08:00',
    endDate: later,
    endTime: '20:00',
    enabled: true,
    // Banner (optional) — published alongside the promotion.
    bannerEnabled: false,
    bannerHeadline: '',
    bannerSubline: '',
    bannerImage: '',
  };
}

const STATUS_TONE = {
  [PROMOTION_STATUS.ACTIVE]: 'success',
  [PROMOTION_STATUS.SCHEDULED]: 'info',
  [PROMOTION_STATUS.EXPIRED]: 'muted',
  [PROMOTION_STATUS.DRAFT]: 'muted',
};

/**
 * Seller "Create Promotion" workspace.
 *
 * The form only ever *proposes* a promotion: `promotionService` re-validates
 * the pricing and the schedule before writing, and re-derives them again on
 * every read, so what a shopper is charged never depends on what this form
 * put in the document.
 */
export default function PromotionsTab({ user, business }) {
  const { showToast } = useToast();
  const currency = business?.currency || 'UGX';

  const products = useAsync(() => getProductsByBusiness(business?.id), [business?.id]);
  const promotions = useAsync(() => getPromotionsByBusiness(business?.id), [business?.id]);
  const banners = useAsync(() => getBannersByBusiness(business?.id), [business?.id]);

  const [form, setForm] = useState(() => emptyForm(currency));
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const set = (key) => (event) =>
    setForm((prev) => ({ ...prev, [key]: event?.target?.value ?? event }));

  const productList = products.data || [];

  // The "Original price" defaults to the chosen product's list price so the
  // seller does not have to retype it (and cannot accidentally inflate it).
  const selectedProducts = productList.filter((p) => form.productIds.includes(p.id));
  const impliedOriginal = selectedProducts.length
    ? Math.max(...selectedProducts.map((p) => Number(p.price) || 0))
    : 0;
  const originalPrice = Number(form.originalPrice) || impliedOriginal;

  // Live preview — the exact same computation the backend service performs.
  const preview = useMemo(
    () =>
      computePricing({
        originalPrice,
        type: form.type,
        value: form.type === PROMOTION_TYPES.FIXED_PRICE ? form.newPrice : form.percent,
      }),
    [originalPrice, form.type, form.newPrice, form.percent]
  );

  const startAt = combineDateTime(form.startDate, form.startTime);
  const endAt = combineDateTime(form.endDate, form.endTime);

  const problems = validatePromotion({
    title: form.title,
    productIds: form.productIds,
    originalPrice,
    type: form.type,
    value: form.type === PROMOTION_TYPES.FIXED_PRICE ? form.newPrice : form.percent,
    startAt,
    endAt,
  });

  const toggleProduct = (id) =>
    setForm((prev) => ({
      ...prev,
      productIds: prev.productIds.includes(id)
        ? prev.productIds.filter((p) => p !== id)
        : [...prev.productIds, id],
    }));

  const uploadTo = (key) => async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!/^image\//.test(file.type)) {
      showToast('Please choose an image file.', 'error');
      return;
    }
    setUploading(true);
    try {
      const result = await uploadImageToCloudinary(file);
      setForm((prev) => ({ ...prev, [key]: result.secureUrl }));
    } catch (err) {
      showToast(err.message || 'Upload failed. Please try again.', 'error');
    } finally {
      setUploading(false);
    }
  };

  const reset = () => {
    setForm(emptyForm(currency));
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (promo) => {
    const start = splitDateTime(promo.startAt);
    const end = splitDateTime(promo.endAt);
    setForm({
      ...emptyForm(currency),
      title: promo.title || '',
      description: promo.description || '',
      productIds: promo.productIds || [],
      type: promo.type || PROMOTION_TYPES.PERCENTAGE,
      percent: String(promo.discountPercent ?? '10'),
      newPrice: String(promo.promoPrice ?? ''),
      originalPrice: String(promo.originalPrice ?? ''),
      image: promo.image || '',
      startDate: start.date,
      startTime: start.time,
      endDate: end.date,
      endTime: end.time,
      enabled: promo.enabled !== false,
    });
    setEditingId(promo.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!business) return;
    if (problems.length) {
      showToast(problems[0], 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        businessId: business.id,
        businessName: business.name,
        title: form.title,
        description: form.description,
        productIds: form.productIds,
        productNames: selectedProducts.map((p) => p.name),
        type: form.type,
        originalPrice,
        value: form.type === PROMOTION_TYPES.FIXED_PRICE ? form.newPrice : form.percent,
        currency,
        image: form.image,
        startAt,
        endAt,
        enabled: form.enabled,
      };

      if (editingId) {
        await updatePromotion(editingId, payload);
        showToast('Promotion updated.', 'success');
      } else {
        const promo = await createPromotion(user.uid, payload);
        // An optional homepage banner rides the promotion's own schedule, so
        // it appears and disappears with the campaign.
        if (form.bannerEnabled) {
          await createBanner(user.uid, {
            businessId: business.id,
            businessName: business.name,
            headline: form.bannerHeadline || form.title,
            subline: form.bannerSubline || `Up to ${preview?.discountPercent || 0}% OFF`,
            image: form.bannerImage || form.image,
            discountPercent: preview?.discountPercent || 0,
            productIds: form.productIds,
            promotionId: promo?.id || null,
            startAt,
            endAt,
            enabled: true,
          });
          banners.retry();
        }
        showToast('Promotion published — it goes live at the scheduled time.', 'success');
      }
      reset();
      promotions.retry();
    } catch (err) {
      showToast(err.message || 'Could not save the promotion.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async (promo) => {
    try {
      await setPromotionEnabled(promo.id, promo.enabled === false);
      promotions.retry();
    } catch (err) {
      showToast(err.message || 'Could not update the promotion.', 'error');
    }
  };

  const remove = async (promo) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Delete the promotion "${promo.title}"?`)) return;
    try {
      await deletePromotion(promo.id);
      showToast('Promotion deleted.', 'success');
      promotions.retry();
    } catch (err) {
      showToast(err.message || 'Could not delete the promotion.', 'error');
    }
  };

  const removeBanner = async (banner) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm('Delete this banner?')) return;
    try {
      await deleteBanner(banner.id);
      banners.retry();
    } catch (err) {
      showToast(err.message || 'Could not delete the banner.', 'error');
    }
  };

  const list = promotions.data || [];

  return (
    <>
      <div className="panel dash-toolbar">
        <div>
          <h2 className="panel__title">Promotions</h2>
          <p className="text-muted">
            Schedule a discount and Seedwel Hub starts it, counts it down and stops it for you.
          </p>
        </div>
        <Button variant={showForm ? 'ghost' : 'primary'} onClick={() => (showForm ? reset() : setShowForm(true))}>
          {showForm ? 'Cancel' : '+ Create promotion'}
        </Button>
      </div>

      {showForm && (
        <form className="panel mt-16" onSubmit={submit}>
          <h3 className="panel__title">{editingId ? 'Edit promotion' : 'Create promotion'}</h3>

          <div className="form__group">
            <label className="form__label" htmlFor="promo-title">Promotion title *</label>
            <input
              id="promo-title"
              className="form__input"
              value={form.title}
              onChange={set('title')}
              placeholder="e.g. Weekend Sale"
            />
          </div>

          {/* Products ------------------------------------------------------ */}
          <div className="form__group">
            <label className="form__label">Products in this promotion *</label>
            {products.loading && <Spinner size="sm" />}
            {!products.loading && !productList.length && (
              <p className="text-muted">List a product first — then you can put it on promotion.</p>
            )}
            {productList.length > 0 && (
              <div className="promo-picker">
                {productList.map((p) => (
                  <label key={p.id} className={`promo-picker__item ${form.productIds.includes(p.id) ? 'is-selected' : ''}`}>
                    <input
                      type="checkbox"
                      checked={form.productIds.includes(p.id)}
                      onChange={() => toggleProduct(p.id)}
                    />
                    <span className="promo-picker__name">{p.name}</span>
                    <span className="promo-picker__price">{formatCurrency(p.price, p.currency || currency)}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Pricing ------------------------------------------------------- */}
          <div className="form__row">
            <div className="form__group">
              <label className="form__label" htmlFor="promo-type">Promotion type</label>
              <select id="promo-type" className="form__select" value={form.type} onChange={set('type')}>
                <option value={PROMOTION_TYPES.PERCENTAGE}>Percentage off</option>
                <option value={PROMOTION_TYPES.FIXED_PRICE}>New price</option>
              </select>
            </div>
            <div className="form__group">
              <label className="form__label" htmlFor="promo-original">
                Original price ({currency})
              </label>
              <input
                id="promo-original"
                type="number"
                min="0"
                className="form__input"
                value={form.originalPrice}
                onChange={set('originalPrice')}
                placeholder={impliedOriginal ? String(impliedOriginal) : '0'}
              />
              {!form.originalPrice && impliedOriginal > 0 && (
                <span className="form__hint">Using the product price: {formatCurrency(impliedOriginal, currency)}</span>
              )}
            </div>
          </div>

          {form.type === PROMOTION_TYPES.PERCENTAGE ? (
            <div className="form__group">
              <label className="form__label" htmlFor="promo-percent">Discount %</label>
              <div className="promo-tiers">
                {DISCOUNT_TIERS.map((tier) => (
                  <button
                    key={tier}
                    type="button"
                    className={`chip ${Number(form.percent) === tier ? 'active' : ''}`}
                    onClick={() => setForm((prev) => ({ ...prev, percent: String(tier) }))}
                  >
                    {tier}%
                  </button>
                ))}
              </div>
              <input
                id="promo-percent"
                type="number"
                min="1"
                max="90"
                className="form__input mt-8"
                value={form.percent}
                onChange={set('percent')}
              />
            </div>
          ) : (
            <div className="form__group">
              <label className="form__label" htmlFor="promo-new-price">Promotional price ({currency})</label>
              <input
                id="promo-new-price"
                type="number"
                min="0"
                className="form__input"
                value={form.newPrice}
                onChange={set('newPrice')}
                placeholder="0"
              />
            </div>
          )}

          {/* Live preview — exactly what the shopper will see */}
          <div className="promo-preview">
            <h4 className="promo-preview__title">Preview</h4>
            {preview ? (
              <div className="promo-preview__grid">
                <div><span className="text-muted">Was</span><s>{formatCurrency(preview.originalPrice, currency)}</s></div>
                <div><span className="text-muted">Now</span><strong>{formatCurrency(preview.promoPrice, currency)}</strong></div>
                <div><span className="text-muted">Save</span><strong>{formatCurrency(preview.savings, currency)}</strong></div>
                <div><span className="text-muted">Discount</span><strong>{preview.discountPercent}%</strong></div>
              </div>
            ) : (
              <p className="text-muted">
                Enter an original price and a discount that actually lowers it to see the preview.
              </p>
            )}
          </div>

          {/* Schedule ------------------------------------------------------ */}
          <div className="form__row">
            <div className="form__group">
              <label className="form__label" htmlFor="promo-start-date">Start date</label>
              <input id="promo-start-date" type="date" className="form__input" value={form.startDate} onChange={set('startDate')} />
            </div>
            <div className="form__group">
              <label className="form__label" htmlFor="promo-start-time">Start time</label>
              <input id="promo-start-time" type="time" className="form__input" value={form.startTime} onChange={set('startTime')} />
            </div>
          </div>
          <div className="form__row">
            <div className="form__group">
              <label className="form__label" htmlFor="promo-end-date">End date</label>
              <input id="promo-end-date" type="date" className="form__input" value={form.endDate} onChange={set('endDate')} />
            </div>
            <div className="form__group">
              <label className="form__label" htmlFor="promo-end-time">End time</label>
              <input id="promo-end-time" type="time" className="form__input" value={form.endTime} onChange={set('endTime')} />
            </div>
          </div>

          <div className="form__group">
            <label className="form__label" htmlFor="promo-desc">Promotion description</label>
            <textarea
              id="promo-desc"
              className="form__textarea"
              value={form.description}
              onChange={set('description')}
              placeholder="Tell shoppers what makes this offer worth taking."
            />
          </div>

          {/* Images -------------------------------------------------------- */}
          <div className="form__group">
            <label className="form__label" htmlFor="promo-image">Promotion image</label>
            <div className="image-url-field">
              <div className="image-url-field__preview">
                {form.image ? <img src={form.image} alt="" /> : <span aria-hidden="true">🖼️</span>}
              </div>
              <div className="image-url-field__inputs">
                <input
                  id="promo-image"
                  className="form__input"
                  value={form.image}
                  onChange={set('image')}
                  placeholder="https://example.com/promo.jpg"
                />
                <label className="btn btn--ghost btn--sm">
                  {uploading ? 'Uploading…' : 'Or upload a file'}
                  <input type="file" accept="image/*" hidden onChange={uploadTo('image')} disabled={uploading} />
                </label>
              </div>
            </div>
          </div>

          {/* Optional homepage banner -------------------------------------- */}
          {!editingId && (
            <div className="form__group">
              <label className="form__check">
                <input
                  type="checkbox"
                  checked={form.bannerEnabled}
                  onChange={(e) => setForm((prev) => ({ ...prev, bannerEnabled: e.target.checked }))}
                />
                <span>Also create a homepage banner for this promotion</span>
              </label>

              {form.bannerEnabled && (
                <div className="panel panel--muted mt-8">
                  <div className="form__row">
                    <div className="form__group">
                      <label className="form__label" htmlFor="banner-headline">Banner headline</label>
                      <input
                        id="banner-headline"
                        className="form__input"
                        value={form.bannerHeadline}
                        onChange={set('bannerHeadline')}
                        placeholder="🔥 WEEKEND SALE"
                      />
                    </div>
                    <div className="form__group">
                      <label className="form__label" htmlFor="banner-subline">Banner subline</label>
                      <input
                        id="banner-subline"
                        className="form__input"
                        value={form.bannerSubline}
                        onChange={set('bannerSubline')}
                        placeholder={`Up to ${preview?.discountPercent || 30}% OFF`}
                      />
                    </div>
                  </div>
                  <div className="form__group">
                    <label className="form__label" htmlFor="banner-image">Banner image</label>
                    <div className="image-url-field">
                      <div className="image-url-field__preview">
                        {form.bannerImage || form.image ? (
                          <img src={form.bannerImage || form.image} alt="" />
                        ) : (
                          <span aria-hidden="true">🖼️</span>
                        )}
                      </div>
                      <div className="image-url-field__inputs">
                        <input
                          id="banner-image"
                          className="form__input"
                          value={form.bannerImage}
                          onChange={set('bannerImage')}
                          placeholder="Leave blank to reuse the promotion image"
                        />
                        <label className="btn btn--ghost btn--sm">
                          {uploading ? 'Uploading…' : 'Or upload a file'}
                          <input type="file" accept="image/*" hidden onChange={uploadTo('bannerImage')} disabled={uploading} />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="form__group">
            <label className="form__check">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => setForm((prev) => ({ ...prev, enabled: e.target.checked }))}
              />
              <span>Enable this promotion (it still waits for its start time)</span>
            </label>
          </div>

          {problems.length > 0 && (
            <ul className="form__msg form__msg--error">
              {problems.map((problem) => <li key={problem}>{problem}</li>)}
            </ul>
          )}

          <div className="dash-actions">
            <Button type="submit" variant="primary" loading={saving} disabled={problems.length > 0}>
              {editingId ? 'Save changes' : 'Publish promotion'}
            </Button>
            <Button variant="ghost" onClick={reset}>Cancel</Button>
          </div>
        </form>
      )}

      {/* Existing promotions ---------------------------------------------- */}
      <div className="mt-16">
        {promotions.loading && <Spinner size="large" label="Loading promotions…" />}
        {promotions.error && <ErrorState message={promotions.error} onRetry={promotions.retry} />}
        {!promotions.loading && !promotions.error && list.length === 0 && (
          <EmptyState
            title="No promotions yet"
            message="Create your first promotion — set the discount and the dates, and Seedwel Hub handles the rest."
            action={<Button variant="primary" onClick={() => setShowForm(true)}>+ Create promotion</Button>}
          />
        )}
        {!promotions.loading && list.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Promotion</th>
                  <th>Pricing</th>
                  <th>Runs</th>
                  <th>Status</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {list.map((promo) => (
                  <tr key={promo.id}>
                    <td>
                      <div className="cell-media">
                        {promo.image ? (
                          <img loading="lazy" decoding="async" src={promo.image} alt="" className="cell-media__img" />
                        ) : (
                          <span className="cell-media__img cell-media__img--empty">🏷️</span>
                        )}
                        <div>
                          <div className="font-700">{promo.title}</div>
                          <div className="text-muted" style={{ fontSize: 13 }}>
                            {(promo.productIds || []).length} product{(promo.productIds || []).length === 1 ? '' : 's'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <s className="text-muted">{formatCurrency(promo.originalPrice, promo.currency || currency)}</s>{' '}
                      <strong>{formatCurrency(promo.promoPrice, promo.currency || currency)}</strong>
                      <div className="text-muted" style={{ fontSize: 13 }}>
                        Save {formatCurrency(promo.savings, promo.currency || currency)} ({promo.discountPercent}%)
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: 13 }}>{formatDateTime(promo.startAt)}</div>
                      <div className="text-muted" style={{ fontSize: 13 }}>to {formatDateTime(promo.endAt)}</div>
                      {promo.isActive && <PromoCountdown endsAt={promo.endAt} />}
                    </td>
                    <td>
                      <span className={`badge badge--${STATUS_TONE[promo.status] || 'muted'}`}>
                        {promo.status}
                      </span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button type="button" className="btn btn--ghost btn--sm" onClick={() => startEdit(promo)}>Edit</button>
                        <button type="button" className="btn btn--ghost btn--sm" onClick={() => toggleEnabled(promo)}>
                          {promo.enabled === false ? 'Enable' : 'Disable'}
                        </button>
                        <button type="button" className="btn btn--ghost btn--sm" onClick={() => remove(promo)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Banners ----------------------------------------------------------- */}
      {(banners.data || []).length > 0 && (
        <div className="panel mt-16">
          <h3 className="panel__title">Your promotional banners</h3>
          <p className="text-muted">
            Banners appear in the homepage carousel while their promotion is running.
          </p>
          <div className="table-wrap mt-8">
            <table className="table">
              <thead>
                <tr>
                  <th>Banner</th>
                  <th>Runs</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {banners.data.map((banner) => (
                  <tr key={banner.id}>
                    <td>
                      <div className="font-700">{banner.headline}</div>
                      <div className="text-muted" style={{ fontSize: 13 }}>{banner.subline}</div>
                    </td>
                    <td style={{ fontSize: 13 }}>
                      {formatDateTime(banner.startAt)} → {formatDateTime(banner.endAt)}
                    </td>
                    <td>
                      <button type="button" className="btn btn--ghost btn--sm" onClick={() => removeBanner(banner)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
