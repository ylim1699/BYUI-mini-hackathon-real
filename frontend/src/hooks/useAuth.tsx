// No account or Google sign-in: each browser gets its own private Supabase session
// (anonymous sign-in). Your data stays tied to this browser until you choose Start over.
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase, USE_MOCKS } from "../services/supabase";

export interface AuthUser { id: string }
interface AuthState {
  loading: boolean;
  user: AuthUser | null;
  /** True while the start screen is still finishing setup (connecting Canvas, importing). */
  holding: boolean;
  setHolding: (v: boolean) => void;
  start: () => Promise<void>;
  startOver: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);
const MOCK_KEY = "sp-mock-started";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(!USE_MOCKS);
  const [holding, setHolding] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(() => {
    if (!USE_MOCKS) return null;
    try { return sessionStorage.getItem(MOCK_KEY) ? { id: "demo" } : null; } catch { return null; }
  });

  useEffect(() => {
    if (USE_MOCKS || !supabase) { setLoading(false); return; }
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ? { id: data.session.user.id } : null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ? { id: session.user.id } : null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const start = async () => {
    if (USE_MOCKS) { try { sessionStorage.setItem(MOCK_KEY, "1"); } catch { /* ignore */ } setUser({ id: "demo" }); return; }
    if (!supabase) throw new Error("The app isn't set up yet: add the Supabase keys to .env.");
    const existing = (await supabase.auth.getSession()).data.session;
    if (existing) return;
    const { error } = await supabase.auth.signInAnonymously();
    if (error) throw new Error(error.message.includes("disabled") ? "Turn on anonymous sign-ins in Supabase (Authentication → Sign In / Providers)." : error.message);
  };

  const startOver = async () => {
    if (USE_MOCKS) { try { sessionStorage.removeItem(MOCK_KEY); } catch { /* ignore */ } setUser(null); return; }
    if (supabase) await supabase.auth.signOut();
    setUser(null);
  };

  return <Ctx.Provider value={{ loading, user, holding, setHolding, start, startOver }}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be inside AuthProvider");
  return v;
}
