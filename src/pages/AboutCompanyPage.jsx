import { Link } from 'react-router-dom';
import { REAL_LOGO } from '../assets';
import { APP_NAME, APP_TAGLINE } from '../utils/constants';

const VALUES = [
  {
    icon: '🛡️',
    title: 'Trust by design',
    body: 'Verified sellers, reviewed payment proofs and an auditable record behind every transaction. Nothing is marked paid on a screenshot alone.',
  },
  {
    icon: '📄',
    title: 'Real business tooling',
    body: 'Quotations, invoices, receipts and payment records are first-class documents — numbered, branded and downloadable as PDFs.',
  },
  {
    icon: '🌍',
    title: 'Built for local trade',
    body: 'Multi-currency support and the payment methods traders actually use, from mobile money to bank transfer.',
  },
  {
    icon: '🤝',
    title: 'Both sides protected',
    body: 'Buyers get records and recourse. Sellers get verification, order visibility and fraud alerts.',
  },
];

export default function AboutCompanyPage() {
  return (
    <div className="container page">
      <section className="about-hero">
        <img src={REAL_LOGO} alt="" className="about-hero__logo" />
        <h1 className="about-hero__title">About {APP_NAME}</h1>
        <p className="about-hero__tagline">{APP_TAGLINE}</p>
      </section>

      <div className="panel">
        <h2 className="panel__title">Who we are</h2>
        <p className="about-prose">
          {APP_NAME} is a marketplace and transaction-management platform operated by
          Seedwel Investment Limited. We connect buyers with verified businesses and give
          those businesses the tools they need to actually run the sale — not just advertise it.
        </p>
        <p className="about-prose">
          Most marketplaces stop at the listing. We carry the transaction all the way through:
          a buyer requests a quotation, the seller prices it, an invoice is issued, payment is
          made and verified, and a numbered receipt is generated automatically. Every document
          carries the same Seedwel Hub identity and can be downloaded as a PDF.
        </p>
      </div>

      <div className="panel">
        <h2 className="panel__title">What we stand for</h2>
        <div className="about-values">
          {VALUES.map((value) => (
            <div key={value.title} className="about-value">
              <span className="about-value__icon" aria-hidden="true">{value.icon}</span>
              <h3 className="about-value__title">{value.title}</h3>
              <p className="about-value__body">{value.body}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <h2 className="panel__title">Company details</h2>
        <dl className="kv">
          <dt>Registered name</dt><dd>Seedwel Investment Limited</dd>
          <dt>Trading as</dt><dd>Seedwel Hub</dd>
          <dt>Group</dt><dd>Phiko Trading</dd>
          <dt>Platform</dt><dd>Marketplace &amp; transaction management</dd>
        </dl>
      </div>

      <div className="about-cta">
        <div>
          <h2 className="about-cta__title">Ready to trade with confidence?</h2>
          <p className="text-muted">Browse verified sellers or set up your own storefront.</p>
        </div>
        <div className="about-cta__actions">
          <Link to="/marketplace" className="btn btn--primary">Browse Marketplace</Link>
          <Link to="/about/services" className="btn btn--outline">Our Services</Link>
        </div>
      </div>
    </div>
  );
}
