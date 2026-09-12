"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button, ButtonArrow } from "@/components/ui/button";
import { useAction } from "@/components/action-dialog";
import { navLinks } from "@/lib/site";
import { cn } from "@/lib/utils";

export function Navbar() {
  const [scrolled, setScrolled] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const { open } = useAction();
  const reduce = useReducedMotion();

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  React.useEffect(() => {
    if (!menuOpen) return;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-300",
        scrolled
          ? "border-b border-border bg-[color-mix(in_oklab,var(--background)_82%,transparent)] backdrop-blur-xl"
          : "border-b border-transparent bg-[color-mix(in_oklab,var(--background)_55%,transparent)] backdrop-blur-sm",
      )}
    >
      <nav aria-label="Main" className="container-page">
        <div className="flex h-16 items-center justify-between gap-6">
          <a
            href="#top"
            className="rounded-lg transition-opacity hover:opacity-80"
            aria-label="SkyAgent home"
          >
            <Logo />
          </a>

          <ul className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 lg:flex">
            {navLinks.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="relative inline-flex h-9 items-center rounded-lg px-3 text-[14px] text-muted-foreground transition-colors duration-200 hover:bg-card-muted hover:text-foreground"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>

          <div className="hidden items-center gap-2 lg:flex">
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={() => open("login")}>
              Log in
            </Button>
            <Button size="sm" onClick={() => open("signup")}>
              Start free
              <ButtonArrow />
            </Button>
          </div>

          <div className="flex items-center gap-2 lg:hidden">
            <ThemeToggle />
            <button
              type="button"
              onClick={() => setMenuOpen((value) => !value)}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              className="inline-flex size-9 items-center justify-center rounded-lg border border-border bg-card/70 text-foreground transition-colors hover:border-border-strong"
            >
              {menuOpen ? <X className="size-4.5" /> : <Menu className="size-4.5" />}
            </button>
          </div>
        </div>
      </nav>

      <AnimatePresence>
        {menuOpen ? (
          <motion.div
            id="mobile-menu"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="border-t border-border bg-background lg:hidden"
          >
            <div className="container-page py-4">
              <ul className="flex flex-col">
                {navLinks.map((link, index) => (
                  <motion.li
                    key={link.href}
                    initial={reduce ? false : { opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.04 * index, duration: 0.25 }}
                  >
                    <a
                      href={link.href}
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center justify-between border-b border-border py-3.5 text-[15px] font-medium text-foreground"
                    >
                      {link.label}
                      <span aria-hidden="true" className="text-subtle-foreground">
                        &rarr;
                      </span>
                    </a>
                  </motion.li>
                ))}
              </ul>
              <div className="mt-5 flex flex-col gap-2.5">
                <Button
                  variant="secondary"
                  size="lg"
                  className="w-full"
                  onClick={() => {
                    setMenuOpen(false);
                    open("login");
                  }}
                >
                  Log in
                </Button>
                <Button
                  size="lg"
                  className="w-full"
                  onClick={() => {
                    setMenuOpen(false);
                    open("signup");
                  }}
                >
                  Start free
                  <ButtonArrow />
                </Button>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
