// Shared pieces, styled with the prototype's exact CSS strings.
import { useEffect, useRef, type ReactNode } from "react";
import { sx } from "../../lib/sx";
import { useUi } from "../../store/ui";

export const S = {
  card: "box-sizing: border-box; background: var(--surface); border: 1px solid var(--line); border-radius: 18px; backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);",
  primary: "min-height: 44px; padding: 0 22px; border: 0; border-radius: 22px; background: var(--primary-bg); color: var(--primary-text); font-size: 14px; font-weight: 700; cursor: pointer;",
  outline: "min-height: 44px; padding: 0 18px; border-radius: 22px; border: 1px solid var(--line-strong); background: transparent; color: var(--text); font-size: 14px; font-weight: 700; cursor: pointer;",
  smallSolid: "min-height: 38px; padding: 0 16px; border-radius: 19px; border: 0; background: var(--primary-bg); font-size: 13px; font-weight: 700; color: var(--primary-text); cursor: pointer;",
  smallOutline: "min-height: 38px; padding: 0 16px; border-radius: 19px; border: 1px solid var(--line-strong); background: transparent; font-size: 13px; font-weight: 700; color: var(--text); cursor: pointer;",
  field: "min-height: 44px; box-sizing: border-box; padding: 0 14px; border-radius: 22px; border: 1px solid var(--line-strong); background: var(--field); font-size: 14px; font-weight: 700; color: var(--text);",
  h1: "margin: 0; font-size: 28px; line-height: 1.15; font-weight: 800; letter-spacing: -0.02em;",
  lead: "margin: 0; font-size: 15px; line-height: 1.55; color: var(--text-2);",
  iconBtn: "width: 36px; height: 36px; flex-shrink: 0; border: 0; border-radius: 18px; background: var(--surface-2); color: var(--text); cursor: pointer; display: flex; align-items: center; justify-content: center;",
};

export const disabledStyle = " opacity: 0.5; cursor: not-allowed;";

/** Line icon, 24px grid. */
export function Ico({ d, size = 16, sw = 2, fill = "none", style }: { d: string; size?: number; sw?: number; fill?: string; style?: string }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth={sw}
      strokeLinecap="round" strokeLinejoin="round" style={style ? sx(style) : undefined}>
      <path d={d} />
    </svg>
  );
}

export const P = {
  x: "M6 6l12 12M18 6L6 18",
  plus: "M12 5v14M5 12h14",
  check: "M5 12.5l4.5 4.5L19 7.5",
  left: "M15 5l-7 7 7 7",
  right: "M9 5l7 7-7 7",
  trash: "M4.5 7h15M9.5 7V5a1.5 1.5 0 011.5-1.5h2A1.5 1.5 0 0114.5 5v2M6.5 7l1 12a2 2 0 002 1.8h5a2 2 0 002-1.8l1-12",
  trashSmall: "M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13",
  pencil: "M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4",
  clock: "M12 7.5V12l3 2M12 20.5a8.5 8.5 0 100-17 8.5 8.5 0 000 17z",
  alarm: "M12 20a7 7 0 100-14 7 7 0 000 14zM12 9.5V13l2.5 1.5M4 6.5L7 4M20 6.5L17 4",
  book: "M12 6.5C10.5 5.3 8.3 4.8 4.5 5v13c3.8-.2 6 .3 7.5 1.5 1.5-1.2 3.7-1.7 7.5-1.5V5c-3.8-.2-6 .3-7.5 1.5zM12 6.5v13",
  school: "M3.5 20h17M5.5 20v-9.5L12 6l6.5 4.5V20M10 20v-4.5h4V20M12 6V3.5h3",
  star: "M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z",
  warn: "M12 4l9 16H3zM12 10v4M12 17.2v.3",
  expand: "M14 4h6v6M20 4l-6.5 6.5M10 20H4v-6M4 20l6.5-6.5",
  collapse: "M20 4l-6.5 6.5M13.5 4.5v6h6M4 20l6.5-6.5M10.5 19.5v-6h-6",
  sparkle: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z",
  chart: "M4 19V10M10 19V5M16 19v-7M22 19H2",
  file: "M7 3h7l5 5v13H7zM14 3v5h5",
  upload: "M12 16V4M7 9l5-5 5 5M4 20h16",
  chevron: "M6 9l6 6 6-6",
  filter: "M4 6h16M7 12h10M10 18h4",
  screen: "M3.5 5h17v11h-17zM8 20h8M12 16v4",
  minus: "M5 12h14",
};

export function PageHead({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <header style={sx("display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 16px; padding-top: 6px;")}>
      <div style={sx("display: flex; flex-direction: column; gap: 6px; max-width: 640px;")}>
        <h1 style={sx(S.h1)}>{title}</h1>
        {sub && <p style={sx(S.lead)}>{sub}</p>}
      </div>
      {right}
    </header>
  );
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" style={sx("display: flex; align-items: center; gap: 10px; font-size: 14px; color: var(--text-2); padding: 20px 0;")}>
      <span className="spinner" />{label}…
    </div>
  );
}

