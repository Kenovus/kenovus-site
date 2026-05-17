import { useMemo, useRef } from 'react';
import type { Mesh } from 'three';
import { Color } from 'three';
import { useFrame } from '@react-three/fiber/native';
import { Canvas } from '@react-three/fiber/native';

type Props = {
  bodyFatPercent: number;
};

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function HumanProxy({ bodyFatPercent }: Props) {
  const torso = useRef<Mesh>(null);
  const hips = useRef<Mesh>(null);
  const pct = clamp(bodyFatPercent, 5, 55);

  // Simple proxy model: higher body fat widens torso/hips and slightly narrows shoulder taper.
  const torsoScaleX = 0.8 + (pct - 5) * 0.018;
  const torsoScaleY = 1.1 + (pct - 5) * 0.003;
  const hipsScaleX = 0.85 + (pct - 5) * 0.02;
  const shoulderScaleX = 1.05 - (pct - 5) * 0.004;
  const tone = useMemo(() => new Color(pct > 30 ? '#c8a56a' : '#d8b682'), [pct]);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (torso.current) torso.current.rotation.y = Math.sin(t * 0.3) * 0.25;
    if (hips.current) hips.current.rotation.y = Math.sin(t * 0.3) * 0.25;
  });

  return (
    <group position={[0, -0.2, 0]}>
      {/* Head */}
      <mesh position={[0, 1.65, 0]}>
        <sphereGeometry args={[0.2, 28, 28]} />
        <meshStandardMaterial color={tone} metalness={0.05} roughness={0.7} />
      </mesh>

      {/* Shoulders/chest */}
      <mesh position={[0, 1.15, 0]} scale={[shoulderScaleX, 0.55, 0.4]}>
        <sphereGeometry args={[0.42, 32, 24]} />
        <meshStandardMaterial color={tone} metalness={0.05} roughness={0.7} />
      </mesh>

      {/* Torso */}
      <mesh ref={torso} position={[0, 0.45, 0]} scale={[torsoScaleX, torsoScaleY, 0.7]}>
        <capsuleGeometry args={[0.33, 0.85, 12, 20]} />
        <meshStandardMaterial color={tone} metalness={0.05} roughness={0.68} />
      </mesh>

      {/* Hips */}
      <mesh ref={hips} position={[0, -0.18, 0]} scale={[hipsScaleX, 0.7, 0.75]}>
        <sphereGeometry args={[0.42, 30, 20]} />
        <meshStandardMaterial color={tone} metalness={0.05} roughness={0.7} />
      </mesh>

      {/* Legs */}
      <mesh position={[-0.18, -0.95, 0]} scale={[0.22, 0.95, 0.24]}>
        <capsuleGeometry args={[0.2, 0.9, 10, 14]} />
        <meshStandardMaterial color={tone} metalness={0.05} roughness={0.74} />
      </mesh>
      <mesh position={[0.18, -0.95, 0]} scale={[0.22, 0.95, 0.24]}>
        <capsuleGeometry args={[0.2, 0.9, 10, 14]} />
        <meshStandardMaterial color={tone} metalness={0.05} roughness={0.74} />
      </mesh>

      {/* Arms */}
      <mesh position={[-0.58, 0.55, 0]} rotation={[0, 0, 0.2]} scale={[0.16, 0.82, 0.16]}>
        <capsuleGeometry args={[0.18, 0.88, 10, 14]} />
        <meshStandardMaterial color={tone} metalness={0.05} roughness={0.74} />
      </mesh>
      <mesh position={[0.58, 0.55, 0]} rotation={[0, 0, -0.2]} scale={[0.16, 0.82, 0.16]}>
        <capsuleGeometry args={[0.18, 0.88, 10, 14]} />
        <meshStandardMaterial color={tone} metalness={0.05} roughness={0.74} />
      </mesh>
    </group>
  );
}

export function BodyFatVisualizer3D({ bodyFatPercent }: Props) {
  return (
    <Canvas camera={{ position: [0, 0.7, 3.3], fov: 42 }}>
      <ambientLight intensity={0.75} />
      <directionalLight position={[3, 4, 2]} intensity={1.15} />
      <pointLight position={[-2, 1, 1]} intensity={0.35} />
      <HumanProxy bodyFatPercent={bodyFatPercent} />
    </Canvas>
  );
}
