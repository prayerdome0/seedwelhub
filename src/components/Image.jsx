import { useEffect, useRef, useState } from 'react';

// Lazy-loading image with a graceful placeholder. Uses the native loading="lazy"
// attribute plus an optional fade-in once the image actually loads.
export default function Image({ src, alt = '', className = '', fallback, ...props }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    setLoaded(false);
    setError(false);
  }, [src]);

  const handleError = () => {
    setError(true);
  };

  const handleLoad = () => setLoaded(true);

  if (error && fallback) {
    return <div className={`img-fallback ${className}`} role="img" aria-label={alt}>{fallback}</div>;
  }

  return (
    <div className={`img-wrap ${className}`}>
      <img
        ref={ref}
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={handleLoad}
        onError={handleError}
        className={loaded ? 'img img--loaded' : 'img'}
        {...props}
      />
    </div>
  );
}
