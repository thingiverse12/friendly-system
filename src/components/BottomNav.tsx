"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** Fem tydliga kategorier. Allt annat ligger som undersidor i någon av dem. */
const items = [
  { href: "/home", label: "Hem", icon: "🏠", match: ["/home"] },
  { href: "/games", label: "Spel", icon: "🎰", match: ["/games", "/play", "/duels"] },
  { href: "/learn", label: "Lär", icon: "📚", match: ["/learn", "/ai"] },
  { href: "/schools", label: "Klass", icon: "🏫", match: ["/schools", "/rankings"] },
  { href: "/profile", label: "Jag", icon: "👤", match: ["/profile", "/vault"] },
];

export function BottomNav() {
  const path = usePathname();
  return (
    <nav className="bottom-nav" aria-label="Huvudmeny" style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
      {items.map((it) => {
        const on = it.match.some((m) => path === m || path.startsWith(m + "/"));
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
