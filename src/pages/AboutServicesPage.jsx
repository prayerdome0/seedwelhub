import { Link } from 'react-router-dom';
import { APP_NAME } from '../utils/constants';

const SERVICES = [
  {
    icon: '🛍️',
    title: 'Marketplace',
    body: 'List products and services, reach buyers, and manage listings, categories, images and stock from one dashboard.',
    points: ['Product & service listings', 'Inventory and low-stock alerts', 'Bulk CSV import', 'Multi-currency pricing'],
    to: '/marketplace',
    cta: 'Browse the marketplace',
  },
  {
    icon: '📝',
    title: 'Quotations',
    body: 'A complete request-to-quote workflow. Buyers submit a structured brief; sellers accept, decline or ask for clarification, then send a priced quotation.',
    points: ['Structured quotation requests', 'Accept / decline / clarify', 'Line items, tax, delivery and terms', 'Branded PDF, valid-until dates'],
    to: '/quotations',
    cta: 'View quotations',
  },
  {
    icon: '📄',
    title: 'Invoicing',
    body: 'Raise an invoice against any unpaid order, review it before sending, and track it through its full lifecycle.',
    points: ['Draft → Sent → Viewed → Paid', 'Partial payments and balances', 'Due dates and overdue tracking', 'Downloadable PDF invoices'],
    to: '/invoices',
    cta: 'View invoices',
  },
  {
    icon: '🧾',
    title: 'Receipts & payments',
    body: 'Buyers submit proof of payment; sellers verify it. Once confirmed, a numbered receipt is generated automatically.',
    points: ['Seller-configured payment methods', 'Proof of payment with evidence', 'Seller/admin verification', 'Automatic receipt generation'],
    to: '/receipts',
    cta: 'View receipts',
  },
  {
    icon: '🛡️',
    title: 'Trust & safety',
    body: 'Seller verification, duplicate-reference detection, fraud flags and an immutable audit trail behind every privileged action.',
    points: ['Verified seller badges', 'Payment proof review', 'Suspicious activity monitoring', 'Full audit history'],
    to: '/about/company',
    cta: 'How we protect you',
  },
  {
    icon: '💬',
    title: 'Communication',
    body: 'Talk to buyers and sellers directly, join trade groups, and get notified the moment something needs your attention.',
    points: ['Direct messaging', 'Business groups', 'Real-time notifications', 'Push alerts'],
    to: '/messages',
    cta: 'Open messages',
  },
];

export default function AboutServicesPage() {
  return (
    <div className="container page">
      <div className="page__header">
        <h1 className="page__title">About Our Services</h1>
        <p className="page__subtitle">
          Everything {APP_NAME} does, from the first listing to the final receipt.
        </p>
      </div>

      <div className="service-cards">
        {SERVICES.map((service) => (
          <article key={service.title} className="service-info-card">
            <span className="service-info-card__icon" aria-hidden="true">{service.icon}</span>
            <h2 className="service-info-card__title">{service.title}</h2>
            <p className="service-info-card__body">{service.body}</p>
            <ul className="service-info-card__points">
              {service.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
            <Link to={service.to} className="service-info-card__link">
              {service.cta} →
            </Link>
          </article>
        ))}
      </div>

      <div className="about-cta">
        <div>
          <h2 className="about-cta__title">Start selling on {APP_NAME}</h2>
          <p className="text-muted">Set up your business, list your first product and get verified.</p>
        </div>
        <div className="about-cta__actions">
          <Link to="/sell" className="btn btn--primary">Start Selling</Link>
          <Link to="/about/company" className="btn btn--outline">About Our Company</Link>
        </div>
      </div>
    </div>
  );
}
