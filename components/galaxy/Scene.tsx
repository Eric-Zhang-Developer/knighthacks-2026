"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useAppState } from "@/lib/store";
import { placeIdea } from "./layouts";
import { easeInOut, Morph, MORPH_GLSL } from "./morph";
import { pickNearest, STYLE, styleFor } from "./stars";
import { FOV, type Orbit, type Vec3 } from "./view";

const PICK_RADIUS = 10; // CSS px
const WHEEL_ZOOM = 0.0015; // per wheel pixel: one notch (~100px) is about 16%
const DRAG_PX = 4; // a pointer that moves less than this between down and up is a click, not a drag

// Light is added, never alpha: the canvas is transparent over the page's background, and writing alpha would punch
// dark discs through it. Every layer here is additive, so dense regions glow on their own.
const ADD = {
  transparent: true,
  depthWrite: false,
  depthTest: false,
  blending: THREE.CustomBlending,
  blendEquation: THREE.AddEquation,
  blendSrc: THREE.OneFactor,
  blendDst: THREE.OneFactor,
  blendSrcAlpha: THREE.ZeroFactor,
  blendDstAlpha: THREE.OneFactor,
} as const;

// Shared by the stars and their glow: size falls off with distance, and stars on the far side of the galaxy are
// dimmer and smaller than the near side (a cheap fog), measured from the orbit's target.
const DEPTH_GLSL = /* glsl */ `
  uniform float uPixelRatio;
  uniform float uFit;
  uniform float uDist;
  uniform float uScale; // smaller canvases get smaller stars, so a phone shows the same picture, not bigger blobs
  float atten(float depth) { return uScale * pow(uFit / max(depth, 0.02), 0.8); }
  float farness(float depth) { return clamp((depth - uDist) / 1.2 + 0.5, 0.0, 1.0); } // 0 near side, 1 far side
`;

const starUniforms = () => ({
  uPixelRatio: { value: 1 },
  uFit: { value: 2 },
  uDist: { value: 2 },
  uScale: { value: 1 },
  uMorph: { value: 1 },
  uTime: { value: 0 },
  uTwinkle: { value: 1 },
});

// The stars: a soft sprite per star with a white-hot core, a halo in its category colour, per-star brightness, a slow
// twinkle and depth cueing. A prize winner's core sits inside a ring, so the mark is a shape, not colour alone.
const starMaterial = () =>
  new THREE.ShaderMaterial({
    ...ADD,
    uniforms: starUniforms(),
    vertexShader: /* glsl */ `
      ${MORPH_GLSL}
      ${DEPTH_GLSL}
      attribute vec3 starColor;
      attribute float size;
      attribute float ring;
      uniform float uTime;
      uniform float uTwinkle;
      varying vec3 vColor;
      varying float vAlpha;
      varying float vRing;
      void main() {
        vec4 mv = modelViewMatrix * vec4(morphed(), 1.0);
        float depth = -mv.z;
        float far = farness(depth);
        float marked = step(${STYLE.highlighted.size - 0.5}, size); // highlighted, selected: full brightness
        float s2 = fract(seed * 91.7);
        float bright = 0.4 + 0.6 * pow(s2, 2.2);
        float tw = 1.0 - uTwinkle * 0.5 * smoothstep(0.75, 1.0, sin(uTime * (0.5 + 1.8 * fract(seed * 7.31)) + seed * 60.0));
        vAlpha = mix(bright * tw, 1.0, marked) * mix(1.3, 0.35, far);
        vColor = starColor;
        vRing = ring;
        float jitter = mix(0.7 + 0.7 * s2, 1.0, marked);
        gl_PointSize = min(size * jitter * 2.6 * uPixelRatio * atten(depth) * mix(1.15, 0.75, far), 90.0 * uPixelRatio);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vAlpha;
      varying float vRing;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        if (d > 1.0) discard;
        float core = exp(-d * d * 30.0);
        float halo = exp(-d * d * 6.0) * 0.22;
        float band = vRing * (smoothstep(0.56, 0.62, d) - smoothstep(0.68, 0.74, d)) * 0.4;
        float lum = max(vColor.r, max(vColor.g, vColor.b));
        vec3 col = vColor * (core + halo + band) + vec3(core * 0.6 * lum);
        gl_FragColor = vec4(col * vAlpha, 0.0);
      }`,
  });

