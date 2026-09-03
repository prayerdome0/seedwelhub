import { useNavigate } from 'react-router-dom';
import Drawer from '../Drawer';
import MenuLink from './MenuLink';
import Avatar from '../Avatar';
import Badge from '../Badge';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { logout } from '../../firebase/auth';
import { accountMenuFor } from '../../navigation/menus';

// The account menu. Opened from the account button in the header and from the
// menu icon on the Account page, so the account area stays clean instead of
// dumping every section onto one screen.
export default function AccountMenuDrawer({ open, onClose }) {
  const { user, profile, isAdmin, isSeller, isVerifiedSeller } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  if (!user) return null;

  const viewer = {
    isAuthenticated: true,
    isSeller,
    isVerifiedSeller,
    isAdmin,
  };
  const groups = accountMenuFor(viewer).filter((group) => group.items.length > 0);

  const handleSignOut = async () => {
    try {
      await logout();
      showToast('Signed out.', 'success');
    } catch {
      /* ignore */
    }
    onClose();
    navigate('/');
  };

  const header = (
    <div className="drawer__identity drawer__identity--head">
      <Avatar src={profile?.photoURL} name={profile?.name || user.email} size="md" />
      <div className="drawer__identity-text">
        <span className="drawer__identity-name" id="drawer-title">
          {profile?.name || 'My account'}
        </span>
        <span className="drawer__identity-mail">{user.email}</span>
      </div>
    </div>
  );

  const footer = (
    <button type="button" className="menu-link menu-link--danger" onClick={handleSignOut}>
      <span className="menu-link__icon" aria-hidden="true">🚪</span>
      <span className="menu-link__label">Sign Out</span>
    </button>
  );

  return (
    <Drawer open={open} onClose={onClose} header={header} footer={footer} side="right">
      <div className="drawer__roles">
        <Badge tone={isSeller ? 'success' : 'neutral'}>{isSeller ? 'Seller' : 'Buyer'}</Badge>
        {isSeller && !isVerifiedSeller && <Badge tone="warning">Verification pending</Badge>}
        {isVerifiedSeller && !isAdmin && <Badge tone="success">Verified</Badge>}
        {isAdmin && <Badge tone="navy">Admin</Badge>}
      </div>

      <nav className="drawer__nav">
        {groups.map((group) => (
          <div key={group.id} className="drawer__group">
            {group.label && <p className="drawer__group-label">{group.label}</p>}
            {group.items.map((item) => (
              <MenuLink key={item.id} item={item} onNavigate={onClose} />
            ))}
          </div>
        ))}
      </nav>
    </Drawer>
  );
}
