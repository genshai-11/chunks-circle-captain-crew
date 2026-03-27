import { ReactNode, createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  AuthError,
  User,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { hydrateAdminRuntimeConfigFromCloud } from '@/services/adminConfigRepository';

interface AdminAuthContextValue {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  adminEmails: string[];
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  sendReset: (email: string) => Promise<void>;
  signOutAdmin: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function parseAdminEmails() {
  const raw = import.meta.env.VITE_ADMIN_EMAILS || 'lucy2511kh@gmail.com';
  return raw.split(',').map(normalizeEmail).filter(Boolean);
}

function mapAuthError(error: unknown) {
  const authError = error as Partial<AuthError> | undefined;
  if (authError?.code === 'auth/configuration-not-found') {
    return new Error('Firebase Authentication chưa được cấu hình hoàn chỉnh. Vào Firebase Console → Authentication → Sign-in method và bật Email/Password.');
  }
  if (authError?.code === 'auth/operation-not-allowed') {
    return new Error('Email/Password sign-in đang bị tắt trong Firebase Console. Hãy bật Authentication → Sign-in method → Email/Password.');
  }
  if (authError?.code === 'auth/user-not-found') {
    return new Error('Admin account not found for that email.');
  }
  return error instanceof Error ? error : new Error('Admin authentication failed.');
}

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const adminEmails = useMemo(() => parseAdminEmails(), []);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    return onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      if (nextUser?.email && adminEmails.includes(normalizeEmail(nextUser.email))) {
        await hydrateAdminRuntimeConfigFromCloud();
      }
      setLoading(false);
    });
  }, [adminEmails]);

  const ensureAllowed = (email: string) => {
    if (!adminEmails.includes(normalizeEmail(email))) {
      throw new Error('This email is not allowed for admin access.');
    }
  };

  const signIn = async (email: string, password: string) => {
    if (!auth) throw new Error('Firebase Auth is not configured.');
    ensureAllowed(email);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      throw mapAuthError(error);
    }
  };

  const signUp = async (email: string, password: string) => {
    if (!auth) throw new Error('Firebase Auth is not configured.');
    ensureAllowed(email);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (error) {
      throw mapAuthError(error);
    }
  };

  const sendReset = async (email: string) => {
    if (!auth) throw new Error('Firebase Auth is not configured.');
    ensureAllowed(email);
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      throw mapAuthError(error);
    }
  };

  const signOutAdmin = async () => {
    if (!auth) return;
    await signOut(auth);
  };

  const value: AdminAuthContextValue = {
    user,
    loading,
    isAdmin: !!user?.email && adminEmails.includes(normalizeEmail(user.email)),
    adminEmails,
    signIn,
    signUp,
    sendReset,
    signOutAdmin,
  };

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within AdminAuthProvider');
  }
  return context;
}
