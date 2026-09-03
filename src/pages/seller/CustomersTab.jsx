import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import Spinner from '../../components/Spinner';
import { EmptyState, ErrorState } from '../../components/PageState';
import useAsync from '../../hooks/useAsync';
import { getOrdersByBusiness } from '../../services/orderService';
import { getInvoicesByBusiness } from '../../services/invoiceService';
import { PAYMENT_STATUS } from '../../utils/constants';
import { formatCurrency, formatDate, timestampMillis } from '../../utils/format';

// Seller Dashboard → Customers.
// There is no separate customer registry to maintain — the customer list is
// derived from the orders and invoices the business already has, so it is
// always accurate and needs no upkeep.
export default function CustomersTab({ business }) {
  const orders = useAsync(
    () => (business?.id ? getOrdersByBusiness(business.id, 300) : Promise.resolve([])),
    [business?.id]
  );
  const invoices = useAsync(
    () => (business?.id ? getInvoicesByBusiness(business.id) : Promise.resolve([])),
    [business?.id]
  );

  const customers = useMemo(() => {
    const map = new Map();

    const touch = (key, seed) => {
      if (!map.has(key)) {
        map.set(key, {
          key,
          name: seed.name || 'Customer',
          phone: seed.phone || '',
          email: seed.email || '',
          buyerId: seed.buyerId || null,
          orders: 0,
          invoices: 0,
          spent: 0,
          outstanding: 0,
          lastActivity: 0,
          currency: seed.currency,
        });
      }
      return map.get(key);
    };

    for (const order of orders.data || []) {
      const key = order.buyerId || order.buyerName || order.id;
      const customer = touch(key, {
        name: order.buyerName,
        phone: order.buyerPhone,
        buyerId: order.buyerId,
        currency: order.currency,
      });
      customer.orders += 1;
      if (order.paymentStatus === PAYMENT_STATUS.CONFIRMED) {
        customer.spent += Number(order.total) || 0;
      }
      customer.lastActivity = Math.max(customer.lastActivity, timestampMillis(order.createdAt));
      if (!customer.currency) customer.currency = order.currency;
    }

    for (const invoice of invoices.data || []) {
      const key = invoice.customerId || invoice.customerName || invoice.id;
      const customer = touch(key, {
        name: invoice.customerName,
        email: invoice.customerEmail,
        phone: invoice.customerPhone,
        buyerId: invoice.customerId,
        currency: invoice.currency,
      });
      customer.invoices += 1;
      customer.outstanding += Number(invoice.balance) || 0;
      customer.lastActivity = Math.max(customer.lastActivity, timestampMillis(invoice.createdAt));
    }

    return [...map.values()].sort((a, b) => b.lastActivity - a.lastActivity);
  }, [orders.data, invoices.data]);

  if (!business) return null;

  const loading = orders.loading || invoices.loading;
  const error = orders.error || invoices.error;
  const refresh = () => {
    orders.retry();
    invoices.retry();
  };

  if (loading) return <Spinner size="large" label="Loading customers…" />;
  if (error) return <ErrorState message={error} onRetry={refresh} />;

  if (!customers.length) {
    return (
      <div className="panel mt-16">
        <EmptyState
          title="No customers yet"
          message="Everyone who orders from you or receives an invoice will appear here."
        />
      </div>
    );
  }

  return (
    <div className="mt-16">
      <div className="panel dash-toolbar">
        <div>
          <h2 className="panel__title">Customers ({customers.length})</h2>
          <p className="text-muted">Built automatically from your orders and invoices.</p>
        </div>
      </div>

      <div className="table-wrap mt-16">
        <table className="table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Contact</th>
              <th>Orders</th>
              <th>Invoices</th>
              <th>Confirmed spend</th>
              <th>Outstanding</th>
              <th>Last activity</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer) => (
              <tr key={customer.key}>
                <td>{customer.name}</td>
                <td>
                  {customer.phone || customer.email || '—'}
                </td>
                <td>{customer.orders}</td>
                <td>{customer.invoices}</td>
                <td>{formatCurrency(customer.spent, customer.currency)}</td>
                <td>{formatCurrency(customer.outstanding, customer.currency)}</td>
                <td>
                  {customer.lastActivity ? formatDate(new Date(customer.lastActivity)) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
