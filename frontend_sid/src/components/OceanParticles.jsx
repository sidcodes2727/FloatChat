import React, { useEffect, useRef } from 'react';

/**
 * Animated canvas background with floating ocean bubbles, 
 * subtle light rays, and drifting particles.
 */
export default function OceanParticles() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;
    let w, h;

    function resize() {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    // Particles
    const PARTICLE_COUNT = 60;
    const particles = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 2.5 + 0.5,
        dx: (Math.random() - 0.5) * 0.3,
        dy: -(Math.random() * 0.4 + 0.1),
        opacity: Math.random() * 0.4 + 0.1,
        pulse: Math.random() * Math.PI * 2,
      });
    }

    // Bubbles (larger, fewer)
    const BUBBLE_COUNT = 12;
    const bubbles = [];
    for (let i = 0; i < BUBBLE_COUNT; i++) {
      bubbles.push({
        x: Math.random() * w,
        y: h + Math.random() * h,
        r: Math.random() * 8 + 4,
        speed: Math.random() * 0.6 + 0.2,
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: Math.random() * 0.02 + 0.005,
        opacity: Math.random() * 0.12 + 0.04,
      });
    }

    // Light rays
    const RAYS = 5;
    const rays = [];
    for (let i = 0; i < RAYS; i++) {
      rays.push({
        x: Math.random() * w,
        width: Math.random() * 120 + 60,
        opacity: Math.random() * 0.03 + 0.01,
        speed: Math.random() * 0.15 + 0.05,
        drift: Math.random() * 0.3 - 0.15,
      });
    }

    let time = 0;

    function draw() {
      ctx.clearRect(0, 0, w, h);
      time += 0.016;

      // Light rays from top
      for (const ray of rays) {
        ray.x += ray.drift;
        if (ray.x > w + 200) ray.x = -200;
        if (ray.x < -200) ray.x = w + 200;

        const grad = ctx.createLinearGradient(ray.x, 0, ray.x, h);
        grad.addColorStop(0, `rgba(0, 212, 255, ${ray.opacity * (0.7 + 0.3 * Math.sin(time * ray.speed))})`);
        grad.addColorStop(0.5, `rgba(0, 180, 220, ${ray.opacity * 0.3})`);
        grad.addColorStop(1, 'rgba(0, 100, 150, 0)');

        ctx.beginPath();
        ctx.moveTo(ray.x - ray.width / 2, 0);
        ctx.lineTo(ray.x - ray.width * 0.8, h);
        ctx.lineTo(ray.x + ray.width * 0.8, h);
        ctx.lineTo(ray.x + ray.width / 2, 0);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();
      }

      // Floating particles
      for (const p of particles) {
        p.x += p.dx;
        p.y += p.dy;
        p.pulse += 0.02;

        if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; }
        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;

        const glow = p.opacity * (0.6 + 0.4 * Math.sin(p.pulse));
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 212, 255, ${glow})`;
        ctx.fill();

        // Subtle glow
        if (p.r > 1.5) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * 3, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(0, 212, 255, ${glow * 0.15})`;
          ctx.fill();
        }
      }

      // Bubbles
      for (const b of bubbles) {
        b.y -= b.speed;
        b.wobble += b.wobbleSpeed;
        const wx = Math.sin(b.wobble) * 15;

        if (b.y < -b.r * 2) {
          b.y = h + b.r * 2;
          b.x = Math.random() * w;
        }

        // Bubble outline
        ctx.beginPath();
        ctx.arc(b.x + wx, b.y, b.r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(0, 212, 255, ${b.opacity})`;
        ctx.lineWidth = 1;
        ctx.stroke();

        // Bubble highlight
        ctx.beginPath();
        ctx.arc(b.x + wx - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.25, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${b.opacity * 0.6})`;
        ctx.fill();
      }

      animId = requestAnimationFrame(draw);
    }

    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
      }}
    />
  );
}
