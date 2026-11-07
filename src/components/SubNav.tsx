"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export type SubNavItem = { href: string; label: string; exact?: boolean };

/** Undermeny inom en kategori – samma plats på alla sidor i kategorin så man alltid vet var man är. */
export function SubNav({ items }: { items: SubNavItem[] }) {
  const path = usePathname();
  return (
    <nav className="subnav" aria-label="Undermeny">
      {items.map((it) => {
        const on = it.exact ? path === it.href : path === it.href || path.startsWith(it.href + "/");
        return <Link key={it.href} href={it.href} className={on ? "on" : ""} aria-current={on ? "page" : undefined}>{it.label}</Link>;
      })}
    </nav>
  );
}

export const NAV_GAMES: SubNavItem[] = [{ href: "/games", label: "🎰 Alla spel", exact: true }, { href: "/games/daily", label: "📅 Dagens utmaning" }, { href: "/duels", label: "⚔️ Dueller" }];
export const NAV_LEARN: SubNavItem[] = [{ href: "/learn", label: "📚 Ämnen", exact: true }, { href: "/learn/materials", label: "📎 Mitt material" }, { href: "/ai", label: "🧠 AI-lärare" }];
export const NAV_CLASS: SubNavItem[] = [{ href: "/schools", label: "🏫 Min klass & skola" }, { href: "/rankings", label: "🏆 Topplista" }];
export const NAV_ME: SubNavItem[] = [{ href: "/profile", label: "👤 Profil", exact: true }, { href: "/profile/settings", label: "⚙️ Inställningar" }, { href: "/profile/accessibility", label: "♿ Tillgänglighet" }, { href: "/vault", label: "💎 Vault" }];
