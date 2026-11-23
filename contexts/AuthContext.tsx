"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  type User as FirebaseUser,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { getFirebaseAuth, getDb } from "@/lib/firebase";
import type { SPMUser, UserRole } from "@/types";

interface AuthContextValue {
  user: SPMUser | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  redirectError: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signUp: (name: string, email: string, password: string, phone?: string) => Promise<void>;
  signOut: () => Promise<void>;
  hasRole: (minimum: UserRole) => boolean;
}

const ROLE_WEIGHTS: Record<UserRole, number> = {
  viewer: 1,
  mecanico: 2,
  operador: 3,
  manager: 4,
  admin: 5,
};

const AuthContext = createContext<AuthContextValue | null>(null);

function setAuthPresenceCookie(uid: string) {
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `__auth=${encodeURIComponent(uid)}; path=/; expires=${expires}; SameSite=Lax`;
}

function clearAuthPresenceCookie() {
  document.cookie = "__auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
}

async function syncSessionCookie(fbUser: FirebaseUser): Promise<void> {
  try {
    const idToken = await fbUser.getIdToken();
    const res = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
    if (!res.ok) {
      console.warn(`[Auth] Session cookie endpoint returned ${res.status} — using fallback cookie`);
    }
  } catch (err) {
    console.warn("[Auth] Session cookie sync failed — using fallback cookie:", err);
  }
}

