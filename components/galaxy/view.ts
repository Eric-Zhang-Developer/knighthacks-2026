// The 2D map's view: a centre in world units and a zoom in CSS pixels per world unit. Pure state and maths, so the
// scene, the map buttons and the tests all drive the same object.
//
// Motion follows the apple-design skill: a pan keeps the release velocity and decelerates like a scroll view
// (rate 0.998 per ms); zoom-to and fly-to are critically damped springs (response 0.4 s) that start from wherever
// the view is now, so any new input interrupts them. With reduced motion every change is a jump.

export type Box = { minX: number; minY: number; maxX: number; maxY: number };
type Target = { x: number; y: number; zoom: number };

const DECELERATION = 0.998; // per ms
const RESPONSE = 0.4; // s
const OMEGA = (2 * Math.PI) / RESPONSE;
const STOP_PX_PER_S = 8; // momentum below this, on screen, is done
const FIT_MARGIN = 0.9; // the whole map fills 90% of the shorter side
export const MAX_ZOOM_OVER_FIT = 40;

export class Viewport {
  x = 0;
  y = 0;
  zoom = 1;
  width = 1;
  height = 1;
  reduced = false;
  private fitView: Target = { x: 0, y: 0, zoom: 1 };
  private vx = 0; // world units per second (momentum), or per-axis spring velocity
  private vy = 0;
  private vz = 0; // spring velocity of log(zoom)
  private mode: "idle" | "momentum" | "spring" = "idle";
  private target: Target | null = null;
  private placed = false;
  // Called whenever the view changes, so a scene that only draws on demand knows to draw.
  onChange: () => void = () => {};

  // The map's extent and the canvas size. The first call also places the view on the whole map; later calls (a
  // resize, a rotated phone) keep how far in you were relative to the whole map, not the raw scale.
  setBounds(box: Box, width: number, height: number) {
    const over = this.placed ? this.zoomOverFit : 1;
    this.width = Math.max(width, 1);
    this.height = Math.max(height, 1);
    const w = Math.max(box.maxX - box.minX, 1e-6);
    const h = Math.max(box.maxY - box.minY, 1e-6);
    this.fitView = {
      x: (box.minX + box.maxX) / 2,
      y: (box.minY + box.maxY) / 2,
      zoom: FIT_MARGIN * Math.min(this.width / w, this.height / h),
    };
    if (!this.placed) {
      Object.assign(this, { x: this.fitView.x, y: this.fitView.y });
      this.placed = true;
    }
    this.zoom = this.fitView.zoom * over;
    this.zoom = this.clampZoom(this.zoom);
    this.onChange();
  }

  get minZoom() {
    return this.fitView.zoom * 0.5;
  }
  get maxZoom() {
    return this.fitView.zoom * MAX_ZOOM_OVER_FIT;
  }
  // How far in from the whole-map view (1 = fit), for sizing stars as you zoom.
  get zoomOverFit() {
    return this.zoom / this.fitView.zoom;
  }
  private clampZoom(z: number) {
    return Math.min(this.maxZoom, Math.max(this.minZoom, z));
  }

  toWorld(sx: number, sy: number) {
    return { x: this.x + (sx - this.width / 2) / this.zoom, y: this.y - (sy - this.height / 2) / this.zoom };
  }
  toScreen(wx: number, wy: number) {
    return { x: (wx - this.x) * this.zoom + this.width / 2, y: (this.y - wy) * this.zoom + this.height / 2 };
  }

  // Any direct input stops whatever the view was doing, where it is.
  interrupt() {
    this.mode = "idle";
    this.target = null;
    this.vx = this.vy = this.vz = 0;
  }

  // Drag by screen pixels: the map follows the pointer 1:1.
  panBy(dx: number, dy: number) {
    this.interrupt();
    this.x -= dx / this.zoom;
    this.y += dy / this.zoom;
    this.onChange();
  }

  // Release after a drag, with the pointer's velocity in px/s: the map keeps moving and slows down.
  release(vxPx: number, vyPx: number) {
    if (this.reduced || Math.hypot(vxPx, vyPx) < STOP_PX_PER_S) return;
    this.mode = "momentum";
    this.vx = -vxPx / this.zoom;
    this.vy = vyPx / this.zoom;
    this.onChange();
  }

  // Zoom by a factor about a screen point, which stays under the pointer.
  zoomAt(factor: number, sx: number, sy: number) {
    this.interrupt();
    const before = this.toWorld(sx, sy);
    this.zoom = this.clampZoom(this.zoom * factor);
    const after = this.toWorld(sx, sy);
    this.x += before.x - after.x;
    this.y += before.y - after.y;
    this.onChange();
  }

