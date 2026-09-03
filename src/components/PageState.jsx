// A single component for the required page states: loading, empty, error,
// success/not-found. Keeps the "every page must have states" rule consistent.
import Spinner from './Spinner';
import { WATERMARK_LOGO } from '../assets';

export function LoadingState({ label = 'Loading…' }) {
  return (
    <div className="page-state">
      <Spinner size="large" label={label} />
    </div>
  );
}

export function EmptyState({ title = 'Nothing here yet', message = '', action }) {
  return (
    <div className="page-state page-state--empty">
      <div className="empty-illustration" aria-hidden="true">
        <img src={WATERMARK_LOGO} alt="" />
      </div>
      <h3 className="page-state__title">{title}</h3>
      {message && <p className="page-state__message">{message}</p>}
      {action && <div className="page-state__action">{action}</div>}
    </div>
  );
}

export function ErrorState({ message = 'Something went wrong.', onRetry, title = 'Something went wrong' }) {
  return (
    <div className="page-state page-state--error">
      <div className="error-icon" aria-hidden="true">
        !
      </div>
      <h3 className="page-state__title">{title}</h3>
      <p className="page-state__message">{message}</p>
      {onRetry && (
        <button type="button" className="btn btn--primary" onClick={onRetry}>
          Try Again
        </button>
      )}
    </div>
  );
}

export function NotFoundState({ title = 'Not found', message = 'The item you are looking for does not exist.', action }) {
  return (
    <div className="page-state">
      <h3 className="page-state__title">{title}</h3>
      <p className="page-state__message">{message}</p>
      {action && <div className="page-state__action">{action}</div>}
    </div>
  );
}

export default function PageState({ status, ...props }) {
  if (status === 'loading') return <LoadingState label={props.label} />;
  if (status === 'error') return <ErrorState message={props.message} onRetry={props.onRetry} />;
  if (status === 'empty') return <EmptyState title={props.title} message={props.message} action={props.action} />;
  if (status === 'notfound') return <NotFoundState title={props.title} message={props.message} action={props.action} />;
  return props.children;
}
