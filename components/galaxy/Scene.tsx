"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useAppState } from "@/lib/store";
import { STYLE, styleFor } from "./stars";
import { boundsOf, StarGrid, type Viewport } from "./view";

const PICK_RADIUS = 10; // CSS px
const WHEEL_ZOOM = 0.0015; // per wheel pixel: one notch (~100px) is about 16%
const DRAG_PX = 4; // a pointer that moves less than this between down and up is a click, not a pan

// Round points with a per-star colour and size, so every corpus star is one draw call. Base stars are bare dots that
// grow a little as you zoom in (so a close view isn't all empty space); marked stars (bigger than base) keep their
// size and glow. A prize winner's core sits inside a ring: the shape marks it, not the colour alone.
const material = () =>
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.NormalBlending,
    uniforms: { pixelRatio: { value: 1 }, zoomScale: { value: 1 } },
    vertexShader: `
      attribute vec3 starColor;
      attribute float size;
      attribute float ring;
      uniform float pixelRatio;
      uniform float zoomScale;
      varying vec3 vColor;
      varying float vGlow;
      varying float vRing;
      varying float vAlpha;
      void main() {
        vColor = starColor;
        vRing = ring;
        vGlow = step(${STYLE.base.size + 0.5}, size); // 1 for any marked star: every marked style is bigger than base
        float grow = mix(zoomScale, 1.0, vGlow);
        vAlpha = mix(0.78, 1.0, vGlow);
        gl_PointSize = size * 2.2 * pixelRatio * grow; // room for a halo; the core keeps the nominal size
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position.xy, 0.0, 1.0);
      }`,
    fragmentShader: `
      varying vec3 vColor;
      varying float vGlow;
      varying float vRing;
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        if (d > 1.0) discard;
        float core = 1.0 - smoothstep(mix(0.38, 0.22, vRing), mix(0.46, 0.3, vRing), d);
        float band = vRing * (smoothstep(0.58, 0.64, d) - smoothstep(0.8, 0.86, d));
        float halo = pow(1.0 - d, 2.2) * 0.45 * vGlow * (1.0 - vRing);
        gl_FragColor = vec4(vColor, max(max(core, band), halo) * vAlpha);
      }`,
  });

// The nebula: the same stars again, drawn large, faint and additive under the points, so each category's region
// glows in its own hue and dense regions glow brighter. Static: it changes only when the stars' styles do.
const nebula = () =>
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    // Add light, never alpha: the canvas is transparent over the chart's CSS background, and writing alpha would
    // punch dark discs through it.
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
    blendSrcAlpha: THREE.ZeroFactor,
    blendDstAlpha: THREE.OneFactor,
    uniforms: { pixelRatio: { value: 1 }, zoomScale: { value: 1 }, fade: { value: 1 } },
    vertexShader: `
      attribute vec3 starColor;
      attribute float size;
      uniform float pixelRatio;
      uniform float zoomScale;
      varying vec3 vColor;
      void main() {
        vColor = starColor;
        // ponytail: one quad per star; at ~55k stars this is the fill-rate cost to watch (shrink the 34px first).
        gl_PointSize = size > 0.0 ? 34.0 * pixelRatio : 0.0;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position.xy, 0.0, 1.0);
      }`,
    fragmentShader: `
      uniform float fade;
      varying vec3 vColor;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        if (d > 1.0) discard;
        gl_FragColor = vec4(vColor * exp(-d * d * 4.0) * 0.07 * fade, 0.0);
      }`,
  });

type Style = { color: readonly number[]; size: number; ring?: boolean };
const HIDDEN: Style = { color: STYLE.base.color, size: 0 };

// The e2e reads the live position buffer through this to prove a reveal never moves a star, and the view to find
// stars on screen.
export type StarCanvas = HTMLCanvasElement & { starPositions?: ArrayLike<number>; starView?: Viewport };

