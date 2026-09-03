import { REAL_LOGO } from '../../assets';
import { formatCurrency, formatDate } from '../../utils/format';
import { APP_NAME } from '../../utils/constants';

// ---------------------------------------------------------------------------
// The single, shared visual identity for every Xacheus document.
//
// It renders a normalised document (see src/documents/model.js), so a receipt,
// invoice, quotation, payment confirmation and order confirmation are all
// laid out by this one component and therefore look identical by construction.
//
// Layout note (no page cutting): the sheet flows naturally at full height —
// no fixed heights, no inner scroll areas. Only the line-items table gets a
// responsive horizontal container, and only below the breakpoint where the
// columns genuinely stop fitting.
// ---------------------------------------------------------------------------

function metaValue(entry) {
  if (entry.isDate) return formatDate(entry.value);
  return entry.value || '—';
}

function Party({ heading, data }) {
  const lines = [data.subtitle, data.email, data.phone, data.address, ...(data.extra || [])]
    .filter(Boolean);
  return (
    <div className="sdoc__party">
      <h3 className="sdoc__party-heading">{heading}</h3>
      <p className="sdoc__party-name">{data.name || '—'}</p>
      {lines.map((line, index) => (
        <p key={index} className="sdoc__party-line">{line}</p>
      ))}
    </div>
  );
}

export default function DocumentView({ document: doc, children }) {
  if (!doc) return null;
  const { currency } = doc;
  const hasItems = doc.items && doc.items.length > 0;
  const showTaxColumn = hasItems && doc.items.some((item) => item.tax > 0);
  const showDiscountColumn = hasItems && doc.items.some((item) => item.discount > 0);

  return (
    <article className="sdoc" id="seedwel-document">
      {/* Watermark keeps printed/downloaded copies identifiable */}
      <div className="sdoc__watermark" aria-hidden="true">
        <img src={REAL_LOGO} alt="" />
      </div>

      <header className="sdoc__header">
        <div className="sdoc__brand">
          <img src={REAL_LOGO} alt={APP_NAME} className="sdoc__logo" />
          <div>
            <p className="sdoc__brand-name">{APP_NAME}</p>
            <p className="sdoc__brand-tag">Buy. Sell. Manage. Grow.</p>
          </div>
        </div>
        <div className="sdoc__headline">
          <h1 className="sdoc__title">{doc.title}</h1>
          {doc.statusLabel && (
            <span className={`sdoc__status sdoc__status--${doc.statusTone || 'info'}`}>
              {doc.statusLabel}
            </span>
          )}
        </div>
      </header>

      <div className="sdoc__rule" />

      <section className="sdoc__meta">
        {doc.meta.map((entry, index) => (
          <div key={index} className="sdoc__meta-item">
            <span className="sdoc__meta-label">{entry.label}</span>
            <span className={`sdoc__meta-value ${entry.strong ? 'is-strong' : ''}`}>
              {metaValue(entry)}
            </span>
          </div>
        ))}
      </section>

      <section className="sdoc__parties">
        <Party heading="SELLER" data={doc.seller} />
        <Party heading={doc.type === 'quotation' ? 'PREPARED FOR' : 'BUYER'} data={doc.customer} />
      </section>

      {hasItems && (
        <section className="sdoc__section">
          <h3 className="sdoc__section-heading">ITEMS</h3>
          <div className="sdoc__table-wrap">
            <table className="sdoc__table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th className="is-num">Qty</th>
                  <th className="is-num">Unit price</th>
                  {showDiscountColumn && <th className="is-num">Discount</th>}
                  {showTaxColumn && <th className="is-num">Tax</th>}
                  <th className="is-num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {doc.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <span className="sdoc__item-name">{item.name}</span>
                      {item.description && (
                        <span className="sdoc__item-desc">{item.description}</span>
                      )}
                    </td>
                    <td className="is-num">
                      {item.quantity}{item.unit ? ` ${item.unit}` : ''}
                    </td>
                    <td className="is-num">{formatCurrency(item.unitPrice, currency)}</td>
                    {showDiscountColumn && (
                      <td className="is-num">{item.discount ? formatCurrency(item.discount, currency) : '—'}</td>
                    )}
                    {showTaxColumn && (
                      <td className="is-num">{item.taxRate ? `${item.taxRate}%` : '—'}</td>
                    )}
                    <td className="is-num">{formatCurrency(item.amount, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {doc.totals.length > 0 && (
        <section className="sdoc__totals">
          {doc.totals.map((total, index) => (
            <div key={index} className={`sdoc__total-row ${total.strong ? 'is-strong' : ''}`}>
              <span>{total.label}</span>
              <span>{formatCurrency(total.value, currency)}</span>
            </div>
          ))}
        </section>
      )}

      {(doc.notes || doc.terms) && (
        <section className="sdoc__notes">
          {doc.notes && (
            <div className="sdoc__note-block">
              <h3 className="sdoc__section-heading">NOTES</h3>
              <p>{doc.notes}</p>
            </div>
          )}
          {doc.terms && (
            <div className="sdoc__note-block">
              <h3 className="sdoc__section-heading">TERMS &amp; CONDITIONS</h3>
              <p>{doc.terms}</p>
            </div>
          )}
        </section>
      )}

      {children}

      <footer className="sdoc__footer">
        {doc.footnote && <p className="sdoc__footnote">{doc.footnote}</p>}
        {doc.verificationCode && (
          <p className="sdoc__verify">
            Verification reference: <strong>{doc.verificationCode}</strong>
            <span className="sdoc__verify-hint">
              Verify this document at {typeof window !== 'undefined' ? window.location.origin : ''}
              /verify/{doc.verificationCode}
            </span>
          </p>
        )}
      </footer>
    </article>
  );
}
