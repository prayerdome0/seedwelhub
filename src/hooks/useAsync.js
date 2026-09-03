import { useCallback, useEffect, useRef, useState } from 'react';
import { friendlyError } from '../utils/firebaseErrors';

// A small, reusable async-loading hook that enforces loading / error / data
// states for every Firebase-backed page, and guards against state updates after
// unmount.
export default function useAsync(loader, dependencies = []) {
  const [state, setState] = useState({
    loading: true,
    error: null,
    data: null,
    success: false,
  });
  const isMounted = useRef(true);
  const requestId = useRef(0);

  const run = useCallback(() => {
    const currentRequest = ++requestId.current;
    setState((prev) => ({ ...prev, loading: true, error: null }));
    Promise.resolve(typeof loader === 'function' ? loader() : loader)
      .then((data) => {
        if (!isMounted.current || currentRequest !== requestId.current) return;
        setState({ loading: false, error: null, data, success: true });
      })
      .catch((err) => {
        if (!isMounted.current || currentRequest !== requestId.current) return;
        setState({
          loading: false,
          error: friendlyError(err),
          data: null,
          success: false,
        });
      });
  }, [loader]);

  useEffect(() => {
    isMounted.current = true;
    run();
    return () => {
      isMounted.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencies]);

  const retry = useCallback(() => {
    run();
  }, [run]);

  return { ...state, loading: state.loading, retry };
}
