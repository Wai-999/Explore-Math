import { useEffect, useMemo, useState } from "react";
import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Line } from "@react-three/drei";
import * as THREE from "three";
import type { SceneProps } from "./GeometryView";
import { transform, type Mat3, type Vec3 } from "../math/linear";
import { energy, gradient, tangentHeight } from "../math/calculus";
function AxisLabel({ text, position }: { text: string; position: Vec3 }) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(64, text.length * 24 + 16);
    canvas.height = 64;
    const ctx = canvas.getContext("2d")!;
    ctx.font = "36px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.strokeStyle = "#152523";
    ctx.lineWidth = 4;
    ctx.strokeText(text, canvas.width / 2, 32);
    ctx.fillStyle = "#d1ddd3";
    ctx.fillText(text, canvas.width / 2, 32);
    return new THREE.CanvasTexture(canvas);
  }, [text]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <sprite
      position={position}
      scale={[(0.36 * Math.max(64, text.length * 24 + 16)) / 64, 0.36, 1]}
    >
      <spriteMaterial map={texture} depthTest={false} />
    </sprite>
  );
}
function Arrow({
  to,
  color,
  from = [0, 0, 0],
  emphasis = 1,
}: {
  to: Vec3;
  color: string;
  from?: Vec3;
  emphasis?: number;
}) {
  const d = new THREE.Vector3(...to).sub(new THREE.Vector3(...from));
  const len = d.length();
  if (len < 1e-8) return null;
  const q = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    d.normalize(),
  );
  return (
    <group>
      <Line points={[from, to]} color={color} lineWidth={2.5 * emphasis} />
      <mesh position={to} quaternion={q}>
        <coneGeometry args={[0.045 * emphasis, 0.14 * emphasis, 12]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
}
function TransformScene({
  matrix,
  onMatrix,
  onDrag,
  highlight,
}: {
  matrix: Mat3;
  onMatrix?: (m: Mat3) => void;
  onDrag: (v: boolean) => void;
  highlight?: string;
}) {
  const [drag, setDrag] = useState<number | null>(null);
  const m = useMemo(
    () =>
      new THREE.Matrix4().set(
        matrix[0],
        matrix[1],
        matrix[2],
        0,
        matrix[3],
        matrix[4],
        matrix[5],
        0,
        matrix[6],
        matrix[7],
        matrix[8],
        0,
        0,
        0,
        0,
        1,
      ),
    [matrix],
  );
  const points: Vec3[] = [
    [0, 0, 0],
    [1, 0, 0],
    [1, 1, 0],
    [0, 1, 0],
    [0, 0, 1],
    [1, 0, 1],
    [1, 1, 1],
    [0, 1, 1],
  ];
  const edges = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 0],
    [4, 5],
    [5, 6],
    [6, 7],
    [7, 4],
    [0, 4],
    [1, 5],
    [2, 6],
    [3, 7],
  ];
  const finish = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setDrag(null);
    onDrag(false);
  };
  return (
    <>
      {edges.map(([a, b], i) => (
        <Line
          key={i}
          points={[points[a], points[b]]}
          color="#819b99"
          dashed
          dashSize={0.065}
          gapSize={0.065}
          transparent
          opacity={0.6}
        />
      ))}
      <group matrix={m} matrixAutoUpdate={false}>
        <mesh position={[0.5, 0.5, 0.5]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial
            color="#bce699"
            transparent
            opacity={highlight === "volume" ? 0.42 : 0.23}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
        {highlight === "area" && (
          <mesh position={[0.5, 0.5, 0]}>
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial
              color="#80d8cd"
              transparent
              opacity={0.55}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
        )}
        {edges.map(([a, b], i) => (
          <Line
            key={i}
            points={[points[a], points[b]]}
            color="#c9ed9f"
            lineWidth={
              highlight === "volume" || highlight === "area" ? 3.2 : 1.8
            }
          />
        ))}
      </group>
      {[0, 1, 2].map((c) => {
        const end: Vec3 = [matrix[c], matrix[c + 3], matrix[c + 6]],
          color = ["#d3ee9d", "#83d9cc", "#c5b2eb"][c];
        return (
          <group key={c}>
            <Arrow
              to={end}
              color={color}
              emphasis={highlight === "columns" ? 1.6 : 1}
            />
            <mesh
              position={end}
              onPointerDown={(e) => {
                if (!onMatrix) return;
                e.stopPropagation();
                (e.target as Element | null)?.setPointerCapture(e.pointerId);
                setDrag(c);
                onDrag(true);
              }}
              onPointerMove={(e) => {
                if (drag !== c || !onMatrix) return;
                e.stopPropagation();
                const p = new THREE.Vector3();
                const plane = new THREE.Plane(
                  new THREE.Vector3(0, 0, 1),
                  -matrix[c + 6],
                );
                if (!e.ray.intersectPlane(plane, p)) return;
                const next = [...matrix] as Mat3;
                next[c] = Math.max(
                  -3,
                  Math.min(3, Math.round(p.x * 100) / 100),
                );
                next[c + 3] = Math.max(
                  -3,
                  Math.min(3, Math.round(p.y * 100) / 100),
                );
                onMatrix(next);
              }}
              onPointerUp={finish}
              onPointerCancel={finish}
            >
              <sphereGeometry args={[0.085, 16, 12]} />
              <meshStandardMaterial
                color={color}
                emissive={color}
                emissiveIntensity={0.25}
              />
            </mesh>
          </group>
        );
      })}
      {highlight === "area" && (
        <AxisLabel
          text="image of xy face"
          position={transform(matrix, [0.5, 0.5, 0])}
        />
      )}
    </>
  );
}
function Surface({
  surface,
  point,
  path,
  highlight,
}: Extract<SceneProps, { kind: "calculus" }>) {
  const geometry = useMemo(() => {
    const n = 40,
      vertices: number[] = [],
      indices: number[] = [];
    for (let y = 0; y <= n; y++)
      for (let x = 0; x <= n; x++) {
        const a = -2.5 + (x * 5) / n,
          b = -2.5 + (y * 5) / n;
        vertices.push(a, b, energy(surface, [a, b]));
      }
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const a = y * (n + 1) + x,
          b = a + 1,
          c = a + n + 1,
          d = c + 1;
        indices.push(a, b, c, b, d, c);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    return g;
  }, [surface]);
  const tangent = useMemo(() => {
    const p = [
      [-0.6, -0.6],
      [0.6, -0.6],
      [0.6, 0.6],
      [-0.6, 0.6],
    ].map(([x, y]) => [
      point[0] + x,
      point[1] + y,
      tangentHeight(surface, point, [point[0] + x, point[1] + y]),
    ]);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(p.flat(), 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    g.computeVertexNormals();
    return g;
  }, [surface, point]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => tangent.dispose(), [tangent]);
  const g = gradient(surface, point);
  const slice = useMemo(() => {
    if (highlight !== "x-slice" && highlight !== "y-slice") return null;
    return Array.from({ length: 101 }, (_, i) => {
      const t = -2.5 + i * 0.05;
      const q: [number, number] =
        highlight === "x-slice" ? [t, point[1]] : [point[0], t];
      return [q[0], q[1], energy(surface, q)] as Vec3;
    });
  }, [highlight, surface, point]);
  return (
    <>
      <mesh geometry={geometry}>
        <meshStandardMaterial
          color="#5cae9c"
          roughness={0.8}
          side={THREE.DoubleSide}
          transparent
          opacity={0.68}
        />
      </mesh>
      <mesh geometry={geometry}>
        <meshBasicMaterial
          wireframe
          color="#95d1b7"
          transparent
          opacity={0.13}
        />
      </mesh>
      <mesh geometry={tangent}>
        <meshBasicMaterial
          color="#c9b3ea"
          side={THREE.DoubleSide}
          transparent
          opacity={0.4}
        />
      </mesh>
      {slice && (
        <>
          <Line
            points={slice}
            color={highlight === "x-slice" ? "#80d8cd" : "#cbb5eb"}
            lineWidth={4}
            depthTest={false}
          />
          <AxisLabel
            text={
              highlight === "x-slice"
                ? `x slice; y=${point[1].toFixed(2)}`
                : `y slice; x=${point[0].toFixed(2)}`
            }
            position={slice[80]}
          />
        </>
      )}
      {highlight === "origin" && (
        <>
          <mesh position={[0, 0, energy(surface, [0, 0])]}>
            <sphereGeometry args={[0.13, 16, 12]} />
            <meshBasicMaterial color="#f2c994" />
          </mesh>
          <AxisLabel
            text="origin (0,0)"
            position={[0, 0, energy(surface, [0, 0]) + 0.35]}
          />
        </>
      )}
      <mesh position={[point[0], point[1], energy(surface, point) + 0.06]}>
        <sphereGeometry args={[0.1, 16, 12]} />
        <meshStandardMaterial
          color="#e0f6af"
          emissive="#b5d580"
          emissiveIntensity={0.4}
        />
      </mesh>
      <Arrow
        from={[point[0], point[1], 0.035]}
        to={[point[0] - 0.4 * g[0], point[1] - 0.4 * g[1], 0.035]}
        color="#cbe8a1"
        emphasis={highlight === "gradient" ? 1.6 : 1}
      />
      {highlight === "gradient" && (
        <AxisLabel
          text="-0.4 grad E (xy)"
          position={[point[0] - 0.2 * g[0], point[1] - 0.2 * g[1], 0.35]}
        />
      )}
      {path.length > 1 && (
        <Line
          points={path.map(
            ([x, y]) => [x, y, energy(surface, [x, y]) + 0.06] as Vec3,
          )}
          color="#e1f6b6"
          lineWidth={3}
        />
      )}
    </>
  );
}
export default function ThreeStage({
  scene,
  onLost,
}: {
  scene: SceneProps;
  onLost: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const isSurface = scene.kind === "calculus";
  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 1.5]}
      camera={{
        position: isSurface ? [8, -10, 11] : [4.8, -7, 4.2],
        up: [0, 0, 1],
        fov: isSurface ? 48 : 38,
      }}
      gl={{ antialias: true, powerPreference: "low-power" }}
      onCreated={({ gl }) => {
        gl.domElement.dataset.ready = "true";
        gl.domElement.addEventListener(
          "webglcontextlost",
          (e) => {
            e.preventDefault();
            if (gl.domElement.isConnected) onLost();
          },
          { once: true },
        );
      }}
    >
      <ambientLight intensity={1.6} />
      <directionalLight position={[3, -4, 8]} intensity={2} />
      <gridHelper
        args={[10, 20, "#375753", "#233b39"]}
        rotation={[Math.PI / 2, 0, 0]}
        position={[0, 0, -0.025]}
      />
      <Arrow to={[3, 0, 0]} color="#839b91" />
      <Arrow to={[0, 3, 0]} color="#839b91" />
      <Arrow to={[0, 0, 3]} color="#839b91" />
      {(scene.kind === "linear" || scene.kind === "robot") && (
        <TransformScene
          matrix={scene.matrix}
          onMatrix={scene.kind === "linear" ? scene.onMatrix : undefined}
          onDrag={setDragging}
          highlight={scene.kind === "linear" ? scene.highlight : undefined}
        />
      )}
      {scene.kind === "calculus" && <Surface {...scene} />}
      <AxisLabel text="x" position={[3.15, 0, 0]} />
      <AxisLabel text="y" position={[0, 3.15, 0]} />
      <AxisLabel text="z" position={[0, 0, 3.15]} />
      <OrbitControls
        makeDefault
        enabled={!dragging}
        target={isSurface ? [0, 0, 1.7] : [0.2, 0.2, 0.4]}
        minDistance={3}
        maxDistance={25}
        enableDamping={false}
        maxPolarAngle={Math.PI * 0.89}
      />
    </Canvas>
  );
}
