import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { subscribeToAuth, getCurrentUser } from '../firebase/auth';
import { getUser, ensureUserDocument } from '../services/userService';
import { DEFAULT_ROLE } from '../utils/constants';

const AuthContext = createContext({ user: null, profile: null, loading: true });

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // Firebase Auth user
  const [profile, setProfile] = useState(null); // Firestore user document
  const [loading, setLoading] = useState(true);

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
    const unsubscribe = subscribeToAuth(async (firebaseUser) => {
      if (firebaseUser) {
        const doc = await loadProfile(firebaseUser);
        // Keep emailVerified in sync with the Auth user on the Firestore doc.
        if (doc && doc.emailVerified !== firebaseUser.emailVerified) {
          getUser(firebaseUser.uid)
            .then(() => {})
            .catch(() => {});
        }
        setUser(firebaseUser);
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, [loadProfile]);

  const refreshProfile = useCallback(async () => {
    const firebaseUser = getCurrentUser();
    if (!firebaseUser) {
      setProfile(null);
      return null;
    }
    return loadProfile(firebaseUser);
  }, [loadProfile]);

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