// The nebula: every star again, large, faint and additive under the points, so each cloud glows in its own hue and
// dense regions glow brighter. It flies with the stars.
const glowMaterial = () =>
  new THREE.ShaderMaterial({
    ...ADD,
    uniforms: starUniforms(),
    vertexShader: /* glsl */ `
      ${MORPH_GLSL}
      ${DEPTH_GLSL}
      attribute vec3 starColor;
      attribute float size;
      varying vec3 vColor;
      void main() {
        vec4 mv = modelViewMatrix * vec4(morphed(), 1.0);
        float depth = -mv.z;
        vColor = starColor * mix(1.0, 0.35, farness(depth));
        // ponytail: one big quad per star; at ~55k stars this fill rate is the cost to watch (shrink the 32 first).
        gl_PointSize = size > 0.0 ? min(32.0 * uPixelRatio * atten(depth), 160.0 * uPixelRatio) : 0.0;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        if (d > 1.0) discard;
        gl_FragColor = vec4(vColor * exp(-d * d * 5.0) * 0.026, 0.0);
      }`,
  });

// Plain soft dots: the far starfield, the dust inside the galaxy, and idea stars. `uAtten` 0 = fixed pixel size.
const spriteMaterial = () =>
  new THREE.ShaderMaterial({
    ...ADD,
    uniforms: { uPixelRatio: { value: 1 }, uAtten: { value: 0 }, uTime: { value: 0 }, uTwinkle: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute vec3 color;
      attribute float size;
      attribute float seed;
      uniform float uPixelRatio;
      uniform float uAtten;
      uniform float uTime;
      uniform float uTwinkle;
      varying vec3 vColor;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float a = uAtten > 0.0 ? min(pow(uAtten / max(-mv.z, 0.02), 0.8), 6.0) : 1.0;
        vColor = color * (1.0 - uTwinkle * 0.35 * (0.5 + 0.5 * sin(uTime * (0.4 + seed) + seed * 40.0)));
        gl_PointSize = size * uPixelRatio * a;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        if (d > 1.0) discard;
        gl_FragColor = vec4(vColor * (exp(-d * d * 14.0) + exp(-d * d * 3.0) * 0.25), 0.0);
      }`,
  });

// HDR: the scene renders into a half-float target, then one full-screen pass adds a glow from the target's blurred
// mip levels (a bloom faked in the shader) and tone-maps by each pixel's brightest channel, so a dense cloud
// saturates into its own hue instead of clipping to white.
function Composite() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);
  const post = useMemo(() => {
    const rt = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
    });
    const mat = new THREE.ShaderMaterial({
      uniforms: { tScene: { value: rt.texture }, uExposure: { value: 0.95 }, uBloom: { value: 0.45 } },
      depthTest: false,
      depthWrite: false,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D tScene;
        uniform float uExposure;
        uniform float uBloom;
        varying vec2 vUv;
        void main() {
          vec3 base = texture2D(tScene, vUv).rgb;
          vec3 bloom = textureLod(tScene, vUv, 2.0).rgb * 0.35 + textureLod(tScene, vUv, 3.5).rgb * 0.45 + textureLod(tScene, vUv, 5.0).rgb * 0.6;
          vec3 c = (base + bloom * uBloom) * uExposure;
          float l = max(max(c.r, c.g), c.b);
          float m = 1.0 - exp(-l);
          vec3 hue = c / max(l, 1e-4);
          // Hue kept as it brightens; only the very brightest cores bleach a little toward white.
          vec3 col = mix(hue * m, vec3(m), smoothstep(2.0, 8.0, l) * 0.45);
          gl_FragColor = vec4(col, clamp(m, 0.0, 1.0)); // premultiplied: alpha 0 made a real GPU compositor drop every star
        }`,
    });
    const tri = new THREE.BufferGeometry();
    tri.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    const quad = new THREE.Mesh(tri, mat);
    quad.frustumCulled = false;
    const s = new THREE.Scene();
    s.add(quad);
    return { rt, mat, tri, scene: s, cam: new THREE.OrthographicCamera() };
  }, []);
  useEffect(() => post.rt.setSize(Math.round(size.width * dpr), Math.round(size.height * dpr)), [post, size, dpr]);
  useEffect(() => () => (post.rt.dispose(), post.mat.dispose(), post.tri.dispose()), [post]);
  // Priority 1: this frame callback does the rendering instead of r3f's default render.
  useFrame(() => {
    gl.setRenderTarget(post.rt);
    gl.setClearColor(0x000000, 0);
    gl.clear();
    gl.render(scene, camera);
    gl.setRenderTarget(null);
    gl.clear();
    gl.render(post.scene, post.cam);
  }, 1);
  return null;
}

