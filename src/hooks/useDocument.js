import { useCallback, useEffect, useRef, useState } from 'react';
import { friendlyError } from '../utils/firebaseErrors';

// Loads a single Firestore document (by id) with loading / error / not-found
// states, and provides a retry.
export default function useDocument(loader, id, dependencies = []) {
  const [state, setState] = useState({
    loading: true,
    error: null,
    data: null,
    notFound: false,
  });
  const isMounted = useRef(true);
  const requestId = useRef(0);

  const run = useCallback(() => {
    if (!id) {
      setState({ loading: false, error: null, data: null, notFound: true });
      return;
    }
    const currentRequest = ++requestId.current;
    setState((prev) => ({ ...prev, loading: true, error: null, notFound: false }));
    Promise.resolve(loader(id))
      .then((data) => {
        if (!isMounted.current || currentRequest !== requestId.current) return;
        if (!data) {
          setState({ loading: false, error: null, data: null, notFound: true });
        } else {
          setState({ loading: false, error: null, data, notFound: false });
        }
      })
      .catch((err) => {
        if (!isMounted.current || currentRequest !== requestId.current) return;
        setState({
          loading: false,
          error: friendlyError(err),
          data: null,
          notFound: false,
        });
      });
  }, [id, loader]);

  useEffect(() => {
    isMounted.current = true;
    run();
    return () => {
      isMounted.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencies, id, run]);

  const retry = useCallback(() => run(), [run]);

  return { ...state, loading: state.loading, retry };
}
