import { useEffect, useMemo, useRef } from "react";
import { Line } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import type { Geometry } from "./types";
export function AppliedMesh({
  geometry: g,
  onPoint,
  onDrag,
}: {
  geometry: Geometry;
  onPoint?: (x: number, y: number) => void;
  onDrag: (b: boolean) => void;
}) {
  const dragging = useRef(false),
    planeZ = useRef(0);
  const mesh = useMemo(() => {
    const geo = new THREE.BufferGeometry(),
      positions = g.points.flat(),
      indices: number[] = [],
      colors: number[] = [];
    g.points.forEach((p, i) => {
      const c = new THREE.Color(g.valid[i] ? "#9ecba1" : "#8b7d79");
      c.multiplyScalar(0.65 + (0.35 * p[2]) / 2.2);
      colors.push(c.r, c.g, c.b);
    });
    for (let j = 0; j < g.size - 1; j++)
      for (let i = 0; i < g.size - 1; i++) {
        const a = j * g.size + i;
        indices.push(a, a + 1, a + g.size, a + 1, a + g.size + 1, a + g.size);
      }
    geo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }, [g.points, g.valid, g.size]);
  useEffect(() => () => mesh.dispose(), [mesh]);
  function move(e: ThreeEvent<PointerEvent>) {
    if (!dragging.current || !onPoint) return;
    const v = new THREE.Vector3();
    if (
      e.ray.intersectPlane(
        new THREE.Plane(new THREE.Vector3(0, 0, 1), -planeZ.current),
        v,
      )
    )
      onPoint(v.x, v.y);
  }
  function stop() {
    dragging.current = false;
    onDrag(false);
  }
  return (
    <group>
      {g.size > 0 && (
        <mesh geometry={mesh}>
          <meshStandardMaterial
            vertexColors
            side={THREE.DoubleSide}
            transparent
            opacity={0.8}
          />
        </mesh>
      )}
      {g.lines.map((l, i) => (
        <Line
          key={i}
          points={l.points}
          color={l.color}
          lineWidth={l.label.includes("arm") ? 7 : 2.5}
          dashed={l.label.includes("constraint")}
          dashSize={0.12}
          gapSize={0.08}
        />
      ))}
      {g.spheres.map((s, i) => (
        <mesh key={i} position={s.point}>
          <sphereGeometry args={[s.radius, 20, 12]} />
          <meshStandardMaterial color={s.color} transparent opacity={0.65} />
        </mesh>
      ))}
      {g.gradient && <Line points={g.gradient} color="#edb58c" lineWidth={4} />}
      <mesh
        position={g.marker}
        onPointerDown={(e) => {
          if (!g.draggable || !onPoint) return;
          e.stopPropagation();
          dragging.current = true;
          planeZ.current = g.marker[2];
          onDrag(true);
          (e.target as unknown as HTMLElement).setPointerCapture?.(e.pointerId);
        }}
        onPointerMove={move}
        onPointerUp={stop}
        onPointerCancel={stop}
        onLostPointerCapture={stop}
      >
        <sphereGeometry args={[0.09, 20, 12]} />
        <meshStandardMaterial color="#eef7bd" emissive="#455128" />
      </mesh>
    </group>
  );
}
