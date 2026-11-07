import Link from "next/link";

export function TopBar({ title, back, right }: { title: string; back?: string; right?: React.ReactNode }) {
  return (
    <div className="topbar">
      {back && (
        <Link href={back} className="back" aria-label="Tillbaka">
          ‹
        </Link>
      )}
      <h1>{title}</h1>
      {right}
    </div>
  );
}

export function Header({ coins, xp }: { coins: number; xp: number }) {
  return (
    <header className="flex items-center justify-between px-5 pt-[18px] pb-2">
      <Link href="/home" className="brand">
        KNOWPLAY<small>PLAY SMART. LEARN MORE.</small>
      </Link>
      <div className="flex gap-2">
        <Link href="/vault" className="chip" title="Mynt – används i Treasure Vault">
          <i className="c" />
          {coins.toLocaleString("sv-SE")}
        </Link>
        <div className="chip">
          <i className="x" />
          {xp.toLocaleString("sv-SE")} XP
        </div>
      </div>
    </header>
  );
}