function StarPoints(props: { positions: Float32Array; styleAt: (i: number) => Style; view: Viewport; expose?: boolean; glow?: boolean }) {
  const { positions, styleAt, view, expose, glow } = props;
  const dpr = useThree((s) => s.viewport.dpr);
  const dom = useThree((s) => s.gl.domElement) as StarCanvas;
  const invalidate = useThree((s) => s.invalidate);
  const mats = useMemo(() => ({ star: material(), glow: glow ? nebula() : null }), [glow]);
  const geometry = useMemo(() => {
    const n = positions.length / 3;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("starColor", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute("size", new THREE.BufferAttribute(new Float32Array(n), 1));
    g.setAttribute("ring", new THREE.BufferAttribute(new Float32Array(n), 1));
    return g;
  }, [positions]);

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => {
    if (expose) dom.starPositions = geometry.getAttribute("position").array;
  }, [expose, dom, geometry]);
  useEffect(() => () => (mats.star.dispose(), mats.glow?.dispose()), [mats]);
  useEffect(() => {
    const color = geometry.getAttribute("starColor") as THREE.BufferAttribute;
    const size = geometry.getAttribute("size") as THREE.BufferAttribute;
    const ring = geometry.getAttribute("ring") as THREE.BufferAttribute;
    for (let i = 0; i < size.count; i++) {
      const s = styleAt(i);
      color.setXYZ(i, s.color[0], s.color[1], s.color[2]);
      size.setX(i, s.size);
      ring.setX(i, s.ring ? 1 : 0);
    }
    color.needsUpdate = size.needsUpdate = ring.needsUpdate = true;
    invalidate();
  }, [geometry, styleAt, invalidate]);
  useFrame(() => {
    // Base stars grow with zoom, gently: double size at 10x in, never more than 2.6x.
    const zoomScale = Math.min(2.6, Math.max(1, Math.pow(view.zoomOverFit, 0.3)));
    for (const m of [mats.star, mats.glow]) {
      if (!m) continue;
      m.uniforms.pixelRatio.value = dpr;
      m.uniforms.zoomScale.value = zoomScale;
    }
    // The nebula is the overview: it fades as you zoom in to read single stars, gone by about 6x.
    if (mats.glow) mats.glow.uniforms.fade.value = Math.max(0, 1 - (view.zoomOverFit - 1) / 5);
  });

  return (
    <>
      {mats.glow && <points geometry={geometry} material={mats.glow} renderOrder={0} />}
      <points geometry={geometry} material={mats.star} renderOrder={1} />
    </>
  );
}

export type Hover = { index: number; x: number; y: number } | null;

