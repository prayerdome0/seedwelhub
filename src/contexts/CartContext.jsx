import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'seedwel:cart:v1';
const CartContext = createContext(null);

function safeLine(item) {
  if (!item || !item.productId) return null;
  const stockValue = item.stock == null || item.stock === '' ? null : Number(item.stock);
  const stock = Number.isFinite(stockValue) && stockValue >= 0 ? Math.floor(stockValue) : null;
  return {
    productId: String(item.productId),
    name: String(item.name || 'Product'),
    price: Math.max(0, Number(item.price) || 0),
    currency: String(item.currency || 'ZMW'),
    quantity: Math.max(1, Math.floor(Number(item.quantity) || 1)),
    image: String(item.image || ''),
    unit: String(item.unit || 'piece'),
    stock,
    ownerId: String(item.ownerId || ''),
    businessId: String(item.businessId || ''),
    businessName: String(item.businessName || ''),
    location: String(item.location || ''),
    addedAt: Number(item.addedAt) || Date.now(),
  };
}

function readCart() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(safeLine).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function productToLine(product, quantity) {
  return safeLine({
    productId: product.id || product.productId,
    name: product.name,
    price: product.price,
    currency: product.currency || product.businessCurrency,
    quantity,
    image: product.image || product.images?.[0],
    unit: product.unit,
    stock: product.stock,
    ownerId: product.ownerId,
    businessId: product.businessId,
    businessName: product.businessName || product.sellerName,
    location: product.location,
    addedAt: Date.now(),
  });
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(readCart);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // The cart remains usable for this session if storage is unavailable.
    }
  }, [items]);

  const addItem = useCallback((product, quantity = 1) => {
    const incoming = productToLine(product, quantity);
    if (!incoming || incoming.stock === 0) return;
    incoming.quantity = incoming.stock == null ? incoming.quantity : Math.min(incoming.stock, incoming.quantity);
    setItems((current) => {
      const existing = current.find((item) => item.productId === incoming.productId);
      if (!existing) return [...current, incoming];
      const nextQuantity = existing.quantity + incoming.quantity;
      return current.map((item) => item.productId === incoming.productId
        ? { ...incoming, quantity: item.stock == null ? nextQuantity : Math.min(item.stock, nextQuantity), addedAt: item.addedAt }
        : item);
    });
  }, []);

  const setQuantity = useCallback((productId, quantity) => {
    const desired = Math.max(1, Math.floor(Number(quantity) || 1));
    setItems((current) => current.map((item) => {
      if (item.productId !== productId || item.stock === 0) return item;
      return { ...item, quantity: item.stock == null ? desired : Math.min(item.stock, desired) };
    }));
  }, []);

  const updateProduct = useCallback((product) => {
    const updated = productToLine(product, 1);
    if (!updated) return;
    setItems((current) => current.map((item) => {
      if (item.productId !== updated.productId) return item;
      const quantity = updated.stock == null ? item.quantity : Math.min(item.quantity, Math.max(1, updated.stock));
      return { ...updated, quantity, addedAt: item.addedAt };
    }));
  }, []);

  const removeItem = useCallback((productId) => {
    setItems((current) => current.filter((item) => item.productId !== productId));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const value = useMemo(() => ({
    items,
    count: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    addItem,
    setQuantity,
    updateProduct,
    removeItem,
    clearCart,
  }), [items, addItem, setQuantity, updateProduct, removeItem, clearCart]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within a CartProvider.');
  return context;
}
