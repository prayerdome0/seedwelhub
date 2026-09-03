import { useEffect, useState } from 'react';

// Debounces a rapidly-changing value (used for search inputs to avoid hammering
// Firestore on every keystroke).
export default function useDebounce(value, delay = 400) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
