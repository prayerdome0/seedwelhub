import Badge from './Badge';
import { statusTone } from '../utils/format';

export default function StatusBadge({ status, label }) {
  return <Badge tone={statusTone(status)}>{label || status || '—'}</Badge>;
}
