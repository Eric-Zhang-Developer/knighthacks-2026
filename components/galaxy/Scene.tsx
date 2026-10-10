"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { useAppState } from "@/lib/store";
import { pickNearest, STYLE, styleFor } from "./stars";

const PICK_RADIUS = 10; // CSS px
// Default camera distance in cloud radii: close enough that the cloud fills the chart; the bounding radius is set by a
// few outliers.
const VIEW_DISTANCE = 1.7;

// Round points with a per-star colour and size, so every corpus star is one draw call.
// Base stars are bare, dimmed dots so dense regions read brighter than sparse ones; only marked stars (bigger than
// base) glow. Base stars also shrink and fade with distance for depth; marked stars keep a fixed size.
const material = () =>
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    uniforms: { pixelRatio: { value: 1 }, refDist: { value: 1 } },
    vertexShader: `
      attribute vec3 starColor;
      attribute float size;
      attribute float ring;
      varying float vRing;
      uniform float pixelRatio;
      uniform float refDist; // the default camera distance, where a base star has its nominal size
      varying vec3 vColor;
      varying float vAlpha;
      varying float vGlow;
      void main() {
        vColor = starColor;
        vRing = ring;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vGlow = step(${STYLE.base.size + 0.5}, size); // 1 for any marked star: every marked style is bigger than base
        // Perspective size, clamped so far ones stay visible and a near base star (3 x 1.6) stays well under a highlighted
        // one (7): size, not just colour, still marks a star.
        float att = mix(clamp(refDist / -mv.z, 0.4, 1.6), 1.0, vGlow);
        // Base stars are translucent (0.6 at the default distance) so overlaps build up in dense regions; far ones fade.
        vAlpha = mix(clamp(0.6 * att, 0.3, 0.9), 1.0, vGlow);
        // Room for a halo around the core; the core keeps the star's nominal size.
        gl_PointSize = size * 2.2 * pixelRatio * att;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;
      varying float vGlow;
      varying float vRing;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        if (d > 1.0) discard;
        // A solid core (the exact star colour), inside a soft glow for marked stars only. A prize winner's core is
        // smaller and sits inside a ring: the shape marks it, not the colour.
        float core = 1.0 - smoothstep(mix(0.38, 0.22, vRing), mix(0.46, 0.3, vRing), d);
        float band = vRing * (smoothstep(0.58, 0.64, d) - smoothstep(0.8, 0.86, d));
        float halo = pow(1.0 - d, 2.2) * 0.45 * vGlow * (1.0 - vRing);
        gl_FragColor = vec4(vColor, max(max(core, band), halo) * vAlpha);
      }`,
  });

type Style = { color: readonly number[]; size: number; ring?: boolean };
const HIDDEN: Style = { color: STYLE.base.color, size: 0 };

// The e2e reads the live position buffer through this to prove a reveal never moves a star.
export type StarCanvas = HTMLCanvasElement & { starPositions?: ArrayLike<number> };

function StarPoints(props: {
  positions: Float32Array;
  styleAt: (i: number) => Style;
  refDist: number;
  expose?: boolean;
}) {
  const { positions, styleAt, refDist, expose } = props;
  const dpr = useThree((s) => s.viewport.dpr);
  const dom = useThree((s) => s.gl.domElement) as StarCanvas;
  const mat = useMemo(material, []);
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
  useEffect(() => () => mat.dispose(), [mat]);
  useEffect(() => {
    mat.uniforms.pixelRatio.value = dpr;
    mat.uniforms.refDist.value = refDist;
  }, [mat, dpr, refDist]);
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

  return <points geometry={geometry} material={mat} />;
}

function Controls({ center, radius, locked }: { center: THREE.Vector3; radius: number; locked: boolean }) {
  const camera = useThree((s) => s.camera);
  const dom = useThree((s) => s.gl.domElement);
  const controls = useMemo(() => new OrbitControls(camera, dom), [camera, dom]);

  useEffect(() => () => controls.dispose(), [controls]);
  useEffect(() => {
    camera.position.set(center.x, center.y, center.z + radius * VIEW_DISTANCE);
    camera.near = radius / 1000;
    camera.far = radius * 100;
    camera.updateProjectionMatrix();
    controls.target.copy(center);
    controls.update();
  }, [camera, controls, center, radius]);
  // The camera holds still while a selection's panel is open.
  useEffect(() => {
    controls.enabled = !locked;
  }, [controls, locked]);
  // Damping is the only camera motion the galaxy adds; reduced motion turns it off.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => (controls.enableDamping = !mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [controls]);
  useFrame(() => controls.update());
  return null;
}

export type Hover = { index: number; x: number; y: number } | null;

