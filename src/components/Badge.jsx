export default function Badge({ children, tone = 'neutral', className = '', title }) {
  return (
    <span className={`badge badge--${tone} ${className}`} title={title}>
      {children}
    </span>
  );
}