export function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <p role="alert" style={sx("margin: 0; padding: 10px 14px; border-radius: 12px; background: var(--warn-bg); border: 1px solid var(--warn-line); color: var(--warn-text); font-size: 13px; font-weight: 700; line-height: 1.45;")}>
      {error instanceof Error ? error.message : String(error)}
    </p>
  );
}

export function SwitchTrack({ on }: { on: boolean }) {
  return (
    <span aria-hidden="true" style={sx("position: relative; width: 38px; height: 22px; flex-shrink: 0; border-radius: 11px; transition: background-color .2s ease; background: " + (on ? "var(--ok)" : "var(--surface-3)") + ";")}>
      <span style={sx("position: absolute; top: 3px; left: 3px; width: 16px; height: 16px; border-radius: 8px; background: #fff; transition: transform .2s cubic-bezier(.2,.8,.2,1);" + (on ? " transform: translateX(16px);" : ""))} />
    </span>
  );
}

function useDialogKeys(open: boolean, onClose: () => void, ref: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>("[data-autofocus], button, input, select, textarea")?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); prev?.focus?.(); };
  }, [open, onClose, ref]);
}

/** Backdrop + dialog box, as in the prototype. */
export function Modal({ open, label, onClose, children, box, z = 22, blur = false }: {
  open: boolean; label: string; onClose: () => void; children: ReactNode; box: string; z?: number; blur?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useDialogKeys(open, onClose, ref);
  if (!open) return null;
  return (
    <div className="anim-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      style={sx(`position: fixed; inset: 0; z-index: ${z}; display: flex; align-items: center; justify-content: center; padding: 16px; box-sizing: border-box; background: rgba(10,12,11,0.45);` + (blur ? " backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);" : ""))}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={label} className="anim-dialog" style={sx(box)}>{children}</div>
    </div>
  );
}

/** Every "are you sure" in the app. Safe actions use the primary button, deletes use red. */
export function Confirm({ open, title, body, yes, no, danger = false, onYes, onClose }: {
  open: boolean; title: string; body: ReactNode; yes: string; no?: string; danger?: boolean; onYes: () => void; onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useDialogKeys(open, onClose, ref);
  if (!open) return null;
  return (
    <div className="anim-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      style={sx("position: fixed; inset: 0; z-index: 25; display: flex; align-items: center; justify-content: center; padding: 16px; box-sizing: border-box; background: rgba(10,12,11,0.5);")}>
      <div ref={ref} role="alertdialog" aria-modal="true" aria-label={title} className="anim-dialog"
        style={sx("width: 100%; max-width: 400px; box-sizing: border-box; padding: 22px; display: flex; flex-direction: column; gap: 12px; border-radius: 20px; background: var(--panel); border: 1px solid var(--line-strong); box-shadow: var(--shadow); color: var(--text); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);")}>
        <h2 style={sx("margin: 0; font-size: 18px; line-height: 1.3; font-weight: 800;")}>{title}</h2>
        <div style={sx("margin: 0; font-size: 14px; line-height: 1.5; color: var(--text-2);")}>{body}</div>
        <div style={sx("display: flex; justify-content: flex-end; gap: 10px; padding-top: 6px;")}>
          <button type="button" onClick={onClose} style={sx("min-height: 42px; padding: 0 18px; border-radius: 21px; border: 1px solid var(--line-strong); background: transparent; color: var(--text); font-size: 14px; font-weight: 700; cursor: pointer;")}>
            {no ?? (danger ? "Keep it" : "Not yet")}
          </button>
          <button type="button" onClick={() => { onYes(); onClose(); }}
            style={sx("min-height: 42px; padding: 0 18px; border: 0; border-radius: 21px; font-size: 14px; font-weight: 700; cursor: pointer; " + (danger ? "background: var(--weekend); color: #fff;" : "background: var(--primary-bg); color: var(--primary-text);"))}>
            {yes}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Toaster() {
  const toast = useUi((s) => s.toast);
  const dismiss = useUi((s) => s.dismiss);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(dismiss, 6000);
    return () => clearTimeout(t);
  }, [toast, dismiss]);
  if (!toast) return null;
  return (
    <div role="status" key={toast.id} className="anim-toast"
      style={sx("position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%); z-index: 30; display: flex; align-items: center; gap: 14px; max-width: calc(100vw - 32px); box-sizing: border-box; padding: 10px 10px 10px 18px; border-radius: 24px; background: var(--primary-bg); color: var(--primary-text); font-size: 14px; box-shadow: var(--shadow);" + (toast.undo ? "" : " padding-right: 18px;"))}>
      <span>{toast.text}</span>
      {toast.undo && (
        <button type="button" onClick={() => { toast.undo?.(); dismiss(); }}
          style={sx("min-height: 34px; padding: 0 14px; flex-shrink: 0; border-radius: 17px; border: 1px solid currentColor; background: transparent; color: inherit; font-size: 13px; font-weight: 700; cursor: pointer;")}>Undo</button>
      )}
    </div>
  );
}
