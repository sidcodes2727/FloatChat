import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';

/**
 * Procedural ARGO float — a highly detailed scientific instrument modeled 
 * after the yellow reference design. Composed of primitive geometries.
 */
export default function ArgFloat({ 
  positionRef,        // external ref for scroll-driven Y position
  reducedMotion = false,
  ...props 
}) {
  const groupRef = useRef();

  // Materials — memoize to avoid recreation
  const materials = useMemo(() => ({
    yellow: new THREE.MeshStandardMaterial({
      color: new THREE.Color('#F4D03F'), // Bright yellow
      metalness: 0.2,
      roughness: 0.5,
    }),
    black: new THREE.MeshStandardMaterial({
      color: new THREE.Color('#1A1A1A'),
      metalness: 0.5,
      roughness: 0.6,
    }),
    white: new THREE.MeshStandardMaterial({
      color: new THREE.Color('#FFFFFF'),
      metalness: 0.1,
      roughness: 0.8,
    }),
    cyanGlow: new THREE.MeshStandardMaterial({
      color: new THREE.Color('#00FFFF'),
      emissive: new THREE.Color('#00FFFF'),
      emissiveIntensity: 1.5,
      metalness: 0.2,
      roughness: 0.2,
    }),
  }), []);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;

    const t = clock.getElapsedTime();

    // Gentle floating bob (sinusoidal)
    const bobY = reducedMotion ? 0 : Math.sin(t * 0.4) * 0.15;
    const bobX = reducedMotion ? 0 : Math.sin(t * 0.25) * 0.05;

    // Apply scroll-driven Y from external ref, plus bob
    const scrollY = positionRef?.current?.y ?? 0;
    groupRef.current.position.y = scrollY + bobY;
    groupRef.current.position.x = bobX;

    // Gentle rotation
    if (!reducedMotion) {
      groupRef.current.rotation.y = t * 0.15;
      // Slight tilt mimicking water current
      groupRef.current.rotation.x = Math.sin(t * 0.3) * 0.05;
      groupRef.current.rotation.z = Math.cos(t * 0.2) * 0.04;
    }
  });

  return (
    <group ref={groupRef} {...props} scale={0.7}>
      {/* ── Main Yellow Hull ── */}
      {/* Top hemisphere */}
      <mesh material={materials.yellow} position={[0, 0, 0]} scale={[1, 0.5, 1]}>
        <sphereGeometry args={[0.9, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      
      {/* Bottom hemisphere */}
      <mesh material={materials.yellow} position={[0, 0, 0]} scale={[1, 0.7, 1]}>
        <sphereGeometry args={[0.9, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
      </mesh>
      
      {/* Equatorial Rim */}
      <mesh material={materials.yellow} position={[0, 0, 0]}>
        <cylinderGeometry args={[0.93, 0.93, 0.06, 32]} />
      </mesh>

      {/* ── Text Details ── */}
      <group position={[0, 0.12, 0]} rotation={[-0.1, 0, 0]}>
        <Text position={[-0.45, 0, 0.81]} rotation={[0, -0.4, 0]} fontSize={0.12} color="#1A1A1A" fontWeight="bold">ARGO</Text>
        <Text position={[0.45, 0, 0.81]} rotation={[0, 0.4, 0]} fontSize={0.12} color="#1A1A1A" fontWeight="bold">FLOAT 3912</Text>
      </group>

      {/* ── Bottom Glowing Ring ── */}
      <mesh material={materials.cyanGlow} position={[0, -0.8, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.35, 0.03, 16, 32]} />
      </mesh>
      {/* Connecting struts for bottom ring */}
      {[0, 1, 2, 3].map(i => {
        const a = i * (Math.PI / 2);
        return (
          <mesh key={i} material={materials.cyanGlow} position={[Math.cos(a) * 0.35, -0.65, Math.sin(a) * 0.35]} rotation={[0, -a, 0]}>
            <cylinderGeometry args={[0.015, 0.015, 0.3, 8]} />
          </mesh>
        );
      })}

      {/* ── Center Black Sensor ── */}
      {/* Glowing base */}
      <mesh material={materials.cyanGlow} position={[0, 0.46, 0]}>
        <cylinderGeometry args={[0.32, 0.35, 0.04, 32]} />
      </mesh>
      {/* Main black cylinder */}
      <mesh material={materials.black} position={[0, 0.7, 0]}>
        <cylinderGeometry args={[0.25, 0.25, 0.4, 32]} />
      </mesh>
      {/* Dome cap */}
      <mesh material={materials.black} position={[0, 0.9, 0]}>
        <sphereGeometry args={[0.25, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>

      {/* ── Yellow Protective Cage ── */}
      {/* 3 angled struts */}
      {[0, 1, 2].map(i => (
        <group key={i} rotation={[0, i * (Math.PI * 2 / 3), 0]}>
          <mesh material={materials.yellow} position={[0.32, 0.85, 0]} rotation={[0, 0, 0.38]}>
            <cylinderGeometry args={[0.035, 0.035, 0.8, 12]} />
          </mesh>
        </group>
      ))}
      {/* Top collar */}
      <mesh material={materials.yellow} position={[0, 1.22, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.18, 0.035, 12, 24]} />
      </mesh>
      {/* Inner glow under mast */}
      <mesh material={materials.cyanGlow} position={[0, 1.22, 0]}>
        <cylinderGeometry args={[0.15, 0.15, 0.04, 16]} />
      </mesh>

      {/* ── Mast ── */}
      <mesh material={materials.yellow} position={[0, 1.6, 0]}>
        <cylinderGeometry args={[0.04, 0.06, 0.7, 16]} />
      </mesh>
      <mesh material={materials.yellow} position={[0, 1.95, 0]}>
        <cylinderGeometry args={[0.15, 0.15, 0.04, 16]} />
      </mesh>

      {/* ── GPS Box ── */}
      <mesh material={materials.white} position={[0, 2.05, 0]}>
        <boxGeometry args={[0.28, 0.16, 0.28]} />
      </mesh>
      <Text position={[0, 2.05, 0.141]} fontSize={0.07} color="#222222" fontWeight="bold">GPS</Text>
      
      {/* ── Top Antennas ── */}
      <mesh material={materials.black} position={[0.08, 2.4, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 0.6, 8]} />
      </mesh>
      <mesh material={materials.black} position={[-0.08, 2.5, 0.06]}>
        <cylinderGeometry args={[0.02, 0.02, 0.8, 8]} />
      </mesh>

      {/* ── Side Mounted Instruments ── */}
      {/* Left side */}
      <group position={[0.45, 0.25, 0.45]} rotation={[0.2, Math.PI / 4, -0.2]}>
        <mesh material={materials.yellow} position={[0, 0.1, 0]}>
          <cylinderGeometry args={[0.06, 0.06, 0.2, 16]} />
        </mesh>
        <mesh material={materials.black} position={[0, 0.35, 0]}>
          <cylinderGeometry args={[0.025, 0.025, 0.5, 8]} />
        </mesh>
      </group>
      {/* Right side */}
      <group position={[-0.45, 0.25, 0.45]} rotation={[0.2, -Math.PI / 4, 0.2]}>
        <mesh material={materials.yellow} position={[0, 0.1, 0]}>
          <cylinderGeometry args={[0.06, 0.06, 0.2, 16]} />
        </mesh>
        <mesh material={materials.black} position={[0, 0.45, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 0.7, 8]} />
        </mesh>
      </group>
    </group>
  );
}
