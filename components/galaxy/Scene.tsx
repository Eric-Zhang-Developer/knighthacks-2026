"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { useAppState } from "@/lib/store";
import { pickNearest, STYLE, styleFor } from "./stars";

const PICK_RADIUS = 10; // CSS px

// Fixed-pixel round points with a per-star colour and size, so every corpus star is one draw call.
const material = () =>
  new THREE.ShaderMaterial({
    uniforms: { pixelRatio: { value: 1 } },
    vertexShader: `
      attribute vec3 starColor;
      attribute float size;
      uniform float pixelRatio;
      varying vec3 vColor;
      void main() {
        vColor = starColor;
        gl_PointSize = size * pixelRatio;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      varying vec3 vColor;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        if (dot(c, c) > 0.25) discard;
        gl_FragColor = vec4(vColor, 1.0);
      }`,
  });

type Style = { color: readonly number[]; size: number };
const HIDDEN: Style = { color: STYLE.base.color, size: 0 };

// The e2e reads the live position buffer through this to prove a reveal never moves a star.
export type StarCanvas = HTMLCanvasElement & { starPositions?: ArrayLike<number> };

function StarPoints(props: { positions: Float32Array; styleAt: (i: number) => Style; expose?: boolean }) {
  const { positions, styleAt, expose } = props;
  const dpr = useThree((s) => s.viewport.dpr);
  const dom = useThree((s) => s.gl.domElement) as StarCanvas;
  const mat = useMemo(material, []);
  const geometry = useMemo(() => {
    const n = positions.length / 3;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("starColor", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute("size", new THREE.BufferAttribute(new Float32Array(n), 1));
    return g;
  }, [positions]);

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => {
    if (expose) dom.starPositions = geometry.getAttribute("position").array;
  }, [expose, dom, geometry]);
  useEffect(() => () => mat.dispose(), [mat]);
  useEffect(() => {
    mat.uniforms.pixelRatio.value = dpr;
  }, [mat, dpr]);
  useEffect(() => {
    const color = geometry.getAttribute("starColor") as THREE.BufferAttribute;
    const size = geometry.getAttribute("size") as THREE.BufferAttribute;
    for (let i = 0; i < size.count; i++) {
      const s = styleAt(i);
      color.setXYZ(i, s.color[0], s.color[1], s.color[2]);
      size.setX(i, s.size);
    }
    color.needsUpdate = size.needsUpdate = true;
  }, [geometry, styleAt]);

  return <points geometry={geometry} material={mat} />;
}

function Controls({ center, radius, locked }: { center: THREE.Vector3; radius: number; locked: boolean }) {
  const camera = useThree((s) => s.camera);
  const dom = useThree((s) => s.gl.domElement);
  const controls = useMemo(() => new OrbitControls(camera, dom), [camera, dom]);

  useEffect(() => () => controls.dispose(), [controls]);
  useEffect(() => {
    camera.position.set(center.x, center.y, center.z + radius * 2.5);
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
    const at = (e: PointerEvent | MouseEvent) => {
      const r = dom.getBoundingClientRect();
      for (let i = 0; i < positions.length / 3; i++) {
        v.set(positions[3 * i], positions[3 * i + 1], positions[3 * i + 2]).project(camera);
        const onScreen = visible[i] === 1 && v.z >= -1 && v.z <= 1;
        screen[2 * i] = onScreen ? ((v.x + 1) / 2) * r.width : NaN;
        screen[2 * i + 1] = onScreen ? ((1 - v.y) / 2) * r.height : NaN;
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

export default function Scene(props: {
  ids: string[];
  positions: Float32Array;
  visible: Uint8Array;
  onHover: (h: Hover) => void;
  onPick: (index: number) => void;
}) {
  const { ids, positions, visible, onHover, onPick } = props;
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
    return (i: number) => (visible[i] ? styleFor(ids[i], selectedId, highlighted) : HIDDEN);
  }, [ids, visible, selectedId, highlightedIds]);

  const ideaPositions = useMemo(() => new Float32Array(ideaStars.flatMap((s) => [s.x, s.y, s.z])), [ideaStars]);
  const ideaStyle = useMemo(
    () => (i: number) => (ideaStars[i].versionId === activeIdea ? STYLE.activeIdea : STYLE.idea),
    [ideaStars, activeIdea],
  );

  return (
    <Canvas camera={{ fov: 60 }} aria-hidden>
      <color attach="background" args={["#07080c"]} />
      <StarPoints positions={positions} styleAt={corpusStyle} expose />
      {ideaStars.length > 0 && <StarPoints positions={ideaPositions} styleAt={ideaStyle} />}
      <Controls center={center} radius={radius} locked={selectedId !== null} />
      <Picker positions={positions} visible={visible} onHover={onHover} onPick={onPick} />
    </Canvas>
  );
}
