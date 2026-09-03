import { Link, useNavigate } from 'react-router-dom';
import Drawer from '../Drawer';
import MenuLink from './MenuLink';
import Avatar from '../Avatar';
import { REAL_LOGO } from '../../assets';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { logout } from '../../firebase/auth';
import { MAIN_MENU, visibleItems } from '../../navigation/menus';
import { APP_NAME } from '../../utils/constants';

// The main application menu, opened by the ☰ icon in the header.
// Account and Settings live in the final, visually separated group at the
// bottom, with Sign Out pinned in the drawer footer.
export default function MainMenuDrawer({ open, onClose }) {
  const { user, profile, isAdmin, isSeller, isVerifiedSeller } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const viewer = {
    isAuthenticated: Boolean(user),
    isSeller,
    isVerifiedSeller,
    isAdmin,
  };

  const groups = MAIN_MENU.map((group) => ({
    ...group,
    items: visibleItems(group.items, viewer),
  })).filter((group) => group.items.length > 0);

  const handleSignOut = async () => {
    try {
      await logout();
      showToast('Signed out.', 'success');
    } catch {
      /* signing out locally is enough for the UI */
    }
    onClose();
    navigate('/');
  };

  const header = (
    <Link to="/" className="drawer__brand" onClick={onClose}>
      <img src={REAL_LOGO} alt="" className="drawer__brand-logo" />
      <span className="drawer__title" id="drawer-title">{APP_NAME}</span>
    </Link>
  );

  const footer = user ? (
    <button type="button" className="menu-link menu-link--danger" onClick={handleSignOut}>
      <span className="menu-link__icon" aria-hidden="true">🚪</span>
      <span className="menu-link__label">Sign Out</span>
    </button>
  ) : (
    <div className="drawer__auth">
      <Link to="/login" className="btn btn--outline btn--block" onClick={onClose}>Log In</Link>
      <Link to="/register" className="btn btn--primary btn--block" onClick={onClose}>Sign Up</Link>
    </div>
  );

  return (
    <Drawer open={open} onClose={onClose} header={header} footer={footer} side="left">
      {user && (
        <Link to="/account" className="drawer__identity" onClick={onClose}>
          <Avatar src={profile?.photoURL} name={profile?.name || user.email} size="md" />
          <div className="drawer__identity-text">
            <span className="drawer__identity-name">{profile?.name || 'My account'}</span>
            <span className="drawer__identity-mail">{user.email}</span>
          </div>
        </Link>
      )}

      <nav className="drawer__nav">
        {groups.map((group) => (
          <div
            key={group.id}
            className={`drawer__group ${group.separated ? 'drawer__group--separated' : ''}`}
          >
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
