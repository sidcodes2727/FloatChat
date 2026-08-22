import React, { useRef, useEffect, useState } from 'react';
import { gsap } from 'gsap';

/**
 * Scientific telemetry overlay — fixed position HTML on top of the 3D canvas.
 * Shows depth, temperature, salinity, and float ID as the user scrolls.
 * Visibility is controlled by `progress` (0–1 scroll fraction).
 */
export default function TelemetryHUD({ progress = 0 }) {
  const containerRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  // Show HUD when progress is between 30% and 85%
  useEffect(() => {
    const shouldShow = progress > 0.3 && progress < 0.85;
    if (shouldShow !== isVisible) {
      setIsVisible(shouldShow);

      if (containerRef.current) {
        gsap.to(containerRef.current, {
          opacity: shouldShow ? 1 : 0,
          x: shouldShow ? 0 : -24,
          duration: 0.6,
          ease: 'power2.out',
        });
      }
    }
  }, [progress, isVisible]);

  // Interpolate data values based on scroll progress
  const depth = Math.round(lerp(0, 2000, clamp01((progress - 0.3) / 0.5)));
  const temp = lerp(18.5, 2.1, clamp01((progress - 0.3) / 0.5)).toFixed(1);
  const salinity = lerp(35.2, 34.8, clamp01((progress - 0.3) / 0.5)).toFixed(2);
  const pressure = Math.round(lerp(10, 2012, clamp01((progress - 0.3) / 0.5)));

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        left: 24,
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 15,
        opacity: 0,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          background: 'rgba(9, 21, 64, 0.7)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(118, 146, 255, 0.15)',
          borderRadius: 8,
          padding: '20px 24px',
          minWidth: 180,
        }}
      >
        {/* Title */}
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.15em',
          color: '#7692FF',
          marginBottom: 16,
          paddingBottom: 8,
          borderBottom: '1px solid rgba(118, 146, 255, 0.15)',
        }}>
          Live Telemetry
        </div>

        <TelemetryRow label="DEPTH" value={`${depth.toLocaleString()} m`} />
        <TelemetryRow label="TEMP" value={`${temp} °C`} />
        <TelemetryRow label="SALINITY" value={`${salinity} PSU`} />
        <TelemetryRow label="PRESSURE" value={`${pressure} dbar`} />
        <TelemetryRow label="FLOAT" value="3901234" dimValue />
      </div>
    </div>
  );
}

function TelemetryRow({ label, value, dimValue = false }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      marginBottom: 8,
      gap: 24,
    }}>
      <span style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 9,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        color: '#ABD2FA',
      }}>
        {label}
      </span>
      <span style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 13,
        fontWeight: 700,
        color: dimValue ? 'rgba(171, 210, 250, 0.6)' : '#ffffff',
        letterSpacing: '0.02em',
      }}>
        {value}
      </span>
    </div>
  );
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}