type Style = { color: readonly number[]; size: number; ring?: boolean };
const HIDDEN: Style = { color: STYLE.base.color, size: 0 };
const NEUTRAL_STAR = [0.72, 0.8, 0.95] as const; // before categories load: a cool white
const IDEA_RGB = [0.31, 0.84, 0.91] as const;
const SELECTED_RGB = [0.9, 0.92, 1] as const;

// The e2e reads the live layout positions through this (a reveal never moves a star).
// starScreen: the stars as drawn now (mid-flight too), in canvas pixels.
export type StarCanvas = HTMLCanvasElement & { starPositions?: ArrayLike<number>; starView?: Orbit; starScreen?: (idx: number[]) => { x: number; y: number }[]; starMorph?: Morph };

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function Stars(props: { positions: Float32Array; morph: Morph; styleAt: (i: number) => Style; view: Orbit }) {
  const { positions, morph, styleAt, view } = props;
  const dpr = useThree((s) => s.viewport.dpr);
  const dom = useThree((s) => s.gl.domElement) as StarCanvas;
  const n = positions.length / 3;
  const mats = useMemo(() => ({ star: starMaterial(), glow: glowMaterial() }), []);
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute("aFrom", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute("seed", new THREE.BufferAttribute(new Float32Array(n), 1));
    g.setAttribute("starColor", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute("size", new THREE.BufferAttribute(new Float32Array(n), 1));
    g.setAttribute("ring", new THREE.BufferAttribute(new Float32Array(n), 1));
    return g;
  }, [n]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => (mats.star.dispose(), mats.glow.dispose()), [mats]);

  // A new layout (or the first one): fly every star from where it is now.
  useEffect(() => {
    morph.set(positions, performance.now() / 1000, !reducedMotion());
    const set = (name: string, a: Float32Array) => {
      const attr = geometry.getAttribute(name) as THREE.BufferAttribute;
      attr.copyArray(a);
      attr.needsUpdate = true;
    };
    set("position", morph.to);
    set("aFrom", morph.from);
    set("seed", morph.seed);
    dom.starPositions = morph.to;
    // Frame the layout by where 97% of its stars are, so a stray outlier doesn't shrink the picture.
    const r = Float32Array.from({ length: n }, (_, i) => Math.hypot(positions[3 * i], positions[3 * i + 1], positions[3 * i + 2])).sort();
    if (n) view.setRadius(Math.max(0.2, r[Math.floor(n * 0.97)] * 1.05));
  }, [positions, morph, geometry, dom, n, view]);

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
  }, [geometry, styleAt]);

  const box = useThree((s) => s.size);
  const scale = Math.min(1.1, Math.max(0.45, Math.min(box.width, box.height) / 850));
  useFrame((state) => {
    morph.step(performance.now() / 1000);
    for (const m of [mats.star, mats.glow]) {
      const u = m.uniforms;
      u.uPixelRatio.value = dpr;
      u.uFit.value = view.fitDist;
      u.uDist.value = view.dist;
      u.uScale.value = scale;
      u.uMorph.value = morph.t;
      u.uTime.value = state.clock.elapsedTime;
      u.uTwinkle.value = view.reduced ? 0 : 1;
    }
  });

  return (
    <>
      <points geometry={geometry} material={mats.glow} renderOrder={1} frustumCulled={false} />
      <points geometry={geometry} material={mats.star} renderOrder={2} frustumCulled={false} />
    </>
  );
}

