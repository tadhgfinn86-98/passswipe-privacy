"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { Check, Loader2, X } from "lucide-react";
import { Button, ButtonArrow } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ActionIntent = "signup" | "login" | "sales" | "plan";

type DialogState = { intent: ActionIntent; plan?: string } | null;

type ActionContextValue = {
  open: (intent: ActionIntent, plan?: string) => void;
  close: () => void;
};

const ActionContext = React.createContext<ActionContextValue | null>(null);

export function useAction() {
  const ctx = React.useContext(ActionContext);
  if (!ctx) throw new Error("useAction must be used inside <ActionProvider>");
  return ctx;
}

const copy: Record<
  ActionIntent,
  { title: string; body: string; cta: string; field: string; done: string }
> = {
  signup: {
    title: "Start your free trial",
    body: "Create your workspace and meet your agent. No credit card required.",
    cta: "Create workspace",
    field: "Work email",
    done: "Workspace reserved. Check your inbox for the setup link.",
  },
  login: {
    title: "Welcome back",
    body: "We'll email you a secure sign-in link. No password to remember.",
    cta: "Send sign-in link",
    field: "Work email",
    done: "Sign-in link sent. It expires in 15 minutes.",
  },
  sales: {
    title: "Talk to sales",
    body: "Tell us where to reach you and a specialist will follow up within one working day.",
    cta: "Request a call",
    field: "Work email",
    done: "Request received. A specialist will be in touch shortly.",
  },
  plan: {
    title: "Start your plan",
    body: "Set up your workspace first. You can add billing later, or never.",
    cta: "Continue",
    field: "Work email",
    done: "Plan reserved. Check your inbox to finish setup.",
  },
};

export function ActionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<DialogState>(null);
  const value = React.useMemo<ActionContextValue>(
    () => ({
      open: (intent, plan) => setState({ intent, plan }),
      close: () => setState(null),
    }),
    [],
  );

  return (
    <ActionContext.Provider value={value}>
      {children}
      <ActionDialog state={state} onClose={() => setState(null)} />
    </ActionContext.Provider>
  );
}

function ActionDialog({
  state,
  onClose,
}: {
  state: DialogState;
  onClose: () => void;
}) {
  const reduce = useReducedMotion();
  const panelRef = React.useRef<HTMLDivElement>(null);
  const restoreRef = React.useRef<HTMLElement | null>(null);
  const open = state !== null;

  React.useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      restoreRef.current?.focus?.();
    };
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
        'button, input, a[href], [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {state ? (
        <div className="fixed inset-0 z-100 flex items-end justify-center p-4 sm:items-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-[#08090a]/45 backdrop-blur-[2px]"
            onClick={onClose}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="action-dialog-title"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-raised sm:p-7"
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="absolute right-4 top-4 inline-flex size-8 items-center justify-center rounded-lg text-subtle-foreground transition-colors hover:bg-card-muted hover:text-foreground"
            >
              <X className="size-4" />
            </button>

            {/* Mounted fresh on every open, so each visit starts from a clean form. */}
            <DialogForm state={state} onClose={onClose} />
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}

function DialogForm({
  state,
  onClose,
}: {
  state: NonNullable<DialogState>;
  onClose: () => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [status, setStatus] = React.useState<"idle" | "pending" | "done">("idle");
  const [email, setEmail] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const text = copy[state.intent];

  React.useEffect(() => {
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, []);

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      setError("Enter a valid email address.");
      inputRef.current?.focus();
      return;
    }
    setError(null);
    setStatus("pending");
    window.setTimeout(() => setStatus("done"), 900);
  }

  if (status === "done") {
    return (
      <div className="flex flex-col items-start gap-3 py-2">
        <span className="inline-flex size-10 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--success)_16%,transparent)] text-[var(--success)]">
          <Check className="size-5" strokeWidth={2.2} />
        </span>
        <h2 id="action-dialog-title" className="text-lg font-semibold tracking-tight">
          You&rsquo;re all set
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{text.done}</p>
        <Button variant="secondary" size="md" className="mt-2" onClick={onClose}>
          Close
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <h2 id="action-dialog-title" className="pr-8 text-lg font-semibold tracking-tight">
        {text.title}
        {state.plan ? (
          <span className="ml-2 rounded-md bg-brand-soft px-2 py-0.5 align-middle text-[12px] font-medium text-[var(--brand)]">
            {state.plan}
          </span>
        ) : null}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text.body}</p>

      <label
        htmlFor="action-dialog-email"
        className="mt-5 block text-[13px] font-medium text-foreground"
      >
        {text.field}
      </label>
      <input
        ref={inputRef}
        id="action-dialog-email"
        type="email"
        inputMode="email"
        autoComplete="email"
        value={email}
        placeholder="you@company.com"
        onChange={(event) => setEmail(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "action-dialog-error" : undefined}
        className={cn(
          "mt-1.5 h-11 w-full rounded-xl border border-border bg-surface px-3.5 text-sm text-foreground outline-none transition-colors placeholder:text-subtle-foreground focus:border-[var(--brand)]",
          error && "border-[#e5484d]",
        )}
      />
      {error ? (
        <p id="action-dialog-error" role="alert" className="mt-2 text-[13px] text-[#e5484d]">
          {error}
        </p>
      ) : null}

      <Button type="submit" size="lg" className="mt-4 w-full" disabled={status === "pending"}>
        {status === "pending" ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Working&hellip;
          </>
        ) : (
          <>
            {text.cta}
            <ButtonArrow />
          </>
        )}
      </Button>
      <p className="mt-3 text-center text-[12px] text-subtle-foreground">
        Demo experience &mdash; nothing is sent anywhere.
      </p>
    </form>
  );
}