function Picker(props: {
  positions: Float32Array;
  visible: Uint8Array;
  onHover: (h: Hover) => void;
  onPick: (index: number) => void;
}) {
  const { positions, visible, onHover, onPick } = props;
  const camera = useThree((s) => s.camera);
  const dom = useThree((s) => s.gl.domElement);

  useEffect(() => {
    const screen = new Float32Array((positions.length / 3) * 2);
    const v = new THREE.Vector3();
    // Reproject only when the camera or canvas changed: hovering a still map is then a scan, not N projections.
    let projectedFor = "";
    const at = (e: PointerEvent | MouseEvent) => {
      const r = dom.getBoundingClientRect();
      const key = `${camera.matrixWorld.elements.join()}|${camera.projectionMatrix.elements.join()}|${r.width}x${r.height}`;
      if (key !== projectedFor) {
        projectedFor = key;
        for (let i = 0; i < positions.length / 3; i++) {
          v.set(positions[3 * i], positions[3 * i + 1], positions[3 * i + 2]).project(camera);
          const onScreen = visible[i] === 1 && v.z >= -1 && v.z <= 1;
          screen[2 * i] = onScreen ? ((v.x + 1) / 2) * r.width : NaN;
          screen[2 * i + 1] = onScreen ? ((1 - v.y) / 2) * r.height : NaN;
        }
      }
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      return { index: pickNearest(screen, x, y, PICK_RADIUS), x, y };
    };

    let down = { x: 0, y: 0 };
    const onDown = (e: PointerEvent) => (down = { x: e.clientX, y: e.clientY });
    const onMove = (e: PointerEvent) => {
      if (e.buttons) return onHover(null); // dragging the camera
      const h = at(e);
      dom.style.cursor = h.index >= 0 ? "pointer" : "";
      onHover(h.index >= 0 ? h : null);
    };
    const onLeave = () => onHover(null);
    const onClick = (e: MouseEvent) => {
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4) return; // a drag, not a click
      onPick(at(e).index);
    };

    dom.addEventListener("pointerdown", onDown);
    dom.addEventListener("pointermove", onMove);
    dom.addEventListener("pointerleave", onLeave);
    dom.addEventListener("click", onClick);
    return () => {
      dom.removeEventListener("pointerdown", onDown);
      dom.removeEventListener("pointermove", onMove);
      dom.removeEventListener("pointerleave", onLeave);
      dom.removeEventListener("click", onClick);
    };
  }, [positions, visible, camera, dom, onHover, onPick]);
  return null;
}

// Lines from the active idea star to its stored neighbours: only edges backed by saved data.
function Lines({ segments }: { segments: Float32Array }) {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(segments, 3));
    return g;
  }, [segments]);
  const mat = useMemo(() => new THREE.LineBasicMaterial({ color: "#4fd6e8", transparent: true, opacity: 0.55, depthWrite: false }), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => mat.dispose(), [mat]);
  return <lineSegments geometry={geometry} material={mat} />;
}

export type Region = { key: string; label: string; count: number; at: number[] };

// Region names follow their centroid on screen. Positions are written straight to the DOM each frame, so moving the
// camera doesn't re-render React. A label near the idea star is hidden rather than covering it.
function Labels({ regions, layer, idea }: { regions: Region[]; layer: HTMLDivElement | null; idea: number[] | null }) {
  const camera = useThree((s) => s.camera);
  const dom = useThree((s) => s.gl.domElement);
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    if (!layer) return;
    const r = dom.getBoundingClientRect();
    const toScreen = (p: number[]) => {
      v.set(p[0], p[1], p[2]).project(camera);
      return v.z < -1 || v.z > 1 ? null : [((v.x + 1) / 2) * r.width, ((1 - v.y) / 2) * r.height];
    };
    const ideaAt = idea ? toScreen(idea) : null;
    regions.forEach((g, i) => {
      const el = layer.children[i] as HTMLElement | undefined;
      if (!el) return;
      const s = toScreen(g.at);
      const covers = s && ideaAt && Math.hypot(s[0] - ideaAt[0], s[1] - ideaAt[1]) < 56;
      el.style.visibility = s && !covers ? "visible" : "hidden";
      if (s) el.style.transform = `translate(${s[0]}px, ${s[1]}px) translate(-50%, -50%)`;
    });
  });
  return null;
}

export default function Scene(props: {
  ids: string[];
  positions: Float32Array;
  visible: Uint8Array;
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
  const { ids, positions, visible, onHover, onPick, colourAt, ringAt, dimAt, lines, regions, labelLayer } = props;
  const selectedId = useAppState((s) => s.selectedProjectId);
  const highlightedIds = useAppState((s) => s.highlightedIds);
  const ideaStars = useAppState((s) => s.ideaStars);
  const activeIdea = useAppState((s) => s.activeIdeaVersionId);

  const { center, radius } = useMemo(() => {
    const sphere = new THREE.Box3()
      .setFromBufferAttribute(new THREE.BufferAttribute(positions, 3))
      .getBoundingSphere(new THREE.Sphere());
    return { center: sphere.center, radius: Math.max(sphere.radius, 1e-3) };
  }, [positions]);

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

  return (
    <Canvas camera={{ fov: 60 }} aria-hidden>
      <StarPoints positions={positions} styleAt={corpusStyle} refDist={radius * VIEW_DISTANCE} expose />
      {ideaStars.length > 0 && <StarPoints positions={ideaPositions} styleAt={ideaStyle} refDist={radius * VIEW_DISTANCE} />}
      <Controls center={center} radius={radius} locked={selectedId !== null} />
      <Picker positions={positions} visible={visible} onHover={onHover} onPick={onPick} />
      {lines && lines.length > 0 && <Lines segments={lines} />}
      {regions && regions.length > 0 && (
        <Labels regions={regions} layer={labelLayer ?? null} idea={(() => {
          const s = ideaStars.find((x) => x.versionId === activeIdea);
          return s ? [s.x, s.y, s.z] : null;
        })()} />
      )}
    </Canvas>
  );
}