function mulberry(a: number) {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A cloud of sprites from per-point generators.
function sprites(n: number, at: () => Vec3, colour: () => Vec3, size: () => number, rand: () => number) {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    pos.set(at(), 3 * i);
    col.set(colour(), 3 * i);
  }
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.setAttribute("size", new THREE.BufferAttribute(Float32Array.from({ length: n }, size), 1));
  g.setAttribute("seed", new THREE.BufferAttribute(Float32Array.from({ length: n }, rand), 1));
  return { g, m: spriteMaterial() };
}

// Depth: a far starfield that moves with the camera (so it reads as infinitely far, turning but never sliding), and a
// faint dust in and around the galaxy that gives parallax as it turns.
function Sky({ view }: { view: Orbit }) {
  const dpr = useThree((s) => s.viewport.dpr);
  const far = useRef<THREE.Points>(null);
  const dust = useRef<THREE.Points>(null);
  const built = useMemo(() => {
    const rand = mulberry(7);
    const gauss = () => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());
    const onSphere = (r: number): Vec3 => {
      const u = rand() * 2 - 1;
      const t = rand() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      return [r * s * Math.cos(t), r * u, r * s * Math.sin(t)];
    };
    const tint = (b: number): Vec3 => {
      const k = rand();
      return k < 0.15 ? [b, b * 0.85, b * 0.7] : k < 0.55 ? [b * 0.78, b * 0.87, b] : [b, b, b];
    };
    return {
      far: sprites(2600, () => onSphere(30), () => tint(0.08 + 0.42 * Math.pow(rand(), 3)), () => 2 + 3 * Math.pow(rand(), 4), rand),
      dust: sprites(3200, () => [gauss() * 0.55, gauss() * 0.4, gauss() * 0.55], () => tint(0.05 + 0.08 * rand()), () => 1.2 + 2 * rand(), rand),
    };
  }, []);
  useEffect(() => () => [built.far, built.dust].forEach((x) => (x.g.dispose(), x.m.dispose())), [built]);
  useFrame((state, dt) => {
    for (const x of [built.far, built.dust]) {
      x.m.uniforms.uPixelRatio.value = dpr;
      x.m.uniforms.uTime.value = state.clock.elapsedTime;
      x.m.uniforms.uTwinkle.value = view.reduced ? 0 : 1;
    }
    built.dust.m.uniforms.uAtten.value = view.fitDist;
    far.current?.position.copy(state.camera.position);
    if (dust.current && !view.reduced) dust.current.rotation.y += dt * 0.012;
  });
  return (
    <>
      <points ref={far} geometry={built.far.g} material={built.far.m} renderOrder={0} frustumCulled={false} />
      <points ref={dust} geometry={built.dust.g} material={built.dust.m} renderOrder={0} frustumCulled={false} />
    </>
  );
}

export type Hover = { index: number; x: number; y: number } | null;

