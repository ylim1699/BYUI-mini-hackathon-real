import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { useUi } from "../../store/ui";
import { Icon } from "./Icon";

type Variant = "primary" | "ghost" | "danger" | "quiet";
const VARIANT: Record<Variant, string> = {
  primary: "bg-primary text-on-primary hover:opacity-90",
  ghost: "border border-line-strong text-text hover:bg-surface-2",
  danger: "bg-[#e58a80] text-[#1a1010] hover:opacity-90",
  quiet: "text-text-2 hover:text-text hover:bg-surface-2",
};

export function Button({ variant = "ghost", className = "", ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...p}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT[variant]} ${className}`}
    />
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-line bg-surface p-5 ${className}`}>{children}</section>;
}

export function PageHeader({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        {sub && <p className="mt-1 text-sm text-text-2">{sub}</p>}
      </div>
      {right}
    </header>
  );
}

export const inputCls =
  "rounded-lg border border-line-strong bg-field px-3 py-2 text-sm font-bold text-text placeholder:text-text placeholder:opacity-60 focus:border-[var(--c1)] focus:outline-none";

export function Dot({ color, size = 10 }: { color: string; size?: number }) {
  return <span className="inline-block shrink-0 rounded-full" style={{ width: size, height: size, background: `var(--${color})` }} />;
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-2 text-sm text-text-2">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-line-strong border-t-text" />
      {label}…
    </div>
  );
}

export function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <p role="alert" className="rounded-lg border border-warn-line bg-warn-bg px-3 py-2 text-sm font-semibold text-warn">
      {error instanceof Error ? error.message : String(error)}
    </p>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 text-sm font-bold">
      <span>{label}</span>
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition ${checked ? "bg-ok" : "bg-surface-3"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${checked ? "left-[22px]" : "left-0.5"}`} />
      </button>
    </label>
  );
}

/** Modal used for every "are you sure" in the app. */
export function Dialog({ open, title, children, onClose, footer, wide = false }: {
  open: boolean; title: string; children?: ReactNode; onClose: () => void; footer?: ReactNode; wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>("button, input, select, textarea")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); prev?.focus(); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title}
        className={`anim-page max-h-[90vh] w-full overflow-auto rounded-2xl border border-line-strong bg-panel p-6 shadow-card ${wide ? "max-w-xl" : "max-w-md"}`}>
        <div className="mb-3 flex items-start justify-between gap-4">
          <h2 className="text-lg font-extrabold">{title}</h2>
          <button aria-label="Close" onClick={onClose} className="rounded p-1 text-text-2 hover:text-text"><Icon name="x" /></button>
        </div>
        <div className="text-sm text-text-2">{children}</div>
        {footer && <div className="mt-6 flex flex-wrap justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

export function Confirm({ open, title, body, yes, no = "Cancel", danger = false, onYes, onClose }: {
  open: boolean; title: string; body?: ReactNode; yes: string; no?: string; danger?: boolean; onYes: () => void; onClose: () => void;
}) {
  return (
    <Dialog open={open} title={title} onClose={onClose}
      footer={<>
        <Button onClick={onClose}>{no}</Button>
        <Button variant={danger ? "danger" : "primary"} onClick={() => { onYes(); onClose(); }}>{yes}</Button>
      </>}>
      {body}
    </Dialog>
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
    <div role="status" className="anim-page fixed bottom-5 left-1/2 z-[60] flex w-max max-w-[92vw] -translate-x-1/2 items-center gap-3 rounded-xl border border-line-strong bg-surface-2 px-4 py-3 text-sm font-bold shadow-card">
      <span>{toast.text}</span>
      {toast.action && <button className="underline" onClick={() => { toast.action?.run(); dismiss(); }}>{toast.action.label}</button>}
      {toast.undo && <button className="flex items-center gap-1 text-[var(--c1)]" onClick={() => { toast.undo?.(); dismiss(); }}><Icon name="undo" size={15} />Undo</button>}
      <button aria-label="Dismiss" onClick={dismiss} className="text-text-2"><Icon name="x" size={15} /></button>
    </div>
  );
}
