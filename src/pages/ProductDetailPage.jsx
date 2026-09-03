import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Image from '../components/Image';
import Spinner from '../components/Spinner';
import { NotFoundState, ErrorState, LoadingState } from '../components/PageState';
import StarRating from '../components/StarRating';
import Badge from '../components/Badge';
import Button from '../components/Button';
import CheckoutForm from '../components/CheckoutForm';
import useDocument from '../hooks/useDocument';
import useStartConversation from '../hooks/useStartConversation';
import { getProduct } from '../services/productService';
import { placeOrder } from '../services/orderService';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { formatCurrency } from '../utils/format';

export default function ProductDetailPage() {
  const { id } = useParams();
  const { data: product, loading, error, notFound, retry } = useDocument(getProduct, id, []);
  const [activeImage, setActiveImage] = useState(0);
  const [qty, setQty] = useState(1);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [placing, setPlacing] = useState(false);
  const { user, profile } = useAuth();
  const { showToast } = useToast();
  const { start: startConversation, starting: startingConversation } = useStartConversation();
  const navigate = useNavigate();

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={retry} />;
  if (notFound) {
    return (
      <div className="container page">
        <NotFoundState
          title="Product not found"
          message="The product you are looking for does not exist or may have been removed."
        />
      </div>
    );
  }

  const images = product.images?.length ? product.images : product.image ? [product.image] : [];
  const currentImage = images[activeImage];
  const sellerName = product.sellerName || product.businessName;
  const stock = Number(product.stock);
  const available = product.availability !== 'out_of_stock' && (Number.isNaN(stock) || stock > 0);

  const handleBuy = () => {
    if (!user) {
      showToast('Please log in to place an order.', 'info');
      return;
    }
    if (!available) {
      showToast('This product is out of stock.', 'error');
      return;
    }
    setCheckoutOpen((open) => !open);
  };

  const handlePlaceOrder = async ({ name, phone, address, paymentMethod, note }) => {
    setPlacing(true);
    try {
      const order = await placeOrder({
        buyerId: user.uid,
        buyerName: name,
        buyerPhone: phone,
        businessId: product.businessId || null,
        businessName: sellerName || 'Seller',
        ownerId: product.ownerId,
        items: [
          {
            type: 'product',
            productId: product.id,
            sku: product.sku,
            name: product.name,
            price: Number(product.price) || 0,
            quantity: qty,
            unit: product.unit,
            image: currentImage || product.image || '',
          },
        ],
        address,
        paymentMethod,
        note,
      });
      showToast(`Order ${order.orderNumber} placed successfully.`, 'success');
      navigate(`/order/${order.id}`);
    } catch (err) {
      showToast(err.message || 'Could not place the order. Please try again.', 'error');
    } finally {
      setPlacing(false);
    }
  };

  const handleMessageSeller = () => {
    startConversation(product.ownerId, {
      otherName: sellerName || 'Seller',
      otherPhoto: product.image || '',
      product: product.id,
    });
  };

  return (
    <div className="container page">
      <div className="mt-8 mb-16">
        <Link to="/marketplace" className="section__link">← Back to Marketplace</Link>
      </div>

      <div className="detail-layout">
        <div className="detail-main">
          {/* Gallery */}
          {images.length > 0 && (
            <div className="gallery">
              <div className="gallery__main">
                <Image src={currentImage} alt={product.name} />
              </div>
              {images.length > 1 && (
                <div className="gallery__thumbs">
                  {images.map((img, i) => (
                    <button
                      key={i}
                      type="button"
                      className={`gallery__thumb ${i === activeImage ? 'active' : ''}`}
                      onClick={() => setActiveImage(i)}
                    >
                      <Image src={img} alt={`${product.name} ${i + 1}`} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Description */}
          <div className="panel">
            <h2 className="panel__title">Description</h2>
            <p>{product.description || 'No description provided for this product.'}</p>
          </div>

          {/* Seller / business */}
          {sellerName && (
            <div className="panel">
              <h2 className="panel__title">Seller</h2>
              <div className="flex items-center gap-8">
                <span className="avatar avatar--md">{sellerName[0]}</span>
                <div>
                  <div className="font-700">{sellerName}</div>
                  {product.businessId && (
                    <Link to={`/business/${product.businessId}`} className="section__link">
                      View business
                    </Link>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Reviews */}
          {(product.reviewCount || 0) > 0 ? (
            <div className="panel">
              <h2 className="panel__title">Reviews</h2>
              <StarRating rating={product.rating} count={product.reviewCount} />
              <p className="text-muted mt-8">Reviews for this product will appear here.</p>
            </div>
          ) : (
            <div className="panel">
              <h2 className="panel__title">Reviews</h2>
              <p className="text-muted">No reviews yet.</p>
            </div>
          )}
        </div>

        {/* Buy box */}
        <aside className="detail-aside">
          <div className="panel">
            <h1 className="detail-heading__title">{product.name || 'Unnamed product'}</h1>
            {product.category && <Badge tone="info">{product.category}</Badge>}
            {product.location && <p className="text-muted mt-8">📍 {product.location}</p>}

            <div className="buy-box mt-16">
              <div className="buy-box__price">{formatCurrency(product.price)}</div>
              {product.priceType && <p className="text-muted">{product.priceType}</p>}

              <div className="buy-box__qty">
                <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
                <input
                  type="number"
                  min="1"
                  value={qty}
                  onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
                />
                <button type="button" onClick={() => setQty((q) => q + 1)}>+</button>
              </div>

              {available ? (
                <Badge tone="success">Available</Badge>
              ) : (
                <Badge tone="danger">Out of stock</Badge>
              )}
              {product.stock !== undefined && (
                <p className="text-muted">In stock: {product.stock}</p>
              )}

              <div className="mt-16">
                <Button variant="primary" className="btn--block" onClick={handleBuy}>
                  Place Order
                </Button>
                {checkoutOpen && (
                  <CheckoutForm
                    buyer={profile}
                    summary={`${qty} × ${product.name}`}
                    total={(Number(product.price) || 0) * qty}
                    submitting={placing}
                    submitLabel="Place Order"
                    onCancel={() => setCheckoutOpen(false)}
                    onSubmit={handlePlaceOrder}
                  />
                )}
              </div>

              {product.ownerId && (
                <div className="mt-8">
                  <Button
                    variant="outline"
                    className="btn--block"
                    loading={startingConversation}
                    onClick={handleMessageSeller}
                  >
                    💬 Message seller
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="panel">
            <h3 className="panel__title">Details</h3>
            <dl className="kv">
              {product.businessName && (
                <>
                  <dt>Business</dt>
                  <dd>{product.businessName}</dd>
                </>
              )}
              {product.sku && (
                <>
                  <dt>SKU</dt>
                  <dd>{product.sku}</dd>
                </>
              )}
              {product.condition && (
                <>
                  <dt>Condition</dt>
                  <dd>{product.condition}</dd>
                </>
              )}
              {product.retailPrice && (
                <>
                  <dt>Retail</dt>
                  <dd>{formatCurrency(product.retailPrice)}</dd>
                </>
              )}
              {product.wholesalePrice && (
                <>
                  <dt>Wholesale</dt>
                  <dd>{formatCurrency(product.wholesalePrice)}</dd>
                </>
              )}
            </dl>
          </div>
        </aside>
      </div>
    </div>
  );
}
