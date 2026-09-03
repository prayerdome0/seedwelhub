import Image from './Image';
import { initials } from '../utils/format';

export default function Avatar({ src, name = '', size = 'md', className = '' }) {
  if (src) {
    return <Image src={src} alt={name} className={`avatar avatar--${size} ${className}`} fallback={initials(name)} />;
  }
  return <div className={`avatar avatar--${size} avatar--text ${className}`}>{initials(name)}</div>;
}
