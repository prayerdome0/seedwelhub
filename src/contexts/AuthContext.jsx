import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { subscribeToAuth, getCurrentUser } from '../firebase/auth';
import {
  getUser,
  ensureUserDocument,
  subscribeToUserDoc,
  updateUser,
} from '../services/userService';
import { getBusinessesByOwner } from '../services/businessService';
import { DEFAULT_ROLE } from '../utils/constants';

const AuthContext = createContext({ user: null, profile: null, loading: true });

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // Firebase Auth user
  const [profile, setProfile] = useState(null); // Firestore user document
  const [loading, setLoading] = useState(true);
  // Businesses owned by the signed-in user. These drive the seller experience:
  // owning at least one business makes someone a seller, and a business with
  // `isVerified` makes them an authorized seller (which is what gates the
  // Seller Dashboard entry in the account menu).
  const [businesses, setBusinesses] = useState([]);
  const [businessesLoading, setBusinessesLoading] = useState(true);
  const [businessRefreshKey, setBusinessRefreshKey] = useState(0);

  // One-time read used as a fallback when the realtime listener errors, and by
  // refreshProfile() after explicit profile edits.
  const loadProfile = useCallback(async (firebaseUser) => {
    const doc = await getUser(firebaseUser.uid).catch(() => null);
    if (doc) {
      setProfile(doc);
      return doc;
    }
    // Reconcile the Firestore document if missing (e.g. first login after signup).
    const created = await ensureUserDocument(firebaseUser.uid, {
      email: firebaseUser.email,
      name: firebaseUser.displayName || '',
      photoURL: firebaseUser.photoURL || '',
    }).catch(() => null);
    setProfile(created);
    return created;
  }, []);

  useEffect(() => {
    let unsubProfile = () => {};
    let currentUid = null;
    let createdDocFor = null; // uid we already attempted doc creation for

    const unsubscribe = subscribeToAuth((firebaseUser) => {
      if (!firebaseUser) {
        unsubProfile();
        unsubProfile = () => {};
        currentUid = null;
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      setUser(firebaseUser);

      // Auth state can re-emit for the same user (e.g. after email
      // verification) — only (re)subscribe when the signed-in user changes.
      if (currentUid === firebaseUser.uid) {
        setLoading(false);
        return;
      }
      currentUid = firebaseUser.uid;

      // Realtime subscription to the user's own Firestore document, so any
      // change made there — most importantly being assigned `role: 'admin'` —
      // is detected immediately, without logging out and back in. This is
      // what drives the Admin tab, the /admin route guard and admin-only UI.
      unsubProfile();
      unsubProfile = subscribeToUserDoc(firebaseUser.uid, {
        onData: (doc) => {
          if (doc) {
            setProfile(doc);
            setLoading(false);
            // Keep emailVerified on the Firestore document in sync with the
            // authoritative Firebase Auth state.
            const authUser = getCurrentUser();
            if (
              authUser &&
              typeof doc.emailVerified === 'boolean' &&
              doc.emailVerified !== authUser.emailVerified
            ) {
              updateUser(firebaseUser.uid, { emailVerified: authUser.emailVerified }).catch(
                () => {}
              );
            }
            return;
          }

          // Document missing (first login after signup): create it once. The
          // listener then delivers the created document.
          if (createdDocFor === firebaseUser.uid) {
            setLoading(false);
            return;
          }
          createdDocFor = firebaseUser.uid;
          ensureUserDocument(firebaseUser.uid, {
            email: firebaseUser.email,
            name: firebaseUser.displayName || '',
            photoURL: firebaseUser.photoURL || '',
          })
            .catch(() => {})
            .finally(() => setLoading(false));
        },
        onError: () => {
          // Realtime read failed (permissions / offline) — fall back to a
          // one-time read so the app still works.
          loadProfile(firebaseUser).finally(() => setLoading(false));
        },
      });
    });

    return () => {
      unsubscribe();
      unsubProfile();
    };
  }, [loadProfile]);

  // Load the businesses this user owns, so the app knows whether to show the
  // seller experience. Failures degrade gracefully to "not a seller" rather
  // than blocking the UI.
  useEffect(() => {
    if (!user) {
      setBusinesses([]);
      setBusinessesLoading(false);
      return undefined;
    }
    let active = true;
    setBusinessesLoading(true);
    getBusinessesByOwner(user.uid)
      .then((list) => {
        if (active) setBusinesses(list || []);
      })
      .catch(() => {
        if (active) setBusinesses([]);
      })
      .finally(() => {
        if (active) setBusinessesLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user, businessRefreshKey]);

  const refreshProfile = useCallback(async () => {
    const firebaseUser = getCurrentUser();
    if (!firebaseUser) {
      setProfile(null);
      return null;
    }
    return loadProfile(firebaseUser);
  }, [loadProfile]);

  const refreshBusinesses = useCallback(() => {
    setBusinessRefreshKey((key) => key + 1);
  }, []);

  // The role lives on the Firestore users document; the realtime subscription
  // above keeps it current while signed in.
  const role = profile?.role || DEFAULT_ROLE;
  const isAdmin = role === 'admin';

  // Seller = owns at least one business. Verified/authorized seller = owns a
  // business an admin has verified. Admins always see seller tooling.
  const isSeller = isAdmin || businesses.length > 0;
  const isVerifiedSeller =
    isAdmin || businesses.some((business) => business.isVerified === true);
  const primaryBusiness = businesses[0] || null;

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        role,
        isAdmin,
        isSeller,
        isVerifiedSeller,
        businesses,
        businessesLoading,
        primaryBusiness,
        refreshBusinesses,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider.');
  }
  return context;
}
