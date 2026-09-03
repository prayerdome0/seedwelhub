import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { subscribeToAuth, getCurrentUser } from '../firebase/auth';
import {
  getUser,
  ensureUserDocument,
  subscribeToUserDoc,
  updateUser,
} from '../services/userService';
import { DEFAULT_ROLE } from '../utils/constants';

const AuthContext = createContext({ user: null, profile: null, loading: true });

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // Firebase Auth user
  const [profile, setProfile] = useState(null); // Firestore user document
  const [loading, setLoading] = useState(true);

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

  const refreshProfile = useCallback(async () => {
    const firebaseUser = getCurrentUser();
    if (!firebaseUser) {
      setProfile(null);
      return null;
    }
    return loadProfile(firebaseUser);
  }, [loadProfile]);

  // The role lives on the Firestore users document; the realtime subscription
  // above keeps it current while signed in.
  const role = profile?.role || DEFAULT_ROLE;
  const isAdmin = role === 'admin';

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        role,
        isAdmin,
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
