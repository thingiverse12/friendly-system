"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/home", label: "Hem", icon: "🏠" },
  { href: "/games", label: "Spel", icon: "🎰" },
  { href: "/learn", label: "Lär", icon: "📚" },
  { href: "/schools", label: "Skolor", icon: "🏫" },
  { href: "/rankings", label: "Topplista", icon: "🏆" },
  { href: "/profile", label: "Profil", icon: "👤" },
];

export function BottomNav() {
  const path = usePathname();
  return (
    <nav className="bottom-nav" aria-label="Huvudmeny">
      {items.map((it) => {
        const on = path === it.href || path.startsWith(it.href + "/") || (it.href === "/games" && path.startsWith("/play"));
        return (
          <Link key={it.href} href={it.href} className={on ? "on" : ""} aria-current={on ? "page" : undefined}>
            <span aria-hidden>{it.icon}</span>
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
