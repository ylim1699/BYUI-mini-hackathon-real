import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { USE_MOCKS } from "../../services/supabase";
import { Icon, type IconName } from "../ui/Icon";
import { Toaster } from "../ui";

const NAV: { to: string; label: string; icon: IconName }[] = [
  { to: "/add", label: "Add classes", icon: "add" },
  { to: "/review", label: "Review items", icon: "review" },
  { to: "/study", label: "Study time", icon: "book" },
  { to: "/calendar", label: "Calendar", icon: "calendar" },
  { to: "/sync", label: "Reminders and sync", icon: "bell" },
  { to: "/trash", label: "Recently deleted", icon: "trash" },
];

/** Sidebar stays the window's height and never stretches with the page. */
export function AppLayout() {
  const { signOut, linkError } = useAuth();
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <nav aria-label="Main" className="z-20 flex shrink-0 items-center gap-1 border-b border-line bg-rail px-2 py-2 md:sticky md:top-0 md:h-screen md:w-[68px] md:flex-col md:border-b-0 md:border-r md:py-4">
        <div className="mr-2 grid h-9 w-9 place-items-center rounded-lg bg-primary text-sm font-extrabold text-on-primary md:mb-4 md:mr-0">SP</div>
        <div className="flex flex-1 gap-1 overflow-x-auto md:flex-col md:overflow-visible">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} aria-label={n.label}
              className={({ isActive }) => `group relative grid h-11 w-11 shrink-0 place-items-center rounded-xl transition ${isActive ? "bg-surface-3 text-text" : "text-muted hover:bg-surface-2 hover:text-text"}`}>
              <Icon name={n.icon} size={20} />
              <span className="pointer-events-none absolute left-[54px] top-1/2 z-30 hidden -translate-y-1/2 whitespace-nowrap rounded-md bg-surface-3 px-2.5 py-1 text-xs font-bold text-text opacity-0 shadow-card transition group-hover:opacity-100 group-focus-visible:opacity-100 md:block">
                {n.label}
              </span>
            </NavLink>
          ))}
        </div>
        <button onClick={signOut} aria-label="Sign out" title="Sign out" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-muted hover:bg-surface-2 hover:text-text">
          <Icon name="logout" size={20} />
        </button>
      </nav>
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8">
        {USE_MOCKS && (
          <p className="mb-4 rounded-lg border border-line bg-surface px-3 py-2 text-xs font-bold text-text-2">
            Demo mode: sample data, nothing is saved or sent anywhere.
          </p>
        )}
        {linkError && <p role="alert" className="mb-4 rounded-lg border border-warn-line bg-warn-bg px-3 py-2 text-sm font-bold text-warn">{linkError}</p>}
        <div className="anim-page mx-auto max-w-6xl"><Outlet /></div>
      </main>
      <Toaster />
    </div>
  );
}
