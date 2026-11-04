// Google sign-in through Supabase. Right after sign-in, Supabase hands the browser Google's
// refresh token once; we pass it to the backend, which stores it encrypted for calendar sync.
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "../services/api";
import { GOOGLE_SCOPES, supabase, USE_MOCKS } from "../services/supabase";
import { okSchema } from "../types/domain";

export interface AuthUser { id: string; email: string | null }
interface AuthState {
  loading: boolean;
  user: AuthUser | null;
  linkError: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);
const DEMO: AuthUser = { id: "demo", email: "demo@byui.edu" };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(!USE_MOCKS);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);

  useEffect(() => {
    if (USE_MOCKS || !supabase) { setLoading(false); return; }
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user;
      setUser(u ? { id: u.id, email: u.email ?? null } : null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      const u = session?.user;
      setUser(u ? { id: u.id, email: u.email ?? null } : null);
      const refresh = session?.provider_refresh_token;
      if (event === "SIGNED_IN" && refresh) {
        // Defer: Supabase recommends not awaiting other calls inside this callback.
        setTimeout(() => {
          api("/google/link", okSchema, { refresh_token: refresh })
            .then(() => setLinkError(null))
            .catch((e: unknown) => setLinkError(e instanceof Error ? e.message : "Couldn't connect Google Calendar."));
        }, 0);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = async () => {
    if (USE_MOCKS) { setUser(DEMO); return; }
    if (!supabase) return;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        scopes: GOOGLE_SCOPES,
        redirectTo: window.location.origin,
        // offline + consent makes Google return a refresh token every time
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
  };

  const signOut = async () => {
    if (supabase) await supabase.auth.signOut();
    setUser(null);
  };

  return <Ctx.Provider value={{ loading, user, linkError, signIn, signOut }}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be inside AuthProvider");
  return v;
}