// Pointer, wheel and pinch input, and the camera: every frame the perspective camera is set from the orbit.
function Rig(props: { view: Orbit; morph: Morph; visible: Uint8Array; onHover: (h: Hover) => void; onPick: (index: number) => void }) {
  const { view, morph, visible, onHover, onPick } = props;
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const dom = useThree((s) => s.gl.domElement);
  const size = useThree((s) => s.size);

  useEffect(() => view.setAspect(size.width, size.height), [view, size]);
  useEffect(() => void ((dom as StarCanvas).starView = view), [dom, view]);
  useEffect(() => {
    const v = new THREE.Vector3();
    (dom as StarCanvas).starMorph = morph;
    (dom as StarCanvas).starScreen = (idx) => {
      const { width: w, height: h } = dom.getBoundingClientRect();
      return idx.map((i) => {
        v.set(morph.current[3 * i], morph.current[3 * i + 1], morph.current[3 * i + 2]).project(camera);
        return { x: ((v.x + 1) / 2) * w, y: ((1 - v.y) / 2) * h };
      });
    };
  }, [dom, morph, camera]);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => (view.reduced = mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [view]);
  useFrame((_, dt) => {
    view.step(Math.min(dt, 0.1));
    camera.position.set(...view.eye());
    camera.lookAt(...view.target);
    camera.updateMatrixWorld();
  });

  useEffect(() => {
    const v = new THREE.Vector3();
    const local = (e: { clientX: number; clientY: number }) => {
      const r = dom.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    // Project the stars as drawn now (mid-morph too) and take the nearest on screen.
    const pick = (p: { x: number; y: number }) => {
      const { width: w, height: h } = dom.getBoundingClientRect();
      const at = morph.current;
      const screen = new Float32Array(visible.length * 2).fill(NaN);
      for (let i = 0; i < visible.length; i++) {
        if (visible[i] !== 1) continue;
        v.set(at[3 * i], at[3 * i + 1], at[3 * i + 2]).project(camera);
        if (v.z > 1) continue;
        screen[2 * i] = ((v.x + 1) / 2) * w;
        screen[2 * i + 1] = ((1 - v.y) / 2) * h;
      }
      return pickNearest(screen, p.x, p.y, PICK_RADIUS);
    };
    const pointers = new Map<number, { x: number; y: number }>();
    let down = { x: 0, y: 0 };
    let moved = false;
    let panning = false;
    let trail: { x: number; y: number; t: number }[] = [];

    const onDown = (e: PointerEvent) => {
      dom.setPointerCapture(e.pointerId);
      const p = local(e);
      pointers.set(e.pointerId, p);
      if (pointers.size === 1) {
        down = p;
        moved = false;
        panning = e.button === 2 || e.button === 1 || e.shiftKey;
        trail = [{ ...p, t: e.timeStamp }];
      }
      view.interrupt();
      view.dragging = true;
    };
    const onMove = (e: PointerEvent) => {
      const p = local(e);
      const prev = pointers.get(e.pointerId);
      view.poke(); // a pointer over the map holds the drift, so a star stays under it
      if (!prev) {
        const index = pick(p);
        dom.style.cursor = index >= 0 ? "pointer" : "grab";
        onHover(index >= 0 ? { index, ...p } : null);
        return;
      }
      onHover(null);
      if (Math.hypot(p.x - down.x, p.y - down.y) > DRAG_PX) moved = true;
      if (pointers.size === 2) {
        // Pinch: zoom by the change in finger spread.
        const other = [...pointers.values()].find((q) => q !== prev)!;
        const spread = Math.hypot(prev.x - other.x, prev.y - other.y);
        if (spread > 0) view.dollyBy(Math.hypot(p.x - other.x, p.y - other.y) / spread);
      } else if (panning) {
        view.panBy(p.x - prev.x, p.y - prev.y, dom.getBoundingClientRect().height);
      } else {
        view.rotateBy(p.x - prev.x, p.y - prev.y);
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
      view.dragging = false;
      if (!moved) return onPick(pick(p)); // a click: select the star under the pointer, or clear on empty space
      if (wasPinch || panning) return;
      // Hand the drag's velocity to the spin, from the last ~100 ms of movement.
      const first = trail.find((s) => e.timeStamp - s.t < 100);
      const dt = first ? (e.timeStamp - first.t) / 1000 : 0;
      if (first && dt > 0) view.release((p.x - first.x) / dt, (p.y - first.y) / dt);
    };
    const onLeave = () => onHover(null);
    const onWheel = (e: WheelEvent) => {
      e.preventDefault(); // the map zooms; the page doesn't scroll
      const px = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      view.dollyBy(Math.exp(-px * WHEEL_ZOOM));
    };
    const onContext = (e: Event) => e.preventDefault();

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
  }, [view, morph, visible, dom, camera, onHover, onPick]);
  return null;
}

export type Idea = { neighbours: number[]; own: Vec3; lines: boolean };
const SEG = 40; // segments per tentacle

// Where the active idea sits in the layout as drawn now.
const ideaAt = (idea: Idea, morph: Morph) => placeIdea(idea.neighbours, morph.current, idea.own);

// Idea focus: a dotted arc from the idea to each stored neighbour, bowing outward and flowing toward the neighbour,
// rebuilt every frame so it follows the stars through a morph.
function Tentacles({ idea, morph, view }: { idea: Idea; morph: Morph; view: Orbit }) {
  const count = idea.neighbours.length;
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const u = new Float32Array(count * SEG * 2);
    for (let k = 0; k < count * SEG; k++) {
      u[2 * k] = (k % SEG) / SEG;
      u[2 * k + 1] = ((k % SEG) + 1) / SEG;
    }
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * SEG * 6), 3));
    g.setAttribute("u", new THREE.BufferAttribute(u, 1));
    return g;
  }, [count]);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        ...ADD,
        uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(...IDEA_RGB) } },
        vertexShader: /* glsl */ `
          attribute float u;
          varying float vU;
          void main() { vU = u; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */ `
          uniform float uTime;
          uniform vec3 uColor;
          varying float vU;
          void main() {
            float dash = step(0.55, fract(vU * 34.0 - uTime * 0.8));
            float a = dash * mix(0.9, 0.35, vU) * smoothstep(0.0, 0.04, vU);
            gl_FragColor = vec4(uColor * a, 0.0);
          }`,
      }),
    [],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => mat.dispose(), [mat]);
  useFrame((state) => {
    mat.uniforms.uTime.value = view.reduced ? 0 : state.clock.elapsedTime;
    const a = ideaAt(idea, morph);
    const pos = geometry.getAttribute("position") as THREE.BufferAttribute;
    const out = pos.array as Float32Array;
    const at = morph.current;
    idea.neighbours.forEach((i, n) => {
      const b = [at[3 * i], at[3 * i + 1], at[3 * i + 2]];
      const m = [0, 1, 2].map((k) => (a[k] + b[k]) / 2);
      const len = Math.hypot(m[0], m[1], m[2]) || 1;
      const bow = 0.45 * Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) + 0.02;
      const c = [m[0] + (m[0] / len) * bow, m[1] + (m[1] / len) * bow + bow * 0.3, m[2] + (m[2] / len) * bow];
      const curve = (t: number) => [0, 1, 2].map((k) => (1 - t) * (1 - t) * a[k] + 2 * (1 - t) * t * c[k] + t * t * b[k]);
      for (let s = 0; s < SEG; s++) {
        const o = (n * SEG + s) * 6;
        out.set(curve(s / SEG), o);
        out.set(curve((s + 1) / SEG), o + 3);
      }
    });
    pos.needsUpdate = true;
  });
  return <lineSegments geometry={geometry} material={mat} renderOrder={3} frustumCulled={false} />;
}

// A pulsing reticle at a point: the active idea (cyan) or the selected star (white).
function Pulse({ at, colour, view }: { at: () => Vec3 | null; colour: readonly number[]; view: Orbit }) {
  const dpr = useThree((s) => s.viewport.dpr);
  const ref = useRef<THREE.Points>(null);
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(3), 3));
    return g;
  }, []);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        ...ADD,
        uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(colour[0], colour[1], colour[2]) }, uSize: { value: 56 } },
        vertexShader: /* glsl */ `
          uniform float uSize;
          void main() { gl_PointSize = uSize; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */ `
          uniform float uTime;
          uniform vec3 uColor;
          void main() {
            float d = length(gl_PointCoord - 0.5) * 2.0;
            float phase = fract(uTime * 0.5);
            float r = mix(0.28, 0.98, phase);
            float wave = (1.0 - smoothstep(0.0, 0.05, abs(d - r))) * (1.0 - phase) * 0.8;
            float still = (1.0 - smoothstep(0.0, 0.035, abs(d - 0.3))) * 0.7;
            gl_FragColor = vec4(uColor * (wave + still), 0.0);
          }`,
      }),
    [colour],
  );
  useEffect(() => () => (geometry.dispose(), mat.dispose()), [geometry, mat]);
  useFrame((state) => {
    const p = at();
    if (ref.current) ref.current.visible = p !== null;
    if (!p) return;
    const attr = geometry.getAttribute("position") as THREE.BufferAttribute;
    attr.setXYZ(0, ...p);
    attr.needsUpdate = true;
    mat.uniforms.uTime.value = view.reduced ? 0.3 : state.clock.elapsedTime;
    mat.uniforms.uSize.value = 56 * dpr;
  });
  return <points ref={ref} geometry={geometry} material={mat} renderOrder={4} frustumCulled={false} />;
}

