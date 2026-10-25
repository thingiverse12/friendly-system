/**
 * Sparly-hunden – appens maskot.
 *
 * Tecknad efter en strävhårig salt-och-peppar-hund: lurviga ögonbryn, skägg, stor svart nos,
 * hängande öron och en mungipa som dras snett uppåt åt sidan så att han ser glad och lite busig ut.
 *
 * `variant="animated"` är tre separat tecknade bilder av exakt samma hund där bara svansen sitter i
 * olika läge (upp / mitt / ner). De växlas i tur och ordning, vilket ger en riktig svansviftning i
 * stället för att hela hunden studsar. Alla tre bilderna har samma beskärning, så inget hoppar.
 *
 * Bilderna är förrenderade i flera storlekar så att mobilen aldrig laddar en 640 px-bild för att
 * visa en 64 px-avatar.
 */
export type MascotVariant = 'full' | 'face' | 'animated';

const STILL = {
  full: {
    src: '/mascot/hund.png',
    srcSet: '/mascot/hund-128.png 128w, /mascot/hund-256.png 256w, /mascot/hund-320.png 320w, /mascot/hund.png 640w',
    width: 640,
    height: 696,
  },
  face: {
    src: '/mascot/hund-ansikte.png',
    srcSet: '/mascot/hund-ansikte.png 480w',
    width: 480,
    height: 480,
  },
} as const;

/** The three wag frames share one crop, so switching between them never shifts the dog. */
const WAG = [
  { src: '/mascot/hund-vift-1.png', label: 'Svansen upp' },
  { src: '/mascot/hund-vift-2.png', label: 'Svansen mitt' },
  { src: '/mascot/hund-vift-3.png', label: 'Svansen ner' },
] as const;
const WAG_WIDTH = 420;
const WAG_HEIGHT = 457;

export function Mascot({
  size = 140,
  variant = 'full',
  className,
  decorative = true,
  title = 'Sparly-hunden',
}: {
  size?: number;
  variant?: MascotVariant;
  className?: string;
  /** Decorative artwork is hidden from screen readers; otherwise `title` is announced. */
  decorative?: boolean;
  title?: string;
}) {
  const classes = ['mascot', `mascot--${variant}`, className].filter(Boolean).join(' ');
  const alt = decorative ? '' : title;
  const ariaHidden = decorative ? 'true' : undefined;

  if (variant === 'animated') {
    const height = Math.round((size * WAG_HEIGHT) / WAG_WIDTH);
    return (
      <span
        className={`${classes} mascot__wag`}
        style={{ width: size, height }}
        role={decorative ? undefined : 'img'}
        aria-label={decorative ? undefined : title}
        aria-hidden={ariaHidden}
      >
        {WAG.map((frame, index) => (
          <img
            key={frame.src}
            className="mascot__wag-frame"
            src={frame.src}
            width={WAG_WIDTH}
            height={WAG_HEIGHT}
            alt=""
            aria-hidden="true"
            style={{ animationDelay: `${index * 0.2}s` }}
            decoding="async"
            draggable={false}
          />
        ))}
      </span>
    );
  }

  const art = STILL[variant];
  const height = Math.round((size * art.height) / art.width);
  return (
    <img
      className={classes}
      src={art.src}
      srcSet={art.srcSet}
      sizes={`${size}px`}
      width={size}
      height={height}
      alt={alt}
      aria-hidden={ariaHidden}
      decoding="async"
      draggable={false}
    />
  );
}