  // Spring to a view (map buttons, keyboard, fly-to). Reduced motion jumps.
  animateTo(t: Partial<Target>) {
    const to = { x: t.x ?? this.x, y: t.y ?? this.y, zoom: this.clampZoom(t.zoom ?? this.zoom) };
    if (this.reduced) {
      this.interrupt();
      Object.assign(this, to);
      this.onChange();
      return;
    }
    if (this.mode !== "spring") this.vx = this.vy = this.vz = 0; // a momentum velocity isn't a spring velocity
    this.mode = "spring";
    this.target = to;
    this.onChange();
  }
  zoomBy(factor: number) {
    this.animateTo({ zoom: (this.target?.zoom ?? this.zoom) * factor });
  }
  fit() {
    this.animateTo(this.fitView);
  }
  flyTo(wx: number, wy: number, minZoomOverFit = 2) {
    this.animateTo({ x: wx, y: wy, zoom: Math.max(this.zoom, this.fitView.zoom * minZoomOverFit) });
  }

  // Advance by dt seconds. Returns whether the view moved.
  step(dt: number) {
    if (this.mode === "idle" || dt <= 0) return false;
    if (this.mode === "momentum") {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      const k = Math.pow(DECELERATION, dt * 1000);
      this.vx *= k;
      this.vy *= k;
      if (Math.hypot(this.vx, this.vy) * this.zoom < STOP_PX_PER_S) this.interrupt();
      return true;
    }
    // Critically damped spring per axis (zoom in log space, so zooming in and out feel the same), in small
    // substeps so a long frame can't overshoot.
    const t = this.target!;
    for (let left = dt; left > 0; left -= 1 / 240) {
      const h = Math.min(left, 1 / 240);
      this.vx += (-OMEGA * OMEGA * (this.x - t.x) - 2 * OMEGA * this.vx) * h;
      this.vy += (-OMEGA * OMEGA * (this.y - t.y) - 2 * OMEGA * this.vy) * h;
      const lz = Math.log(this.zoom);
      this.vz += (-OMEGA * OMEGA * (lz - Math.log(t.zoom)) - 2 * OMEGA * this.vz) * h;
      this.x += this.vx * h;
      this.y += this.vy * h;
      this.zoom = Math.exp(lz + this.vz * h);
    }
    const off = Math.hypot(this.x - t.x, this.y - t.y) * this.zoom + Math.abs(Math.log(this.zoom / t.zoom)) * 100;
    if (off < 0.25) {
      Object.assign(this, { x: t.x, y: t.y, zoom: t.zoom });
      this.interrupt();
    }
    return true;
  }

  get moving() {
    return this.mode !== "idle";
  }
}

// A uniform grid over star positions, so picking looks at the few stars near the pointer instead of all of them.
export class StarGrid {
  private cells = new Map<number, number[]>();
  private cell: number;
  private ox: number;
  private oy: number;

  constructor(
    private positions: ArrayLike<number>,
    box: Box,
  ) {
    this.cell = Math.max(box.maxX - box.minX, box.maxY - box.minY, 1e-6) / 256;
    this.ox = box.minX;
    this.oy = box.minY;
    for (let i = 0; i < positions.length / 3; i++) {
      const k = this.key(this.col(positions[3 * i]), this.col(positions[3 * i + 1], true));
      const list = this.cells.get(k);
      if (list) list.push(i);
      else this.cells.set(k, [i]);
    }
  }
  private col(v: number, y = false) {
    return Math.floor((v - (y ? this.oy : this.ox)) / this.cell);
  }
  private key(cx: number, cy: number) {
    return cx * 65536 + cy;
  }

  // The visible star nearest to (wx, wy) within r world units, or -1.
  nearest(wx: number, wy: number, r: number, visible: ArrayLike<number>) {
    let best = -1;
    let bestD = r * r;
    const [x0, x1, y0, y1] = [this.col(wx - r), this.col(wx + r), this.col(wy - r, true), this.col(wy + r, true)];
    // ponytail: a huge radius (zoomed far out) walks many empty cells; fine at 256 cells across.
    for (let cx = x0; cx <= x1; cx++)
      for (let cy = y0; cy <= y1; cy++)
        for (const i of this.cells.get(this.key(cx, cy)) ?? []) {
          if (visible[i] !== 1) continue;
          const d = (this.positions[3 * i] - wx) ** 2 + (this.positions[3 * i + 1] - wy) ** 2;
          if (d <= bestD) [best, bestD] = [i, d];
        }
    return best;
  }
}

export function boundsOf(positions: ArrayLike<number>): Box {
  const box = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (let i = 0; i < positions.length; i += 3) {
    box.minX = Math.min(box.minX, positions[i]);
    box.maxX = Math.max(box.maxX, positions[i]);
    box.minY = Math.min(box.minY, positions[i + 1]);
    box.maxY = Math.max(box.maxY, positions[i + 1]);
  }
  return positions.length ? box : { minX: -1, minY: -1, maxX: 1, maxY: 1 };
}
