import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Ambient ocean particles — tiny suspended motes that drift slowly,
 * conveying the feeling of being underwater. Count adapts to device.
 */
export default function OceanParticles({ count = 600, reducedMotion = false }) {
  const meshRef = useRef();

  // Build particle positions + colors once
  const { positions, colors, sizes, velocities } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const siz = new Float32Array(count);
    const vel = new Float32Array(count * 3); // drift velocities

    // Palette RGB normalized
    const palette = [
      [118 / 255, 146 / 255, 255 / 255], // periwinkle
      [171 / 255, 210 / 255, 250 / 255], // light ocean
      [27 / 255, 44 / 255, 193 / 255],   // royal blue
      [200 / 255, 220 / 255, 255 / 255], // near-white mote
    ];

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;

      // Spread across a wide volume
      pos[i3]     = (Math.random() - 0.5) * 24;     // x: ±12
      pos[i3 + 1] = (Math.random() - 0.5) * 20;     // y: ±10
      pos[i3 + 2] = (Math.random() - 0.5) * 16;     // z: ±8

      // Pick a random palette color
      const c = palette[Math.floor(Math.random() * palette.length)];
      col[i3]     = c[0];
      col[i3 + 1] = c[1];
      col[i3 + 2] = c[2];

      // Varying sizes — most small, some medium
      siz[i] = 0.015 + Math.random() * 0.04;

      // Very slow drift velocities (Brownian-ish)
      vel[i3]     = (Math.random() - 0.5) * 0.003;
      vel[i3 + 1] = (Math.random() - 0.5) * 0.002;
      vel[i3 + 2] = (Math.random() - 0.5) * 0.002;
    }

    return { positions: pos, colors: col, sizes: siz, velocities: vel };
  }, [count]);

  // Animate drift each frame
  useFrame((_, delta) => {
    if (reducedMotion || !meshRef.current) return;

    const posAttr = meshRef.current.geometry.attributes.position;
    const arr = posAttr.array;

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      arr[i3]     += velocities[i3]     * delta * 60;
      arr[i3 + 1] += velocities[i3 + 1] * delta * 60;
      arr[i3 + 2] += velocities[i3 + 2] * delta * 60;

      // Wrap around bounds
      if (arr[i3] > 12) arr[i3] = -12;
      if (arr[i3] < -12) arr[i3] = 12;
      if (arr[i3 + 1] > 10) arr[i3 + 1] = -10;
      if (arr[i3 + 1] < -10) arr[i3 + 1] = 10;
      if (arr[i3 + 2] > 8) arr[i3 + 2] = -8;
      if (arr[i3 + 2] < -8) arr[i3 + 2] = 8;
    }

    posAttr.needsUpdate = true;
  });

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          array={positions}
          count={count}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          array={colors}
          count={count}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.06}
        vertexColors
        transparent
        opacity={0.6}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
