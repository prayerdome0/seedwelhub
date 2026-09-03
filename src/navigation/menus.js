// ---------------------------------------------------------------------------
// Navigation model.
//
// Both the main drawer and the account drawer are described here as data, so
// the two menus stay in sync with the routes and role rules in one place
// instead of being duplicated across components.
// ---------------------------------------------------------------------------

// Main application drawer. Account sits in its own group so it can be pinned
// toward the bottom, separated from the primary navigation.
export const MAIN_MENU = [
  {
    id: 'primary',
    items: [
      { id: 'home', to: '/', icon: '🏠', label: 'Home', end: true },
      { id: 'marketplace', to: '/marketplace', icon: '🛍️', label: 'Marketplace' },
      { id: 'orders', to: '/orders', icon: '📦', label: 'My Orders', auth: true },
      { id: 'saved', to: '/saved', icon: '❤️', label: 'Saved / Favorites', auth: true },
      { id: 'notifications', to: '/notifications', icon: '🔔', label: 'Notifications', auth: true, badge: 'notifications' },
    ],
  },
  {
    id: 'discover',
    label: 'Discover',
    items: [
      { id: 'services', to: '/services', icon: '🧰', label: 'Services' },
      { id: 'businesses', to: '/businesses', icon: '🏢', label: 'Businesses' },
      { id: 'messages', to: '/messages', icon: '💬', label: 'Messages', auth: true },
      { id: 'groups', to: '/groups', icon: '👥', label: 'Groups', auth: true },
    ],
  },
  {
    id: 'selling',
    label: 'Selling',
    items: [
      { id: 'sell', to: '/sell', icon: '🚀', label: 'Start Selling', hideWhenSeller: true },
      { id: 'seller', to: '/seller', icon: '📊', label: 'Seller Dashboard', seller: true },
    ],
  },
  {
    id: 'about',
    label: 'About Us',
    items: [
      { id: 'about-company', to: '/about/company', icon: 'ℹ️', label: 'About Our Company' },
      { id: 'about-services', to: '/about/services', icon: '📘', label: 'About Our Services' },
    ],
  },
  {
    id: 'account',
    separated: true,
    items: [
      { id: 'account', to: '/account', icon: '👤', label: 'Account', auth: true },
      { id: 'settings', to: '/settings', icon: '⚙️', label: 'Settings', auth: true },
      { id: 'admin', to: '/admin', icon: '🛡️', label: 'Admin Console', admin: true },
    ],
  },
];

// Account drawer — buyer view.
export const BUYER_ACCOUNT_MENU = [
  { id: 'profile', to: '/account/profile', icon: '👤', label: 'Profile' },
  { id: 'orders', to: '/orders', icon: '📦', label: 'My Orders' },
  { id: 'receipts', to: '/receipts', icon: '🧾', label: 'Receipts' },
  { id: 'invoices', to: '/invoices', icon: '📄', label: 'Invoices' },
  { id: 'quotations', to: '/quotations', icon: '📝', label: 'Quotations' },
  { id: 'payments', to: '/payments', icon: '💳', label: 'Payments' },
  { id: 'saved', to: '/saved', icon: '❤️', label: 'Saved / Favorites' },
  { id: 'notifications', to: '/notifications', icon: '🔔', label: 'Notifications', badge: 'notifications' },
  { id: 'settings', to: '/settings', icon: '⚙️', label: 'Settings' },
];

// Account drawer — seller view. The Seller Dashboard entry is only included
// for verified/authorized sellers (see accountMenuFor below).
export const SELLER_ACCOUNT_MENU = [
  { id: 'profile', to: '/account/profile', icon: '👤', label: 'Profile' },
  { id: 'dashboard', to: '/seller', icon: '📊', label: 'Seller Dashboard', verifiedSeller: true },
  { id: 'products', to: '/seller?tab=products', icon: '🛍️', label: 'Products', seller: true },
  { id: 'seller-orders', to: '/seller?tab=orders', icon: '📦', label: 'Orders', seller: true },
  { id: 'seller-quotations', to: '/seller?tab=quotations', icon: '📝', label: 'Quotations', seller: true },
  { id: 'seller-invoices', to: '/seller?tab=invoices', icon: '📄', label: 'Invoices', seller: true },
  { id: 'seller-receipts', to: '/seller?tab=receipts', icon: '🧾', label: 'Receipts', seller: true },
  { id: 'seller-payments', to: '/seller?tab=payments', icon: '💳', label: 'Payments', seller: true },
  { id: 'customers', to: '/seller?tab=customers', icon: '🤝', label: 'Customers', seller: true },
  { id: 'notifications', to: '/notifications', icon: '🔔', label: 'Notifications', badge: 'notifications' },
  { id: 'settings', to: '/settings', icon: '⚙️', label: 'Settings' },
];

// My-side buyer entries a seller also needs (their own purchases).
export const SELLER_BUYER_EXTRAS = [
  { id: 'my-orders', to: '/orders', icon: '🛒', label: 'My Purchases' },
  { id: 'my-receipts', to: '/receipts', icon: '🧾', label: 'My Receipts' },
];

/**
 * Filters a menu group's items against the current viewer.
 */
export function visibleItems(items, viewer) {
  const { isAuthenticated, isSeller, isVerifiedSeller, isAdmin } = viewer;
  return items.filter((item) => {
    if (item.auth && !isAuthenticated) return false;
    if (item.admin && !isAdmin) return false;
    if (item.verifiedSeller && !isVerifiedSeller) return false;
    if (item.seller && !isSeller) return false;
    if (item.hideWhenSeller && isSeller) return false;
    return true;
  });
}

/**
 * Returns the account menu for the viewer's role. Sellers get the seller menu
 * (with their buyer-side purchases appended); everyone else gets the buyer
 * menu.
 */
export function accountMenuFor(viewer) {
  if (viewer.isSeller) {
    return [
      { id: 'seller', label: 'Seller', items: visibleItems(SELLER_ACCOUNT_MENU, viewer) },
      { id: 'buying', label: 'Buying', items: visibleItems(SELLER_BUYER_EXTRAS, viewer) },
    ];
  }
  return [{ id: 'buyer', label: null, items: visibleItems(BUYER_ACCOUNT_MENU, viewer) }];
}