// Pointer, wheel and pinch input, and the camera: every frame the orthographic camera is set from the viewport.
// Panning and zooming are refused while a selection's panel is open (the camera holds still).
function Rig(props: {
  view: Viewport;
  positions: Float32Array;
  visible: Uint8Array;
  locked: boolean;
  onHover: (h: Hover) => void;
  onPick: (index: number) => void;
}) {
  const { view, positions, visible, locked, onHover, onPick } = props;
  const camera = useThree((s) => s.camera) as THREE.OrthographicCamera;
  const dom = useThree((s) => s.gl.domElement);
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const box = useMemo(() => boundsOf(positions), [positions]);
  const grid = useMemo(() => new StarGrid(positions, box), [positions, box]);

  useEffect(() => view.setBounds(box, size.width, size.height), [view, box, size]);
  useEffect(() => void ((dom as StarCanvas).starView = view), [dom, view]);
  // The canvas draws on demand: only when the view or the stars change, never at idle.
  useEffect(() => {
    view.onChange = invalidate;
    invalidate();
    return () => void (view.onChange = () => {});
  }, [view, invalidate]);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => (view.reduced = mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [view]);
  useFrame((_, dt) => {
    view.step(Math.min(dt, 0.1));
    if (view.moving) invalidate(); // still gliding or springing: draw the next frame too
    camera.position.set(view.x, view.y, 10);
    camera.zoom = view.zoom;
    camera.near = 0.1;
    camera.far = 100;
    camera.updateProjectionMatrix();
  });

  useEffect(() => {
    const local = (e: { clientX: number; clientY: number }) => {
      const r = dom.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const pick = (p: { x: number; y: number }) => {
      const w = view.toWorld(p.x, p.y);
      return grid.nearest(w.x, w.y, PICK_RADIUS / view.zoom, visible);
    };
    const pointers = new Map<number, { x: number; y: number }>();
    let down = { x: 0, y: 0 };
    let moved = false;
    let trail: { x: number; y: number; t: number }[] = [];

    const onDown = (e: PointerEvent) => {
      dom.setPointerCapture(e.pointerId);
      const p = local(e);
      pointers.set(e.pointerId, p);
      if (pointers.size === 1) {
        down = p;
        moved = false;
        trail = [{ ...p, t: e.timeStamp }];
      }
      view.interrupt(); // grabbing the map stops any glide or spring where it is
    };
    const onMove = (e: PointerEvent) => {
      const p = local(e);
      const prev = pointers.get(e.pointerId);
      if (!prev) {
        // Hover, no button down.
        const index = pick(p);
        dom.style.cursor = index >= 0 ? "pointer" : "grab";
        onHover(index >= 0 ? { index, ...p } : null);
        return;
      }
      onHover(null);
      if (Math.hypot(p.x - down.x, p.y - down.y) > DRAG_PX) moved = true;
      if (locked) return;
      if (pointers.size === 2) {
        // Pinch: zoom by the change in finger spread, about the fingers' midpoint, and pan with the midpoint.
        const [a, b] = [...pointers.values()];
        const other = a === prev ? b : a;
        const mid0 = { x: (prev.x + other.x) / 2, y: (prev.y + other.y) / 2 };
        const mid1 = { x: (p.x + other.x) / 2, y: (p.y + other.y) / 2 };
        const spread = Math.hypot(prev.x - other.x, prev.y - other.y);
        if (spread > 0) view.zoomAt(Math.hypot(p.x - other.x, p.y - other.y) / spread, mid1.x, mid1.y);
        view.panBy(mid1.x - mid0.x, mid1.y - mid0.y);
      } else {
        view.panBy(p.x - prev.x, p.y - prev.y);
        trail.push({ ...p, t: e.timeStamp });
        if (trail.length > 6) trail.shift();
      }
      pointers.set(e.pointerId, p);
    };
    const onUp = (e: PointerEvent) => {
      const p = local(e);
      const wasPinch = pointers.size > 1;
      pointers.delete(e.pointerId);
      if (pointers.size > 0) return;
      if (!moved) return onPick(pick(p)); // a click: select the star under the pointer, or clear on empty space
      if (locked || wasPinch) return;
      // Hand the drag's velocity to the glide, from the last ~100 ms of movement. A pointer that held still before
      // letting go has no velocity, so the map stays where it was put.
      const first = trail.find((s) => e.timeStamp - s.t < 100);
      const dt = first ? (e.timeStamp - first.t) / 1000 : 0;
      if (first && dt > 0) view.release((p.x - first.x) / dt, (p.y - first.y) / dt);
    };
    const onLeave = () => onHover(null);
    const onWheel = (e: WheelEvent) => {
      e.preventDefault(); // the map zooms; the page doesn't scroll
      if (locked) return;
      const p = local(e);
      const px = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      view.zoomAt(Math.exp(-px * WHEEL_ZOOM), p.x, p.y);
    };
    const onContext = (e: Event) => e.preventDefault(); // right-drag pans too

    dom.style.touchAction = "none";
    dom.addEventListener("pointerdown", onDown);
    dom.addEventListener("pointermove", onMove);
    dom.addEventListener("pointerup", onUp);
    dom.addEventListener("pointercancel", onUp);
    dom.addEventListener("pointerleave", onLeave);
    dom.addEventListener("wheel", onWheel, { passive: false });
    dom.addEventListener("contextmenu", onContext);
    return () => {
      dom.removeEventListener("pointerdown", onDown);
      dom.removeEventListener("pointermove", onMove);
      dom.removeEventListener("pointerup", onUp);
      dom.removeEventListener("pointercancel", onUp);
      dom.removeEventListener("pointerleave", onLeave);
      dom.removeEventListener("wheel", onWheel);
      dom.removeEventListener("contextmenu", onContext);
    };
  }, [view, grid, visible, locked, dom, onHover, onPick]);
  return null;
}

// Lines from the active idea star to its stored neighbours: only edges backed by saved data.
function Lines({ segments }: { segments: Float32Array }) {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(segments, 3));
    return g;
  }, [segments]);
  const mat = useMemo(() => new THREE.LineBasicMaterial({ color: "#4fd6e8", transparent: true, opacity: 0.55, depthWrite: false, depthTest: false }), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => mat.dispose(), [mat]);
  return <lineSegments geometry={geometry} material={mat} renderOrder={2} />;
}

export type Region = { key: string; label: string; count: number; at: number[] };

