import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Vertical depth measurement lines — faint dashed segments
 * representing depth tracks at 500m, 1000m, 1500m, 2000m.
 * Visibility is controlled by scroll progress via `visibilityRef`.
 */
export default function DepthLines({ visibilityRef, reducedMotion = false }) {
  const groupRef = useRef();

  // Depth marks at normalized scene positions
  const depthMarks = useMemo(() => [
    { label: '500m',  y: -1.5 },
    { label: '1000m', y: -3.0 },
    { label: '1500m', y: -4.5 },
    { label: '2000m', y: -6.0 },
  ], []);

  // Build the dashed line geometry
  const lineGeometry = useMemo(() => {
    const points = [
      new THREE.Vector3(0, 0.5, 0),
      new THREE.Vector3(0, -7.0, 0),
    ];
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    return geo;
  }, []);

  const lineMaterial = useMemo(() => {
    return new THREE.LineDashedMaterial({
      color: new THREE.Color('#7692FF'),
      dashSize: 0.15,
      gapSize: 0.1,
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
    });
  }, []);

  // Horizontal tick marks at each depth
  const tickGeometries = useMemo(() => {
    return depthMarks.map(mark => {
      const points = [
        new THREE.Vector3(-0.3, mark.y, 0),
        new THREE.Vector3(0.3, mark.y, 0),
      ];
      return new THREE.BufferGeometry().setFromPoints(points);
    });
  }, [depthMarks]);

  const tickMaterial = useMemo(() => {
    return new THREE.LineBasicMaterial({
      color: new THREE.Color('#ABD2FA'),
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
    });
  }, []);

  // Animate opacity based on scroll progress
  useFrame(() => {
    if (!groupRef.current) return;
    const visibility = visibilityRef?.current ?? 0;
    groupRef.current.visible = visibility > 0.05;
    
    // Fade in
    if (lineMaterial) {
      lineMaterial.opacity = visibility * 0.25;
    }
    if (tickMaterial) {
      tickMaterial.opacity = visibility * 0.35;
    }
  });

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      {/* Central vertical depth line */}
      <primitive object={new THREE.Line(lineGeometry, lineMaterial)} computeLineDistances />

      {/* Tick marks at each depth */}
      {tickGeometries.map((geo, i) => (
        <primitive key={i} object={new THREE.Line(geo, tickMaterial)} />
      ))}
    </group>
  );
}
