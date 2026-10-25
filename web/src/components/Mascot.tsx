/**
 * Sparly-hunden – appens maskot.
 *
 * Tecknad efter en strävhårig salt-och-peppar-hund: lurviga ögonbryn, skägg, stor svart nos och
 * hängande öron. Bilderna är förrenderade i flera storlekar så att mobilen aldrig laddar en
 * 640 px-bild för att visa en 64 px-avatar.
 *
 * `variant="full"` är hela hunden (stående, vinkande), `variant="face"` är ett kvadratiskt
 * porträtt som beskärs snyggt i en cirkel.
 */
export type MascotVariant = 'full' | 'face';

const FACES = {
  full: {
    src: '/mascot/hund.png',
    srcSet: '/mascot/hund-128.png 128w, /mascot/hund-256.png 256w, /mascot/hund-320.png 320w, /mascot/hund.png 640w',
    /** The full-body artwork is taller than it is wide. */
    ratio: 1064 / 860,
  },
  face: {
    src: '/mascot/hund-ansikte.png',
    srcSet: '/mascot/hund-ansikte.png 480w',
    ratio: 1,
  },
} as const;

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
  const art = FACES[variant];
  return (
    <img
      className={['mascot', `mascot--${variant}`, className].filter(Boolean).join(' ')}
      src={art.src}
      srcSet={art.srcSet}
      sizes={`${size}px`}
      width={size}
      height={Math.round(size * art.ratio)}
      alt={decorative ? '' : title}
      aria-hidden={decorative ? 'true' : undefined}
      decoding="async"
      draggable={false}
    />
  );
}
