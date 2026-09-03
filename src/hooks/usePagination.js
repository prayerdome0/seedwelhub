import { useCallback, useEffect, useRef, useState } from 'react';
import { friendlyError } from '../utils/firebaseErrors';

// Simple cursor-based pagination hook backed by a loader function that accepts
// `{ cursor }` and returns `{ docs, nextCursor, done }`.
export default function usePagination(loader, dependencies = [], { pageSize = 12 } = {}) {
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  const isMounted = useRef(true);

  const loadFirst = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.resolve(loader({ cursor: null, pageSize }))
      .then((res) => {
        if (!isMounted.current) return;
        setItems(res.docs || []);
        setCursor(res.nextCursor || null);
        setDone(Boolean(res.done));
      })
      .catch((err) => {
        if (!isMounted.current) return;
        setError(friendlyError(err));
      })
      .finally(() => {
        if (isMounted.current) setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencies]);

  useEffect(() => {
    isMounted.current = true;
    loadFirst();
    return () => {
      isMounted.current = false;
    };
  }, [loadFirst]);

  const loadMore = useCallback(() => {
    if (loadingMore || done || loading) return;
    setLoadingMore(true);
    Promise.resolve(loader({ cursor, pageSize }))
      .then((res) => {
        if (!isMounted.current) return;
        setItems((prev) => [...prev, ...(res.docs || [])]);
        setCursor(res.nextCursor || null);
        setDone(Boolean(res.done));
      })
      .catch((err) => {
        if (isMounted.current) setError(friendlyError(err));
      })
      .finally(() => {
        if (isMounted.current) setLoadingMore(false);
      });
  }, [loader, cursor, pageSize, done, loading, loadingMore]);

  const retry = useCallback(() => {
    setItems([]);
    setCursor(null);
    setDone(false);
    loadFirst();
  }, [loadFirst]);

  return { items, loading, loadingMore, error, done, loadMore, retry };
}
