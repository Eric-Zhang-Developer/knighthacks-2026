// A spring for one value, in Apple's terms (apple-design §4): damping ratio (1 = no overshoot) and response (how
// quickly it gets there, in seconds). It starts from the current value and velocity, so it hands off from a drag
// without a seam. Reduced motion jumps straight to the end.
export function spring(opts: {
  from: number;
  to: number;
  velocity?: number; // units per second
  damping?: number;
  response?: number;
  onUpdate: (v: number) => void;
  onDone?: () => void;
}) {
  const { from, to, damping = 1, response = 0.3, onUpdate, onDone } = opts;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    onUpdate(to);
    onDone?.();
    return () => {};
  }
  const w = (2 * Math.PI) / response;
  let x = from;
  let v = opts.velocity ?? 0;
  let last = performance.now();
  let frame = requestAnimationFrame(function tick(now) {
    for (let left = Math.min((now - last) / 1000, 0.1); left > 0; left -= 1 / 240) {
      const h = Math.min(left, 1 / 240);
      v += (-w * w * (x - to) - 2 * damping * w * v) * h;
      x += v * h;
    }
    last = now;
    if (Math.abs(x - to) < 0.5 && Math.abs(v) < 5) {
      onUpdate(to);
      onDone?.();
      return;
    }
    onUpdate(x);
    frame = requestAnimationFrame(tick);
  });
  return () => cancelAnimationFrame(frame);
}

// Where a flick would come to rest (apple-design §6: scroll-view deceleration, rate per ms).
export const project = (velocity: number, rate = 0.998) => ((velocity / 1000) * rate) / (1 - rate);