type IdeaStar = { x: number; y: number; z: number; versionId: string };

// Idea stars: cyan, larger than any project. The active one sits where its neighbours are in the current layout;
// the rest keep their stored position (only their neighbours would place them in another layout).
function Ideas({ ideas, active, idea, morph, view }: { ideas: IdeaStar[]; active: string | null; idea: Idea | null; morph: Morph; view: Orbit }) {
  const dpr = useThree((s) => s.viewport.dpr);
  const built = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(ideas.flatMap((s) => [s.x, s.y, s.z])), 3));
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(ideas.flatMap(() => [...IDEA_RGB])), 3));
    g.setAttribute("size", new THREE.BufferAttribute(Float32Array.from(ideas, (s) => (s.versionId === active ? 30 : 20)), 1));
    g.setAttribute("seed", new THREE.BufferAttribute(new Float32Array(ideas.length), 1));
    return { g, m: spriteMaterial() };
  }, [ideas, active]);
  useEffect(() => () => (built.g.dispose(), built.m.dispose()), [built]);
  useFrame(() => {
    built.m.uniforms.uPixelRatio.value = dpr;
    built.m.uniforms.uAtten.value = view.fitDist;
    built.m.uniforms.uTwinkle.value = 0;
    const k = ideas.findIndex((s) => s.versionId === active);
    if (k < 0 || !idea) return;
    const attr = built.g.getAttribute("position") as THREE.BufferAttribute;
    attr.setXYZ(k, ...ideaAt(idea, morph));
    attr.needsUpdate = true;
  });
  return <points geometry={built.g} material={built.m} renderOrder={3} frustumCulled={false} />;
}

