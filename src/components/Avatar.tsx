export function Avatar({ emoji, pct = 0, size, frame }: { emoji: string; pct?: number; size?: "sm" | "lg"; frame?: string | null }) {
  return (
    <div className={`avatar ${size ?? ""} ${frame ? `frame-${frame}` : ""}`} style={{ ["--pct" as string]: `${pct}%` }}>
      <div>{emoji}</div>
    </div>
  );
}
