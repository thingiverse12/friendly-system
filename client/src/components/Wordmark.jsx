export function WordmarkLanding() {
  return (
    <div className="wordmark" style={{ fontSize: '1.25rem' }}>
      <span className="wordmark-fingerprint" aria-hidden="true">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="9.5" opacity=".22" />
          <circle cx="12" cy="12" r="6.5" opacity=".5" />
          <circle cx="12" cy="12" r="2.6" />
          <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2" opacity=".7" />
        </svg>
      </span>
      <span className="wordmark-text" style={{ fontSize: '1.5rem' }}>
        M<span className="wordmark-o">O</span>RDGÅTAN
        <small>SANNINGEN LIGGER I DETALJERNA</small>
      </span>
    </div>
  );
}