export type Region = { key: string; label: string; count: number; at: number[] };

// Region names follow their centroid on screen, written straight to the DOM each frame so moving the camera doesn't
// re-render React. Names on the far side of the galaxy fade back; behind the camera, off the map, or covering the idea
// they hide; during a morph they fade out and return where the clouds land.
function Labels({ regions, layer, idea, morph, view }: { regions: Region[]; layer: HTMLDivElement | null; idea: Idea | null; morph: Morph; view: Orbit }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    if (!layer) return;
    const toScreen = (p: ArrayLike<number>) => {
      v.set(p[0], p[1], p[2]).applyMatrix4(camera.matrixWorldInverse);
      const depth = -v.z;
      v.applyMatrix4(camera.projectionMatrix);
      return { x: ((v.x + 1) / 2) * size.width, y: ((1 - v.y) / 2) * size.height, depth };
    };
    const ideaS = idea ? toScreen(ideaAt(idea, morph)) : null;
    const settle = easeInOut(Math.max(0, (morph.t - 0.7) / 0.3));
    // Nearest first; a name that would overlap one already placed waits until the galaxy turns.
    const placed: { x0: number; x1: number; y0: number; y1: number }[] = [];
    const at = regions.map((g, i) => ({ i, s: toScreen(g.at) })).sort((a, b) => a.s.depth - b.s.depth);
    at.forEach(({ i, s }) => {
      const el = layer.children[i] as HTMLElement | undefined;
      if (!el) return;
      const w = (el.firstElementChild as HTMLElement | null)?.offsetWidth ?? 120;
      const box = { x0: s.x - w / 2, x1: s.x + w / 2, y0: s.y - 50, y1: s.y - 24 };
      const clash = placed.some((b) => box.x0 < b.x1 && box.x1 > b.x0 && box.y0 < b.y1 && box.y1 > b.y0);
      const onMap = s.depth > 0.05 && s.x > 0 && s.y > 0 && s.x < size.width && s.y < size.height;
      const covers = ideaS && Math.hypot(s.x - ideaS.x, s.y - ideaS.y) < 56;
      const far = Math.min(1, Math.max(0, (s.depth - view.dist) / 1.2 + 0.5));
      const opacity = onMap && !covers && !clash ? settle * (1 - 0.7 * far) : 0;
      if (opacity > 0.01) placed.push(box);
      el.style.visibility = opacity > 0.01 ? "visible" : "hidden";
      el.style.opacity = opacity.toFixed(3);
      el.style.transform = `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px)`;
    });
  });
  return null;
}