async function clearSessionCookie(): Promise<void> {
  try {
    await fetch("/api/auth/session", { method: "DELETE" });
  } catch {
    // best-effort
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SPMUser | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [redirectError, setRedirectError] = useState<string | null>(null);
  // Datos capturados en el registro, usados al crear el documento users/{uid}
  const pendingProfile = useRef<{ name: string; phone?: string } | null>(null);

  useEffect(() => {
    const auth = getFirebaseAuth();
    let unsubscribe: (() => void) | null = null;

    /**
     * Initialization sequence (order is critical):
     *
     * 1. authStateReady() — waits until the CACHED auth state is known
     *    (existing session from localStorage/IndexedDB). Does NOT wait for
     *    signInWithRedirect to complete.
     *
     * 2. getRedirectResult() — MUST be awaited BEFORE registering
     *    onAuthStateChanged. Firebase does not complete the redirect sign-in
     *    until this is called. If called after onAuthStateChanged, the listener
     *    fires with null first (redirect still pending), causing a login loop.
     *    Calling it unconditionally is safe: returns null when no redirect is
     *    pending and handles cases where sessionStorage was cleared.
     *
     * 3. onAuthStateChanged — by this point the auth state is definitive:
     *    the redirect (if any) is processed and the user is either signed in
     *    or not. The listener fires exactly once with the correct state.
     */
    async function initialize() {
      await auth.authStateReady();

      // Process any pending signInWithRedirect result.
      // Called unconditionally — safe if no redirect is pending (returns null).
      const redirectPending = sessionStorage.getItem("spm_auth_redirect") === "1";
      try {
        await getRedirectResult(auth);
        if (redirectPending) sessionStorage.removeItem("spm_auth_redirect");
      } catch (err: unknown) {
        if (redirectPending) sessionStorage.removeItem("spm_auth_redirect");
        const code = (err as { code?: string })?.code ?? "auth/unknown";
        if (code !== "auth/no-auth-event") {
          setRedirectError(code);
        }
      }

      // Auth state is now definitive — register the listener.
      unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
        setFirebaseUser(fbUser);
        if (fbUser) {
          setAuthPresenceCookie(fbUser.uid);
          try { await syncSessionCookie(fbUser); } catch { /* non-fatal */ }
          try {
            const spmUser = await fetchOrCreateUser(fbUser);
            setUser(spmUser);
          } catch (err) {
            console.error("[Auth] fetchOrCreateUser failed:", err);
            setUser({
              id: fbUser.uid,
              uid: fbUser.uid,
              email: fbUser.email ?? "",
              displayName: fbUser.displayName ?? fbUser.email ?? "Usuario",
              role: "viewer",
              isActive: true,
              ...(fbUser.photoURL ? { photoURL: fbUser.photoURL } : {}),
            } as import("@/types").SPMUser);
          }
        } else {
          clearAuthPresenceCookie();
          setUser(null);
        }
        setLoading(false);
      });
    }

    initialize();

    return () => { if (unsubscribe) unsubscribe(); };
  }, []);

  async function fetchOrCreateUser(fbUser: FirebaseUser): Promise<SPMUser> {
    const db = getDb();
    const ref = doc(db, "users", fbUser.uid);
    const snap = await getDoc(ref);

    if (snap.exists()) {
      const data = snap.data();
      await setDoc(ref, { lastLogin: serverTimestamp() }, { merge: true });
      return { id: snap.id, ...data } as SPMUser;
    }

    const pending = pendingProfile.current;
    pendingProfile.current = null;

    const newUser: Omit<SPMUser, "id"> = {
      uid: fbUser.uid,
      email: fbUser.email ?? "",
      displayName: pending?.name || fbUser.displayName || fbUser.email || "Usuario",
      ...(pending?.phone ? { phone: pending.phone } : {}),
      role: "viewer",
      // undefined is valid for the TypeScript type but Firestore rejects it —
      // keep it undefined in the object but exclude it from the Firestore doc below
      ...(fbUser.photoURL ? { photoURL: fbUser.photoURL } : {}),
      isActive: true,
    };

    // Strip undefined/null optional fields before writing to Firestore
    const docData: Record<string, unknown> = {
      uid: newUser.uid,
      email: newUser.email,
      displayName: newUser.displayName,
      role: newUser.role,
      isActive: newUser.isActive,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastLogin: serverTimestamp(),
    };
    if (newUser.photoURL) docData.photoURL = newUser.photoURL;
    if (newUser.phone) docData.phone = newUser.phone;

    await setDoc(ref, docData);

    return { id: fbUser.uid, ...newUser };
  }

  async function signIn(email: string, password: string) {
    const auth = getFirebaseAuth();
    await signInWithEmailAndPassword(auth, email, password);
  }

  /**
   * Registro de cliente con correo y contraseña. El documento users/{uid}
   * se crea con role "viewer" en fetchOrCreateUser (vía onAuthStateChanged).
   */
  async function signUp(name: string, email: string, password: string, phone?: string) {
    const auth = getFirebaseAuth();
    pendingProfile.current = { name: name.trim(), ...(phone?.trim() ? { phone: phone.trim() } : {}) };
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: name.trim() }).catch(() => { /* non-fatal */ });
    } catch (err) {
      pendingProfile.current = null;
      throw err;
    }
  }

  /**
   * Sign in with Google.
   *
   * Strategy: popup on desktop, redirect fallback on mobile / if popup blocked.
   *
   * WHY popup (not redirect):
   *   signInWithRedirect stores the auth result in Firebase's domain
   *   (sanpedromotocare.firebaseapp.com). Our app runs at spm-platform.vercel.app.
   *   Modern browsers (Safari ITP, Chrome storage partitioning) block cross-origin
   *   IndexedDB access from third-party iframes, so getRedirectResult() returns null
   *   → infinite loop back to /login.
   *
   * WHY popup works without COOP header:
   *   The blank screen was caused by our COOP: same-origin-allow-popups conflicting
   *   with Google's COOP: same-origin. Chrome isolated the popup's browsing context,
   *   making window.opener null. We removed that header — now the popup communicates
   *   the auth result back to the opener correctly via postMessage (same browsing context).
   */
  async function signInWithGoogle() {
    const auth     = getFirebaseAuth();
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });

    try {
      await signInWithPopup(auth, provider);
      // Auth result is delivered synchronously via onAuthStateChanged — no redirect needed
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code ?? "";
      if (
        code === "auth/popup-blocked" ||
        code === "auth/popup-closed-by-user" ||
        code === "auth/cancelled-popup-request" ||
        code === "auth/operation-not-supported-in-this-environment"
      ) {
        // Mobile or popup blocked — fall back to redirect
        sessionStorage.setItem("spm_auth_redirect", "1");
        await signInWithRedirect(auth, provider);
      } else {
        throw err;
      }
    }
  }

  async function signOut() {
    const auth = getFirebaseAuth();
    await firebaseSignOut(auth);
    clearAuthPresenceCookie();
    await clearSessionCookie();
    setUser(null);
    setFirebaseUser(null);
  }

  function hasRole(minimum: UserRole): boolean {
    if (!user) return false;
    return ROLE_WEIGHTS[user.role] >= ROLE_WEIGHTS[minimum];
  }

  return (
    <AuthContext.Provider
      value={{ user, firebaseUser, loading, redirectError, signIn, signInWithGoogle, signUp, signOut, hasRole }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
