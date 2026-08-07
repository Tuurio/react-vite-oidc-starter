import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { User } from "oidc-client-ts";
import { authManager, fetchUserInfo, handleCallback, login, logout } from "./auth";

type AuthContextValue = {
  user: User | null;
  profile: Record<string, unknown> | null;
  loading: boolean;
  error: string | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  handleCallback: () => Promise<User>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    authManager
      .getUser()
      .then(async (currentUser) => {
        if (!active) return;
        if (currentUser && isUserExpired(currentUser)) {
          authManager.removeUser().catch(() => undefined);
          setUser(null);
          setProfile(null);
        } else {
          setUser(currentUser);
          if (currentUser?.access_token) {
            try {
              const info = await fetchUserInfo(currentUser.access_token);
              if (active) setProfile(info);
            } catch {
              if (active) setProfile(null);
            }
          }
        }
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load session.");
        setLoading(false);
      });

    const onUserLoaded = (loadedUser: User) => {
      if (isUserExpired(loadedUser)) {
        authManager.removeUser().catch(() => undefined);
        setUser(null);
        setProfile(null);
        return;
      }
      setUser(loadedUser);
      setError(null);
      if (loadedUser.access_token) {
        fetchUserInfo(loadedUser.access_token)
          .then((info) => setProfile(info))
          .catch(() => setProfile(null));
      }
    };
    const onUserUnloaded = () => {
      setUser(null);
      setProfile(null);
    };
    const onAccessTokenExpired = () => {
      authManager.removeUser().catch(() => undefined);
      setUser(null);
      setProfile(null);
    };

    authManager.events.addUserLoaded(onUserLoaded);
    authManager.events.addUserUnloaded(onUserUnloaded);
    authManager.events.addAccessTokenExpired(onAccessTokenExpired);

    return () => {
      active = false;
      authManager.events.removeUserLoaded(onUserLoaded);
      authManager.events.removeUserUnloaded(onUserUnloaded);
      authManager.events.removeAccessTokenExpired(onAccessTokenExpired);
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      loading,
      error,
      login: async () => {
        setError(null);
        try {
          await login();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Unable to start sign-in.");
        }
      },
      logout: async () => {
        setError(null);
        await logout();
      },
      handleCallback: async () => {
        setError(null);
        const signedInUser = await handleCallback();
        setUser(signedInUser);
        if (signedInUser.access_token) {
          try {
            const info = await fetchUserInfo(signedInUser.access_token);
            setProfile(info);
          } catch {
            setProfile(null);
          }
        }
        return signedInUser;
      },
    }),
    [user, profile, loading, error],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function isUserExpired(currentUser: User) {
  if (!currentUser.expires_at) return false;
  return currentUser.expires_at <= Math.floor(Date.now() / 1000);
}

// Context hooks intentionally live beside their provider to keep this small starter self-contained.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider.");
  }
  return context;
}