export default function Scene(props: {
  ids: string[];
  positions: Float32Array;
  visible: Uint8Array;
  view: Orbit;
  onHover: (h: Hover) => void;
  onPick: (index: number) => void;
  // Category colour per star (null = uncategorised), prize ring, and idea-focus dimming. All optional: without
  // categories every star is a cool white.
  colourAt?: (i: number) => readonly number[] | null;
  ringAt?: (i: number) => boolean;
  dimAt?: (i: number) => boolean;
  idea?: Idea | null;
  regions?: Region[];
  labelLayer?: HTMLDivElement | null;
}) {
  const { ids, positions, visible, view, onHover, onPick, colourAt, ringAt, dimAt, idea, regions, labelLayer } = props;
  const selectedId = useAppState((s) => s.selectedProjectId);
  const highlightedIds = useAppState((s) => s.highlightedIds);
  const ideaStars = useAppState((s) => s.ideaStars);
  const activeIdea = useAppState((s) => s.activeIdeaVersionId);
  const morph = useMemo(() => new Morph(), []);
  const selected = selectedId ? ids.indexOf(selectedId) : -1;

  // Selecting a project, from the map, the list, search or the drawer, flies the camera to frame it; clearing the
  // selection eases back to the whole galaxy.
  const hadSelection = useRef(false);
  useEffect(() => {
    view.held = selected >= 0;
    // Where the star ends up, so a layout switch while selected follows it to its new place.
    if (selected >= 0) view.flyTo([positions[3 * selected], positions[3 * selected + 1], positions[3 * selected + 2]]);
    else if (hadSelection.current) view.fit();
    hadSelection.current = selected >= 0;
  }, [selected, positions, morph, view]);

  const corpusStyle = useMemo(() => {
    const highlighted = new Set(highlightedIds);
    return (i: number): Style => {
      if (!visible[i]) return HIDDEN;
      const marked = styleFor(ids[i], selectedId, highlighted);
      if (marked !== STYLE.base) return marked; // highlighted and selected keep their styles on top
      const colour = colourAt?.(i) ?? NEUTRAL_STAR;
      const style: Style = ringAt?.(i) ? { color: colour, size: STYLE.prize.size, ring: true } : { color: colour, size: STYLE.base.size };
      return dimAt?.(i) ? { ...style, color: style.color.map((c) => c * 0.12) } : style;
    };
  }, [ids, visible, selectedId, highlightedIds, colourAt, ringAt, dimAt]);

  const ideaPoint = useMemo(() => (idea ? () => ideaAt(idea, morph) : null), [idea, morph]);
  const selectedPoint = useMemo(
    () => () => (selected >= 0 && morph.current.length ? ([morph.current[3 * selected], morph.current[3 * selected + 1], morph.current[3 * selected + 2]] as Vec3) : null),
    [selected, morph],
  );

  return (
    <Canvas dpr={[1, 2]} gl={{ antialias: true, alpha: true }} camera={{ fov: FOV, near: 0.005, far: 100, position: [0, 0, 2] }} aria-hidden>
      <Rig view={view} morph={morph} visible={visible} onHover={onHover} onPick={onPick} />
      <Composite />
      <Sky view={view} />
      <Stars positions={positions} morph={morph} styleAt={corpusStyle} view={view} />
      {ideaStars.length > 0 && <Ideas ideas={ideaStars} active={activeIdea} idea={idea ?? null} morph={morph} view={view} />}
      {idea && idea.lines && idea.neighbours.length > 0 && <Tentacles idea={idea} morph={morph} view={view} />}
      {ideaPoint && <Pulse at={ideaPoint} colour={IDEA_RGB} view={view} />}
      <Pulse at={selectedPoint} colour={SELECTED_RGB} view={view} />
      {regions && regions.length > 0 && <Labels regions={regions} layer={labelLayer ?? null} idea={idea ?? null} morph={morph} view={view} />}
    </Canvas>
  );
}
