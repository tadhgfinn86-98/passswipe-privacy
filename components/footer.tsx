"use client";

import { AtSign, Globe, MessageCircle, Rss } from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

const columns = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "#features" },
      { label: "Integrations", href: "#integrations" },
      { label: "Pricing", href: "#pricing" },
      { label: "Security", href: "#security" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "#top" },
      { label: "Careers", href: "#top" },
      { label: "Contact", href: "#faq" },
      { label: "Blog", href: "#top" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Documentation", href: "#how-it-works" },
      { label: "Help centre", href: "#faq" },
      { label: "Guides", href: "#how-it-works" },
      { label: "API", href: "#features" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy", href: "/privacy-policy.html" },
      { label: "Terms", href: "/privacy-policy.html" },
      { label: "Cookies", href: "/privacy-policy.html" },
    ],
  },
];

const socials = [
  { label: "Community", icon: MessageCircle, href: "#faq" },
  { label: "Newsletter", icon: AtSign, href: "#top" },
  { label: "Changelog", icon: Rss, href: "#top" },
  { label: "Status", icon: Globe, href: "#security" },
];

export function Footer() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="container-page py-14 sm:py-16">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-4">
            <Logo />
            <p className="mt-4 max-w-xs text-[14px] leading-relaxed text-muted-foreground">
              AI-powered automation for modern teams.
            </p>
            <ul className="mt-6 flex items-center gap-2">
              {socials.map((social) => {
                const Icon = social.icon;
                return (
                  <li key={social.label}>
                    <a
                      href={social.href}
                      aria-label={social.label}
                      title={social.label}
                      className="inline-flex size-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-all duration-200 hover:-translate-y-px hover:border-border-strong hover:text-foreground"
                    >
                      <Icon className="size-4" strokeWidth={1.8} />
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>

          <nav aria-label="Footer" className="grid grid-cols-2 gap-8 sm:grid-cols-4 lg:col-span-8">
            {columns.map((column) => (
              <div key={column.title}>
                <h2 className="text-[13px] font-medium tracking-[-0.01em]">{column.title}</h2>
                <ul className="mt-4 flex flex-col gap-2.5">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        className={cn(
                          "text-[13.5px] text-muted-foreground transition-colors duration-200 hover:text-foreground",
                        )}
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-border pt-6 sm:flex-row sm:items-center">
          <p className="text-[13px] text-subtle-foreground">
            &copy; 2026 SkyAgent. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-[12.5px] text-subtle-foreground">
              <span className="size-1.5 rounded-full bg-[var(--success)] animate-soft-pulse" />
              All systems operational
            </span>
            <ThemeToggle />
          </div>
        </div>
      </div>
    </footer>
  );
}
