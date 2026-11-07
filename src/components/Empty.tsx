export function Empty({ icon = "🃏", title, text, children }: { icon?: string; title: string; text?: string; children?: React.ReactNode }) {
  return (
    <div className="card text-center py-8">
      <div className="text-4xl mb-3">{icon}</div>
      <b className="block text-[15px]">{title}</b>
      {text && <p className="muted text-[13px] mt-1">{text}</p>}
      {children && <div className="mt-4 flex justify-center gap-2 flex-wrap">{children}</div>}
    </div>
  );
}