// Region names follow their centroid on screen at a constant size, whatever the zoom. Positions are written straight
// to the DOM each frame, so moving the view doesn't re-render React. A label near the idea star is hidden rather than
// covering it, and so is one off the map.
function Labels({ regions, layer, idea, view }: { regions: Region[]; layer: HTMLDivElement | null; idea: number[] | null; view: Viewport }) {
  useFrame(() => {
    if (!layer) return;
    const ideaAt = idea ? view.toScreen(idea[0], idea[1]) : null;
    regions.forEach((g, i) => {
      const el = layer.children[i] as HTMLElement | undefined;
      if (!el) return;
      const s = view.toScreen(g.at[0], g.at[1]);
      const onMap = s.x > 0 && s.y > 0 && s.x < view.width && s.y < view.height;
      const covers = ideaAt && Math.hypot(s.x - ideaAt.x, s.y - ideaAt.y) < 56;
      el.style.visibility = onMap && !covers ? "visible" : "hidden";
      el.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -50%)`;
    });
  });
  return null;
}

export default function Scene(props: {
  ids: string[];
  positions: Float32Array;
  visible: Uint8Array;
  view: Viewport;
  onHover: (h: Hover) => void;
  onPick: (index: number) => void;
  // Category colour per star (null = uncategorised), prize ring, and idea-focus dimming. All optional: without
  // categories the galaxy renders as before.
  colourAt?: (i: number) => readonly number[] | null;
  ringAt?: (i: number) => boolean;
  dimAt?: (i: number) => boolean;
  lines?: Float32Array;
  regions?: Region[];
  labelLayer?: HTMLDivElement | null;
}) {
  const { ids, positions, visible, view, onHover, onPick, colourAt, ringAt, dimAt, lines, regions, labelLayer } = props;
  const selectedId = useAppState((s) => s.selectedProjectId);
  const highlightedIds = useAppState((s) => s.highlightedIds);
  const ideaStars = useAppState((s) => s.ideaStars);
  const activeIdea = useAppState((s) => s.activeIdeaVersionId);

  // Selecting a project, from the map, the list, search or the drawer, flies the view to it.
  useEffect(() => {
    const i = selectedId ? ids.indexOf(selectedId) : -1;
    if (i >= 0) view.flyTo(positions[3 * i], positions[3 * i + 1]);
  }, [selectedId, ids, positions, view]);

  const corpusStyle = useMemo(() => {
    const highlighted = new Set(highlightedIds);
    return (i: number): Style => {
      if (!visible[i]) return HIDDEN;
      const marked = styleFor(ids[i], selectedId, highlighted);
      if (marked !== STYLE.base) return marked; // highlighted and selected keep their styles on top
      const colour = colourAt?.(i) ?? STYLE.base.color;
      const style: Style = ringAt?.(i) ? { color: colour, size: STYLE.prize.size, ring: true } : { color: colour, size: STYLE.base.size };
      return dimAt?.(i) ? { ...style, color: style.color.map((c) => c * 0.22) } : style;
    };
  }, [ids, visible, selectedId, highlightedIds, colourAt, ringAt, dimAt]);

  const ideaPositions = useMemo(() => new Float32Array(ideaStars.flatMap((s) => [s.x, s.y, s.z])), [ideaStars]);
  const ideaStyle = useMemo(
    () => (i: number) => (ideaStars[i].versionId === activeIdea ? STYLE.activeIdea : STYLE.idea),
    [ideaStars, activeIdea],
  );
  const idea = ideaStars.find((x) => x.versionId === activeIdea);

  return (
    <Canvas orthographic frameloop="demand" camera={{ position: [0, 0, 10], zoom: 1 }} aria-hidden>
      <StarPoints positions={positions} styleAt={corpusStyle} view={view} expose glow />
      {ideaStars.length > 0 && <StarPoints positions={ideaPositions} styleAt={ideaStyle} view={view} />}
      <Rig view={view} positions={positions} visible={visible} locked={selectedId !== null} onHover={onHover} onPick={onPick} />
      {lines && lines.length > 0 && <Lines segments={lines} />}
      {regions && regions.length > 0 && <Labels regions={regions} layer={labelLayer ?? null} idea={idea ? [idea.x, idea.y] : null} view={view} />}
    </Canvas>
  );
}
