import React, { useRef, useMemo, useEffect, useState, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import OceanParticles from './OceanParticles';
import ArgFloat from './ArgFloat';
import DepthLines from './DepthLines';

/* ─── Detect WebGL availability ─── */
function isWebGLAvailable() {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}

/* ─── Camera controller driven by external refs ─── */
function CameraRig({ cameraRef, mouseRef, reducedMotion }) {
  const { camera } = useThree();

  useFrame(() => {
    if (!cameraRef?.current) return;

    const target = cameraRef.current;

    // Lerp camera to target position
    camera.position.x += (target.x - camera.position.x) * 0.04;
    camera.position.y += (target.y - camera.position.y) * 0.04;
    camera.position.z += (target.z - camera.position.z) * 0.04;

    // Mouse parallax (subtle)
    if (!reducedMotion && mouseRef?.current) {
      const mx = mouseRef.current.x * 0.15;
      const my = mouseRef.current.y * 0.08;
      camera.position.x += (mx - camera.position.x * 0.02) * 0.02;
      camera.position.y += (my - camera.position.y * 0.01) * 0.02;
    }

    // Always look at a point slightly below camera
    camera.lookAt(0, camera.position.y - 1.5, 0);
  });

  return null;
}

/* ─── Scene lighting ─── */
function OceanLighting({ fogRef }) {
  const { scene } = useThree();

  useEffect(() => {
    // Deep navy fog
    scene.fog = new THREE.FogExp2('#091540', 0.06);
    scene.background = new THREE.Color('#060d2e');

    return () => {
      scene.fog = null;
      scene.background = null;
    };
  }, [scene]);

  // Update fog density from scroll
  useFrame(() => {
    if (scene.fog && fogRef?.current != null) {
      scene.fog.density += (fogRef.current - scene.fog.density) * 0.03;
    }
  });

  return (
    <>
      {/* Faint ambient — deep blue */}
      <ambientLight color="#1B2CC1" intensity={0.15} />

      {/* Top-down surface light bleed */}
      <directionalLight
        color="#ABD2FA"
        intensity={0.4}
        position={[2, 8, 3]}
      />

      {/* Dim fill from below — deep ocean glow */}
      <pointLight
        color="#7692FF"
        intensity={0.2}
        position={[0, -5, 2]}
        distance={20}
        decay={2}
      />
    </>
  );
}

/* ─── Main exported component ─── */
export default function OceanHeroCanvas({
  cameraRef,     // { current: { x, y, z } }
  floatRef,      // { current: { y } }
  depthVisRef,   // { current: number 0-1 }
  fogRef,        // { current: number }
  mouseRef,      // { current: { x, y } }
}) {
  const [hasWebGL, setHasWebGL] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [particleCount, setParticleCount] = useState(600);

  useEffect(() => {
    setHasWebGL(isWebGLAvailable());

    // Reduced motion preference
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mql.matches);
    const handler = (e) => setReducedMotion(e.matches);
    mql.addEventListener('change', handler);

    // Responsive particle count
    const w = window.innerWidth;
    if (w < 768) setParticleCount(200);
    else if (w < 1024) setParticleCount(400);
    else setParticleCount(600);

    return () => mql.removeEventListener('change', handler);
  }, []);

  // Fallback — static gradient if no WebGL
  if (!hasWebGL) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
          background: 'radial-gradient(ellipse at 30% 20%, #1B2CC1 0%, #091540 70%, #030a24 100%)',
        }}
      />
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
      }}
    >
      <Canvas
        dpr={[1, 1.5]}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
          stencil: false,
          depth: true,
        }}
        camera={{
          fov: 55,
          near: 0.1,
          far: 100,
          position: [0, 1, 8],
        }}
        style={{ pointerEvents: 'none' }}
      >
        <Suspense fallback={null}>
          <OceanLighting fogRef={fogRef} />
          <CameraRig
            cameraRef={cameraRef}
            mouseRef={mouseRef}
            reducedMotion={reducedMotion}
          />
          <OceanParticles count={particleCount} reducedMotion={reducedMotion} />
          <ArgFloat positionRef={floatRef} reducedMotion={reducedMotion} />
          <DepthLines visibilityRef={depthVisRef} reducedMotion={reducedMotion} />
        </Suspense>
      </Canvas>
    </div>
  );
}
