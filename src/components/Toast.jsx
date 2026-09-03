export default function Toast({ toast, onDismiss }) {
  const type = toast.type || 'info';
  return (
    <div className={`toast toast--${type}`} role="alert">
      <span className="toast__icon" aria-hidden="true">
        {type === 'success' ? '✓' : type === 'error' ? '✕' : type === 'warning' ? '!' : 'ℹ'}
      </span>
      <span className="toast__message">{toast.message}</span>
      {toast.action && <button type="button" className="toast__action" onClick={toast.action.onClick}>{toast.action.label}</button>}
      {onDismiss && (
        <button type="button" className="toast__close" onClick={onDismiss} aria-label="Dismiss">
          ×
        </button>
      )}
    </div>
  );
}
