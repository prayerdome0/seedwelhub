import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import Spinner from '../components/Spinner';
import Button from '../components/Button';
import { EmptyState } from '../components/PageState';
import useAsync from '../hooks/useAsync';
import { createBusiness, getBusinessesByOwner } from '../services/businessService';
import { createProduct } from '../services/productService';
import { createService } from '../services/serviceService';
import { uploadImageToCloudinary } from '../cloudinary/upload';
import { BUSINESS_CATEGORIES } from '../utils/constants';

const EMPTY_BUSINESS = {
  name: '',
  category: '',
  description: '',
  phone: '',
  email: '',
  website: '',
  whatsapp: '',
  city: '',
  region: '',
  country: '',
  address: '',
  registrationNumber: '',
};

const EMPTY_PRODUCT = { name: '', category: '', description: '', price: '', location: '' };
const EMPTY_SERVICE = {
  name: '',
  category: '',
  description: '',
  rate: '',
  rateUnit: 'per service',
  city: '',
  region: '',
  country: '',
};

export default function SellerOnboardingPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const myBusinesses = useAsync(
    () => (user ? getBusinessesByOwner(user.uid) : Promise.resolve([])),
    [user]
  );

  const [businessForm, setBusinessForm] = useState(EMPTY_BUSINESS);
  const [productForm, setProductForm] = useState(EMPTY_PRODUCT);
  const [serviceForm, setServiceForm] = useState(EMPTY_SERVICE);
  const [selectedBusinessId, setSelectedBusinessId] = useState('');

  const [logoUrl, setLogoUrl] = useState('');
  const [productImageUrl, setProductImageUrl] = useState('');
  const [serviceImageUrl, setServiceImageUrl] = useState('');

  const [savingBusiness, setSavingBusiness] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);
  const [savingService, setSavingService] = useState(false);
  const [uploading, setUploading] = useState('');

  // Default the selected business to the first one once they load.
  useEffect(() => {
    const list = myBusinesses.data || [];
    if (list.length && !list.some((b) => b.id === selectedBusinessId)) {
      setSelectedBusinessId(list[0].id);
    }
  }, [myBusinesses.data, selectedBusinessId]);

  const selectedBusiness = (myBusinesses.data || []).find(
    (b) => b.id === selectedBusinessId
  );

  const uploadImage = async (file, setUrl) => {
    const result = await uploadImageToCloudinary(file);
    setUrl(result.secureUrl);
  };

  const handleImageChange = (setUrl, label) => async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!/^image\//.test(file.type)) {
      showToast('Please choose an image file.', 'error');
      return;
    }
    setUploading(label);
    try {
      await uploadImage(file, setUrl);
    } catch (err) {
      showToast(err.message || 'Upload failed. Please try again.', 'error');
    } finally {
      setUploading('');
    }
  };

  const setBusinessField = (key) => (event) =>
    setBusinessForm((prev) => ({ ...prev, [key]: event.target.value }));
  const setProductField = (key) => (event) =>
    setProductForm((prev) => ({ ...prev, [key]: event.target.value }));
  const setServiceField = (key) => (event) =>
    setServiceForm((prev) => ({ ...prev, [key]: event.target.value }));

  const handleCreateBusiness = async (event) => {
    event.preventDefault();
    if (!user) {
      showToast('Please log in to start selling.', 'info');
      navigate('/login');
      return;
    }
    if (!businessForm.name.trim()) {
      showToast('Please enter your business name.', 'error');
      return;
    }
    setSavingBusiness(true);
    try {
      const business = await createBusiness(user.uid, {
        name: businessForm.name.trim(),
        category: businessForm.category,
        description: businessForm.description.trim(),
        phone: businessForm.phone.trim(),
        email: businessForm.email.trim(),
        website: businessForm.website.trim(),
        whatsapp: businessForm.whatsapp.trim(),
        city: businessForm.city.trim(),
        region: businessForm.region.trim(),
        country: businessForm.country.trim(),
        address: businessForm.address.trim(),
        registrationNumber: businessForm.registrationNumber.trim(),
        logo: logoUrl,
      });
      setBusinessForm(EMPTY_BUSINESS);
      setLogoUrl('');
      await myBusinesses.retry();
      setSelectedBusinessId(business.id);
      showToast('Your business is live! Now add a product or service below.', 'success');
    } catch (err) {
      showToast(err.message || 'Could not create your business. Please try again.', 'error');
    } finally {
      setSavingBusiness(false);
    }
  };

  const handleCreateProduct = async (event) => {
    event.preventDefault();
    if (!selectedBusiness || !user) {
      showToast('Create a business first.', 'info');
      return;
    }
    if (!productForm.name.trim()) {
      showToast('Please enter a product name.', 'error');
      return;
    }
    const price = parseFloat(productForm.price);
    if (Number.isNaN(price) || price < 0) {
      showToast('Please enter a valid price.', 'error');
      return;
    }
    setSavingProduct(true);
    try {
      await createProduct(user.uid, {
        businessId: selectedBusiness.id,
        businessName: selectedBusiness.name,
        name: productForm.name.trim(),
        category: productForm.category,
        description: productForm.description.trim(),
        price,
        location: productForm.location.trim(),
        image: productImageUrl,
      });
      setProductForm(EMPTY_PRODUCT);
      setProductImageUrl('');
      showToast('Product listed! It is now live in the marketplace.', 'success');
    } catch (err) {
      showToast(err.message || 'Could not list the product. Please try again.', 'error');
    } finally {
      setSavingProduct(false);
    }
  };

  const handleCreateService = async (event) => {
    event.preventDefault();
    if (!selectedBusiness || !user) {
      showToast('Create a business first.', 'info');
      return;
    }
    if (!serviceForm.name.trim()) {
      showToast('Please enter a service name.', 'error');
      return;
    }
    const rate = parseFloat(serviceForm.rate);
    if (Number.isNaN(rate) || rate < 0) {
      showToast('Please enter a valid rate.', 'error');
      return;
    }
    setSavingService(true);
    try {
      await createService(user.uid, {
        businessId: selectedBusiness.id,
        businessName: selectedBusiness.name,
        name: serviceForm.name.trim(),
        category: serviceForm.category,
        description: serviceForm.description.trim(),
        rate,
        rateUnit: serviceForm.rateUnit.trim() || 'per service',
        city: serviceForm.city.trim(),
        region: serviceForm.region.trim(),
        country: serviceForm.country.trim(),
        image: serviceImageUrl,
      });
      setServiceForm(EMPTY_SERVICE);
      setServiceImageUrl('');
      showToast('Service listed! It is now live in the marketplace.', 'success');
    } catch (err) {
      showToast(err.message || 'Could not list the service. Please try again.', 'error');
    } finally {
      setSavingService(false);
    }
  };

  const businessInput = (id, label, value, placeholder) => (
    <div className="form__group">
      <label className="form__label" htmlFor={id}>{label}</label>
      <input
        id={id}
        className="form__input"
        value={value}
        onChange={setBusinessField(id)}
        placeholder={placeholder}
      />
    </div>
  );

  return (
    <div className="container page page--narrow">
      <div className="page__header">
        <h1 className="page__title">Start selling on Seedwel Hub</h1>
        <p className="page__subtitle">
          Set up your business, then list products and services to reach customers across the hub.
        </p>
      </div>

      {!myBusinesses.loading && myBusinesses.data?.length > 0 && (
        <div className="panel dash-toolbar">
          <div>
            <h2 className="panel__title">Manage your selling</h2>
            <p className="text-muted">
              See where you can sell, edit listings, track stock and bulk-import products or
              inventory from a CSV file.
            </p>
          </div>
          <Link to="/seller" className="btn btn--primary">Open seller dashboard</Link>
        </div>
      )}

      {myBusinesses.loading && <Spinner size="sm" />}

      {/* Existing businesses */}
      {!myBusinesses.loading && myBusinesses.data?.length > 0 && (
        <div className="panel">
          <h2 className="panel__title">Your businesses</h2>
          <div className="stack">
            {myBusinesses.data.map((b) => (
              <Link key={b.id} to={`/business/${b.id}`} className="onboard-business">
                {b.logo ? (
                  <img loading="lazy" decoding="async" src={b.logo} alt={b.name} className="onboard-business__logo" />
                ) : (
                  <span className="onboard-business__logo onboard-business__logo--empty">
                    {b.name?.[0] || 'B'}
                  </span>
                )}
                <span className="onboard-business__name">{b.name || 'Unnamed business'}</span>
                <span className="onboard-business__go">View store →</span>
              </Link>
            ))}
          </div>

          <div className="form__group mt-16">
            <label className="form__label" htmlFor="business-select">Listing for</label>
            <select
              id="business-select"
              className="form__select"
              value={selectedBusinessId}
              onChange={(e) => setSelectedBusinessId(e.target.value)}
            >
              {myBusinesses.data.map((b) => (
                <option key={b.id} value={b.id}>{b.name || 'Unnamed business'}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Business form */}
      <form className="panel mt-16" onSubmit={handleCreateBusiness}>
        <h2 className="panel__title">
          {myBusinesses.data?.length > 0 ? 'Register another business' : 'Step 1 · Business details'}
        </h2>

        <div className="form__group">
          <label className="form__label">Logo</label>
          <div className="onboard-logo">
            {logoUrl ? (
              <img loading="lazy" decoding="async" src={logoUrl} alt="Business logo preview" className="onboard-logo__preview" />
            ) : (
              <span className="onboard-logo__placeholder">{businessForm.name?.[0] || '🏪'}</span>
            )}
            <label className="btn btn--ghost btn--sm">
              {uploading === 'logo' ? 'Uploading…' : 'Upload logo'}
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={handleImageChange(setLogoUrl, 'logo')}
                disabled={uploading === 'logo'}
              />
            </label>
          </div>
        </div>

        <div className="form__row">
          {businessInput('name', 'Business name *', businessForm.name, 'e.g. Acme Traders Ltd')}
          <div className="form__group">
            <label className="form__label" htmlFor="category">Category</label>
            <select
              id="category"
              className="form__select"
              value={businessForm.category}
              onChange={setBusinessField('category')}
            >
              <option value="">Choose a category…</option>
              {BUSINESS_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="form__group">
          <label className="form__label" htmlFor="description">Description</label>
          <textarea
            id="description"
            className="form__textarea"
            value={businessForm.description}
            onChange={setBusinessField('description')}
            placeholder="Tell customers what you do…"
          />
        </div>

        <div className="form__row">
          {businessInput('phone', 'Phone', businessForm.phone, '+260 …')}
          {businessInput('email', 'Business email', businessForm.email, 'hello@business.com')}
        </div>
        <div className="form__row">
          {businessInput('website', 'Website', businessForm.website, 'https://…')}
          {businessInput('whatsapp', 'WhatsApp', businessForm.whatsapp, '+260 …')}
        </div>

        <h2 className="panel__title mt-16">Location</h2>
        <div className="form__row">
          {businessInput('city', 'City', businessForm.city, 'Lusaka')}
          {businessInput('region', 'Region / Province', businessForm.region, 'Lusaka Province')}
        </div>
        <div className="form__row">
          {businessInput('country', 'Country', businessForm.country, 'Zambia')}
          {businessInput('address', 'Street address', businessForm.address, 'Plot 123, Main Street')}
        </div>

        <div className="form__group">
          {businessInput('registrationNumber', 'Registration number (optional)', businessForm.registrationNumber, 'e.g. PACRA no.')}
        </div>

        <Button type="submit" variant="primary" size="lg" loading={savingBusiness} className="w-full">
          {myBusinesses.data?.length > 0 ? 'Register business' : 'Create my business'}
        </Button>
      </form>

      {/* Product + service quick-list forms */}
      {selectedBusiness && (
        <div className="grid grid--2 mt-16">
          <form className="panel" onSubmit={handleCreateProduct}>
            <h2 className="panel__title">Step 2 · List a product</h2>
            <p className="text-muted">Listing for <strong>{selectedBusiness.name}</strong>.</p>

            <div className="form__group">
              <label className="form__label" htmlFor="product-name">Product name *</label>
              <input id="product-name" className="form__input" value={productForm.name} onChange={setProductField('name')} placeholder="e.g. Fresh Maize 50kg" />
            </div>
            <div className="form__row">
              <div className="form__group">
                <label className="form__label" htmlFor="product-category">Category</label>
                <select id="product-category" className="form__select" value={productForm.category} onChange={setProductField('category')}>
                  <option value="">Choose…</option>
                  {BUSINESS_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div className="form__group">
                <label className="form__label" htmlFor="product-price">Price *</label>
                <input id="product-price" type="number" min="0" step="0.01" className="form__input" value={productForm.price} onChange={setProductField('price')} placeholder="0.00" />
              </div>
            </div>
            <div className="form__group">
              <label className="form__label" htmlFor="product-description">Description</label>
              <textarea id="product-description" className="form__textarea" value={productForm.description} onChange={setProductField('description')} placeholder="What are you selling?" />
            </div>
            <div className="form__group">
              <label className="form__label" htmlFor="product-location">Location</label>
              <input id="product-location" className="form__input" value={productForm.location} onChange={setProductField('location')} placeholder="Lusaka" />
            </div>

            <div className="form__group">
              <label className="form__label">Photo</label>
              <div className="onboard-logo">
                {productImageUrl ? (
                  <img loading="lazy" decoding="async" src={productImageUrl} alt="Product preview" className="onboard-logo__preview" />
                ) : (
                  <span className="onboard-logo__placeholder">📦</span>
                )}
                <label className="btn btn--ghost btn--sm">
                  {uploading === 'product' ? 'Uploading…' : 'Upload photo'}
                  <input type="file" accept="image/*" hidden onChange={handleImageChange(setProductImageUrl, 'product')} disabled={uploading === 'product'} />
                </label>
              </div>
            </div>

            <Button type="submit" variant="primary" loading={savingProduct} className="w-full">
              List product
            </Button>
          </form>

          <form className="panel" onSubmit={handleCreateService}>
            <h2 className="panel__title">Step 2 · List a service</h2>
            <p className="text-muted">Listing for <strong>{selectedBusiness.name}</strong>.</p>

            <div className="form__group">
              <label className="form__label" htmlFor="service-name">Service name *</label>
              <input id="service-name" className="form__input" value={serviceForm.name} onChange={setServiceField('name')} placeholder="e.g. Tractor hire" />
            </div>
            <div className="form__row">
              <div className="form__group">
                <label className="form__label" htmlFor="service-category">Category</label>
                <select id="service-category" className="form__select" value={serviceForm.category} onChange={setServiceField('category')}>
                  <option value="">Choose…</option>
                  {BUSINESS_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div className="form__group">
                <label className="form__label" htmlFor="service-rate">Rate *</label>
                <input id="service-rate" type="number" min="0" step="0.01" className="form__input" value={serviceForm.rate} onChange={setServiceField('rate')} placeholder="0.00" />
              </div>
            </div>
            <div className="form__row">
              <div className="form__group">
                <label className="form__label" htmlFor="service-rateUnit">Rate unit</label>
                <input id="service-rateUnit" className="form__input" value={serviceForm.rateUnit} onChange={setServiceField('rateUnit')} placeholder="per service" />
              </div>
              <div className="form__group">
                <label className="form__label" htmlFor="service-city">City</label>
                <input id="service-city" className="form__input" value={serviceForm.city} onChange={setServiceField('city')} placeholder="Lusaka" />
              </div>
            </div>
            <div className="form__group">
              <label className="form__label" htmlFor="service-description">Description</label>
              <textarea id="service-description" className="form__textarea" value={serviceForm.description} onChange={setServiceField('description')} placeholder="What service do you offer?" />
            </div>

            <div className="form__group">
              <label className="form__label">Photo</label>
              <div className="onboard-logo">
                {serviceImageUrl ? (
                  <img loading="lazy" decoding="async" src={serviceImageUrl} alt="Service preview" className="onboard-logo__preview" />
                ) : (
                  <span className="onboard-logo__placeholder">🛠️</span>
                )}
                <label className="btn btn--ghost btn--sm">
                  {uploading === 'service' ? 'Uploading…' : 'Upload photo'}
                  <input type="file" accept="image/*" hidden onChange={handleImageChange(setServiceImageUrl, 'service')} disabled={uploading === 'service'} />
                </label>
              </div>
            </div>

            <Button type="submit" variant="primary" loading={savingService} className="w-full">
              List service
            </Button>
          </form>
        </div>
      )}

      {!myBusinesses.loading && myBusinesses.data?.length === 0 && (
        <div className="mt-16">
          <EmptyState
            title="No business yet"
            message="Create your business above, then list products and services."
          />
        </div>
      )}
    </div>
  );
}
