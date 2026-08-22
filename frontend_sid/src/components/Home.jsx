import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  MapPin, Waves, BarChart3, Bot, Thermometer, Droplets,
  Gauge, ArrowRight, Sparkles, Globe, Database, Activity,
  ChevronRight, Zap, Shield, TrendingUp
} from 'lucide-react';
import ScrollyIntro from './ScrollyIntro';

/* ─── Animated counter hook ─── */
function useCounter(target, duration = 2000) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (target === 0) return;
    let start = 0;
    const step = Math.ceil(target / (duration / 16));
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setCount(target); clearInterval(timer); }
      else setCount(start);
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);
  return count;
}

/* ─── Stat counter card ─── */
function StatCounter({ value, label, suffix = '', icon, color = '#00d4ff' }) {
  const isString = typeof value === 'string';
  const num = useCounter(isString ? 0 : value);

  return (
    <motion.div
      className="stat-card flex flex-col gap-3"
      whileHover={{ scale: 1.02, y: -2 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center"
        style={{ background: `${color}18`, border: `1px solid ${color}25` }}
      >
        <span style={{ color }}>{icon}</span>
      </div>
      <div>
        <p
          className="text-3xl font-bold tracking-tight leading-none"
          style={{
            fontFamily: "'Space Grotesk', Inter, sans-serif",
            background: `linear-gradient(135deg, #fff 0%, ${color} 100%)`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          {isString ? value : num.toLocaleString()}{suffix}
        </p>
        <p className="text-xs mt-1.5 font-medium" style={{ color: 'rgba(232,244,253,0.45)' }}>{label}</p>
      </div>
    </motion.div>
  );
}

/* ─── Feature card ─── */
function FeatureCard({ icon, title, description, delay = 0, accentColor = '#00d4ff' }) {
  return (
    <motion.div
      className="card-premium p-6 group cursor-default"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay / 1000 + 0.1, duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      whileHover={{ y: -4 }}
    >
      {/* Icon */}
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
        style={{
          background: `${accentColor}14`,
          border: `1px solid ${accentColor}22`,
          boxShadow: `0 0 20px ${accentColor}10`,
        }}
      >
        <span style={{ color: accentColor }}>{icon}</span>
      </div>

      <h3 className="text-base font-semibold text-white mb-2" style={{ fontFamily: "'Space Grotesk', Inter, sans-serif" }}>
        {title}
      </h3>
      <p className="text-sm leading-relaxed" style={{ color: 'rgba(232,244,253,0.5)' }}>
        {description}
      </p>

      {/* Hover arrow */}
      <div className="flex items-center gap-1 mt-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <span className="text-xs font-medium" style={{ color: accentColor }}>Learn more</span>
        <ChevronRight size={12} style={{ color: accentColor }} />
      </div>

      {/* Glow spot */}
      <div
        className="absolute -bottom-10 -right-10 w-24 h-24 rounded-full pointer-events-none"
        style={{ background: `radial-gradient(circle, ${accentColor}08, transparent 70%)` }}
      />
    </motion.div>
  );
}

/* ─── Steps ─── */
function StepItem({ number, title, description, isLast = false }) {
  return (
    <div className="flex-1 flex flex-col md:flex-row items-start gap-0 group">
      <div className="flex flex-col md:flex-row items-center gap-0 flex-1">
        {/* Step circle */}
        <div className="relative flex flex-col items-center">
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold relative z-10"
            style={{
              background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.15), rgba(0, 212, 255, 0.08))',
              border: '1.5px solid rgba(0, 212, 255, 0.3)',
              color: '#00d4ff',
              fontFamily: "'Space Grotesk', Inter, sans-serif",
              boxShadow: '0 0 16px rgba(0, 212, 255, 0.15)',
            }}
          >
            {number}
          </div>
        </div>

        {/* Connector line */}
        {!isLast && (
          <div
            className="hidden md:block flex-1 h-px mx-4"
            style={{ background: 'linear-gradient(90deg, rgba(0,212,255,0.3), rgba(0,212,255,0.05))' }}
          />
        )}
      </div>
      {/* Text below in mobile, beside in desktop */}
      <div className="mt-3 md:mt-0 md:hidden text-center px-2">
        <h4 className="text-sm font-semibold text-white mb-1">{title}</h4>
        <p className="text-xs leading-relaxed" style={{ color: 'rgba(232,244,253,0.45)' }}>{description}</p>
      </div>
    </div>
  );
}

/* ─── Step labels (desktop only, separate row) ─── */
function StepLabel({ title, description }) {
  return (
    <div className="flex-1 text-center px-2">
      <h4 className="text-sm font-semibold text-white mb-1" style={{ fontFamily: "'Space Grotesk', Inter, sans-serif" }}>{title}</h4>
      <p className="text-xs leading-relaxed" style={{ color: 'rgba(232,244,253,0.45)' }}>{description}</p>
    </div>
  );
}

/* ─── Quick Explore Card ─── */
function QuickExploreCard({ icon, title, subtitle, accentColor, onClick, bgClass }) {
  return (
    <motion.button
      onClick={onClick}
      className="card-premium p-5 text-left group w-full"
      whileHover={{ scale: 1.02, y: -3 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    >
      <div className="flex items-center justify-between mb-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{
            background: `${accentColor}15`,
            border: `1px solid ${accentColor}25`,
          }}
        >
          <span style={{ color: accentColor }}>{icon}</span>
        </div>
        <ArrowRight
          size={15}
          className="transition-all duration-200 group-hover:translate-x-1"
          style={{ color: accentColor, opacity: 0.5 }}
        />
      </div>
      <h4 className="text-sm font-semibold text-white mb-1" style={{ fontFamily: "'Space Grotesk', Inter, sans-serif" }}>{title}</h4>
      <p className="text-xs" style={{ color: 'rgba(232,244,253,0.45)' }}>{subtitle}</p>

      {/* Bottom glow line on hover */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)` }}
      />
    </motion.button>
  );
}

/* ─── Floating orb decoration ─── */
function Orb({ size, color, style }) {
  return (
    <div
      className="hero-orb pointer-events-none select-none"
      style={{
        width: size,
        height: size,
        background: color,
        ...style,
      }}
    />
  );
}

/* ─── Main Home ─── */
export default function Home({ setActivePage, setChatOpen, mainScrollRef }) {
  return (
    <div className="flex-1 relative bg-[#040c1a]">
      {/* ═══ SCROLLYTELLING INTRO ═══ */}
      <ScrollyIntro scrollContainer={mainScrollRef} />

      {/* Background orbs */}
      <Orb
        size="600px"
        color="radial-gradient(circle, rgba(0,212,255,0.06), transparent 70%)"
        style={{ top: '-100px', left: '50%', transform: 'translateX(-50%)', animation: 'orb-float 8s ease-in-out infinite' }}
      />
      <Orb
        size="400px"
        color="radial-gradient(circle, rgba(124,58,237,0.05), transparent 70%)"
        style={{ top: '200px', right: '-100px', animation: 'orb-float 10s ease-in-out infinite reverse' }}
      />
      <Orb
        size="300px"
        color="radial-gradient(circle, rgba(0,212,255,0.04), transparent 70%)"
        style={{ bottom: '200px', left: '-80px', animation: 'orb-float 7s ease-in-out infinite' }}
      />

      <div className="max-w-5xl mx-auto px-4 md:px-8 py-10 md:py-14 relative z-10">

        {/* ═══ HERO ═══ */}
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
        >
          {/* Badge */}
          <motion.div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-7"
            style={{
              background: 'rgba(0, 212, 255, 0.08)',
              border: '1px solid rgba(0, 212, 255, 0.2)',
              backdropFilter: 'blur(8px)',
            }}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, duration: 0.4 }}
          >
            <Sparkles size={12} style={{ color: '#00d4ff' }} />
            <span className="text-xs font-semibold tracking-wide" style={{ color: '#00d4ff' }}>
              AI-Powered Ocean Intelligence
            </span>
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
              style={{ background: 'rgba(0,212,255,0.15)', color: '#38e8ff' }}
            >
              LIVE
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            className="text-5xl md:text-6xl lg:text-7xl font-bold mb-5 tracking-tight leading-[1.05]"
            style={{ fontFamily: "'Space Grotesk', Inter, sans-serif" }}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.55, ease: [0.4, 0, 0.2, 1] }}
          >
            <span className="text-white">Explore the </span>
            <span
              style={{
                background: 'linear-gradient(135deg, #38e8ff 0%, #00d4ff 45%, #0099cc 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Depths
            </span>
            <br />
            <span className="text-white">of Our </span>
            <span
              style={{
                background: 'linear-gradient(135deg, #a78bfa 0%, #7c3aed 55%, #5b21b6 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Oceans
            </span>
          </motion.h1>

          {/* Sub */}
          <motion.p
            className="text-base md:text-lg mb-10 max-w-xl mx-auto leading-relaxed"
            style={{ color: 'rgba(232,244,253,0.55)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25, duration: 0.5 }}
          >
            Interactive visualization from thousands of autonomous ARGO floats.
            Analyze temperature, salinity, pressure, and depth across the globe — powered by AI.
          </motion.p>

          {/* CTAs */}
          <motion.div
            className="flex items-center justify-center gap-3 flex-wrap"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.32, duration: 0.45 }}
          >
            <button
              onClick={() => setActivePage('Argo Floats')}
              className="inline-flex items-center gap-2 px-6 py-3 btn-primary rounded-xl text-sm"
            >
              <MapPin size={16} />
              Explore Ocean Map
              <ArrowRight size={14} className="ml-1" />
            </button>
            <button
              onClick={() => setChatOpen?.(true)}
              className="btn-outline inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm"
              aria-label="Open chatbot assistant"
            >
              <Bot size={16} />
              Ask AI Assistant
            </button>
          </motion.div>
        </motion.div>

        {/* ═══ STATS ═══ */}
        <motion.div
          className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-16"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
        >
          <StatCounter value={3847}  label="Active Floats"   icon={<Activity size={18} />} color="#00d4ff" />
          <StatCounter value={12}    label="Ocean Regions"   icon={<Globe size={18} />}    color="#7c3aed" />
          <StatCounter value="2.4M"  label="Data Points"     icon={<Database size={18} />} color="#f97316" />
          <StatCounter value={147}   label="Countries"       icon={<MapPin size={18} />}   color="#22c55e" />
        </motion.div>

        {/* ═══ FEATURES ═══ */}
        <div className="mb-16">
          <motion.div
            className="text-center mb-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.4 }}
          >
            <span
              className="text-xs font-semibold uppercase tracking-widest mb-2 block"
              style={{ color: '#00d4ff' }}
            >
              Capabilities
            </span>
            <h2
              className="text-2xl font-bold text-white"
              style={{ fontFamily: "'Space Grotesk', Inter, sans-serif" }}
            >
              Platform Features
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-4">
            <FeatureCard
              icon={<Waves size={20} />}
              title="Ocean Depth Profiles"
              description="Visualize ocean depth measurements with color-coded markers. Explore vertical profiles of temperature, salinity, and oxygen at any coordinate."
              delay={0}
              accentColor="#00d4ff"
            />
            <FeatureCard
              icon={<BarChart3 size={20} />}
              title="Advanced Analytics"
              description="Comprehensive analytics dashboard with real-time data processing. Monitor trends, detect anomalies, and compare oceanographic metrics across regions."
              delay={100}
              accentColor="#7c3aed"
            />
            <FeatureCard
              icon={<Globe size={20} />}
              title="Global Coverage"
              description="Explore oceanographic data from every major ocean basin. Complete coverage from the Arctic to the Antarctic with thousands of active measurement points."
              delay={200}
              accentColor="#f97316"
            />
          </div>
        </div>

        {/* ═══ HOW IT WORKS ═══ */}
        <motion.div
          className="card-premium p-8 mb-16"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
        >
          <div className="text-center mb-8">
            <span
              className="text-xs font-semibold uppercase tracking-widest mb-2 block"
              style={{ color: '#00d4ff' }}
            >
              Workflow
            </span>
            <h2
              className="text-2xl font-bold text-white"
              style={{ fontFamily: "'Space Grotesk', Inter, sans-serif" }}
            >
              How It Works
            </h2>
          </div>

          {/* Steps — circles + lines */}
          <div className="flex flex-col md:flex-row items-center gap-3 md:gap-0 mb-6">
            {[
              { n: '01', title: 'Select Region', desc: 'Click any point on the interactive map or enter coordinates to choose your area of interest.' },
              { n: '02', title: 'Analyze Data', desc: 'View depth profiles, temperature gradients, salinity distributions and pressure readings.' },
              { n: '03', title: 'AI Insights', desc: 'Ask floatCHAT to summarize patterns, detect anomalies, or compare different ocean regions.' },
            ].map((step, i, arr) => (
              <React.Fragment key={step.n}>
                <div className="flex-1 flex flex-col items-center text-center px-4">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm mb-4"
                    style={{
                      background: 'linear-gradient(135deg, rgba(0,212,255,0.15), rgba(0,212,255,0.06))',
                      border: '1.5px solid rgba(0,212,255,0.3)',
                      color: '#00d4ff',
                      fontFamily: "'Space Grotesk', Inter, sans-serif",
                      boxShadow: '0 0 20px rgba(0,212,255,0.12)',
                    }}
                  >
                    {step.n}
                  </div>
                  <h4 className="text-sm font-semibold text-white mb-1.5" style={{ fontFamily: "'Space Grotesk', Inter, sans-serif" }}>
                    {step.title}
                  </h4>
                  <p className="text-xs leading-relaxed" style={{ color: 'rgba(232,244,253,0.45)' }}>
                    {step.desc}
                  </p>
                </div>
                {i < arr.length - 1 && (
                  <div
                    className="hidden md:block w-16 h-px shrink-0"
                    style={{ background: 'linear-gradient(90deg, rgba(0,212,255,0.3), rgba(0,212,255,0.1))' }}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        </motion.div>

        {/* ═══ QUICK EXPLORE ═══ */}
        <div className="mb-4">
          <motion.div
            className="text-center mb-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7, duration: 0.4 }}
          >
            <span
              className="text-xs font-semibold uppercase tracking-widest mb-2 block"
              style={{ color: '#00d4ff' }}
            >
              Quick Access
            </span>
            <h2
              className="text-2xl font-bold text-white"
              style={{ fontFamily: "'Space Grotesk', Inter, sans-serif" }}
            >
              Explore by Metric
            </h2>
          </motion.div>

          <motion.div
            className="grid md:grid-cols-3 gap-4"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.75, duration: 0.45 }}
          >
            <QuickExploreCard
              icon={<Thermometer size={18} />}
              title="Temperature Map"
              subtitle="Sea surface & depth temperature gradients"
              accentColor="#f97316"
              onClick={() => setActivePage('Temperature')}
            />
            <QuickExploreCard
              icon={<Droplets size={18} />}
              title="Salinity Map"
              subtitle="Ocean salinity distribution & patterns"
              accentColor="#7c3aed"
              onClick={() => setActivePage('Salinity')}
            />
            <QuickExploreCard
              icon={<Gauge size={18} />}
              title="Pressure Map"
              subtitle="Pressure measurements at various depths"
              accentColor="#22c55e"
              onClick={() => setActivePage('Pressure')}
            />
          </motion.div>
        </div>

        {/* ═══ Bottom CTA Banner ═══ */}
        <motion.div
          className="mt-14 rounded-2xl p-8 text-center relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(0,212,255,0.07) 0%, rgba(124,58,237,0.06) 100%)',
            border: '1px solid rgba(0,212,255,0.14)',
          }}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.85, duration: 0.5 }}
        >
          {/* Glow */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 0%, rgba(0,212,255,0.08), transparent)' }}
          />
          <Zap size={28} className="mx-auto mb-3" style={{ color: '#00d4ff' }} />
          <h3 className="text-xl font-bold text-white mb-2" style={{ fontFamily: "'Space Grotesk', Inter, sans-serif" }}>
            Ready to explore the deep?
          </h3>
          <p className="text-sm mb-6" style={{ color: 'rgba(232,244,253,0.5)' }}>
            Thousands of data points from autonomous ARGO floats await your analysis.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <button
              onClick={() => setActivePage('Argo Floats')}
              className="inline-flex items-center gap-2 px-6 py-3 btn-primary rounded-xl text-sm"
            >
              <MapPin size={15} />
              Open Ocean Map
            </button>
            <button
              onClick={() => setActivePage('Depth Profiles')}
              className="btn-outline inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm"
            >
              <BarChart3 size={15} />
              View Depth Profiles
            </button>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
