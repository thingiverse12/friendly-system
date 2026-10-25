/**
 * Sparly-hunden – appens maskot.
 *
 * Tecknad efter en strävhårig salt-och-peppar-hund: lurviga ögonbryn, skägg, stor svart nos,
 * hängande öron och en mungipa som dras snett uppåt åt sidan så att han ser glad och lite busig ut.
 *
 * `variant="animated"` ritar hunden i två lager: kroppen (utan svans) och svansen för sig. Svansen
 * roterar kring sin fästpunkt i höften med en vanlig CSS-rotation, vilket ger en mjuk, kontinuerlig
 * viftning – inga bildrutor som hoppar – och den ligger *bakom* kroppen så att fogen alltid döljs.
 * Båda lagren är ritade på samma canvas (992 × 1079), så positionerna nedan är exakta andelar av
 * den ytan och stämmer i alla storlekar.
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

/**
 * The animated figure is drawn on a 992 × 1079 canvas. The tail occupies the box at (767, 302) and
 * is 225 × 661; its rotation origin is the point (15, 583) inside the tail, i.e. the hip.
 */
const CANVAS = { width: 992, height: 1079 } as const;
const TAIL = {
  left: 767 / CANVAS.width,
  top: 302 / CANVAS.height,
  width: 225 / CANVAS.width,
  originX: 15 / 225,
  originY: 583 / 661,
} as const;

const pct = (value: number): string => `${(value * 100).toFixed(3)}%`;

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
    const height = Math.round((size * CANVAS.height) / CANVAS.width);
    return (
      <span
        className={`${classes} mascot__wag`}
        style={{ width: size, height }}
        role={decorative ? undefined : 'img'}
        aria-label={decorative ? undefined : title}
        aria-hidden={ariaHidden}
      >
        <img
          className="mascot__tail"
          src="/mascot/hund-svans.png"
          width={225}
          height={661}
          alt=""
          aria-hidden="true"
          decoding="async"
          draggable={false}
          style={{
            left: pct(TAIL.left),
            top: pct(TAIL.top),
            width: pct(TAIL.width),
            transformOrigin: `${pct(TAIL.originX)} ${pct(TAIL.originY)}`,
          }}
        />
        <img
          className="mascot__body"
          src="/mascot/hund-kropp.png"
          width={CANVAS.width}
          height={CANVAS.height}
          alt=""
          aria-hidden="true"
          decoding="async"
          draggable={false}
        />
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
