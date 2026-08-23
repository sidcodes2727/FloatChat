import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  MapPin, Waves, BarChart3, Bot, Thermometer, Droplets,
  Gauge, ArrowRight, Sparkles, Globe, Database, Activity,
  ChevronRight, Anchor, Compass, Navigation
} from 'lucide-react';

import imgArgo from '../assets/argo-buoy.png';
import imgDatabase from '../assets/database-ingestion.jpg';
import imgDashboard from '../assets/dashboard-ui.png';
import bgImage from '../assets/argo-ocean-bg.jpg';

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
      whileHover={{ y: -3 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center"
        style={{ background: `${color}12`, border: `1px solid ${color}20` }}
      >
        <span style={{ color }}>{icon}</span>
      </div>
      <div>
        <p
          className="text-3xl font-bold tracking-tight leading-none"
          style={{
            fontFamily: "'Exo 2', sans-serif",
            background: `linear-gradient(135deg, #fff 20%, ${color} 100%)`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          {isString ? value : num.toLocaleString()}{suffix}
        </p>
        <p className="text-xs mt-1.5 font-semibold uppercase tracking-wider" style={{ color: 'rgba(232,244,253,0.4)', fontFamily: "'Exo 2', sans-serif" }}>{label}</p>
      </div>
    </motion.div>
  );
}

/* ─── Feature card ─── */
function FeatureCard({ icon, title, description, accentColor = '#00d4ff', onClick }) {
  return (
    <motion.div
      className="card-premium p-6 group cursor-pointer"
      whileHover={{ y: -4 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      onClick={onClick}
    >
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
        style={{
          background: `${accentColor}10`,
          border: `1px solid ${accentColor}20`,
        }}
      >
        <span style={{ color: accentColor }}>{icon}</span>
      </div>

      <h3
        className="text-[0.8rem] font-bold text-white mb-2 uppercase tracking-wider"
        style={{ fontFamily: "'Exo 2', sans-serif" }}
      >
        {title}
      </h3>
      <p className="text-sm leading-relaxed mb-4" style={{ color: 'rgba(232,244,253,0.5)', fontFamily: "'Exo 2', sans-serif" }}>
        {description}
      </p>

      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: accentColor, fontFamily: "'Exo 2', sans-serif" }}>Explore</span>
        <ChevronRight size={12} style={{ color: accentColor }} />
      </div>
    </motion.div>
  );
}

/* ─── Phase Section (split layout: text + image) ─── */
function PhaseSection({ phase, title, titleAccent, description, image, imageAlt, reverse = false, delay = 0 }) {
  return (
    <motion.section
      className={`flex flex-col ${reverse ? 'md:flex-row-reverse' : 'md:flex-row'} items-center gap-10 md:gap-16 py-16 md:py-24`}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, delay: delay * 0.1, ease: [0.4, 0, 0.2, 1] }}
    >
      {/* Text side */}
      <div className="flex-1 max-w-lg">
        <span
          className="text-[10px] font-bold uppercase tracking-[0.3em] mb-4 block"
          style={{ color: 'rgba(0, 212, 255, 0.6)', fontFamily: "'Exo 2', sans-serif" }}
        >
          {phase}
        </span>
        <h2
          className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6 leading-[1.1] tracking-tight"
          style={{ fontFamily: "'Exo 2', sans-serif" }}
        >
          <span className="text-white">{title} </span>
          <span
            style={{
              fontStyle: 'italic',
              fontFamily: "'Exo 2', sans-serif",
              fontWeight: 300,
              background: 'linear-gradient(135deg, #38e8ff, #00b4d8)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            {titleAccent}
          </span>
        </h2>
        <p
          className="text-base md:text-lg leading-relaxed"
          style={{ color: 'rgba(232, 244, 253, 0.55)', fontFamily: "'Exo 2', sans-serif" }}
        >
          {description}
        </p>
      </div>

      {/* Image side */}
      <div className="flex-1 max-w-lg w-full">
        <motion.div
          className="rounded-2xl overflow-hidden"
          style={{
            border: '1px solid rgba(0, 212, 255, 0.1)',
            boxShadow: '0 8px 40px rgba(0, 0, 0, 0.4)',
          }}
          whileHover={{ scale: 1.02 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        >
          <img
            src={image}
            alt={imageAlt}
            className="w-full h-auto object-cover"
            style={{ display: 'block' }}
          />
        </motion.div>
      </div>
    </motion.section>
  );
}

/* ─── Quick Explore Card ─── */
function QuickExploreCard({ icon, title, subtitle, accentColor, onClick }) {
  return (
    <motion.button
      onClick={onClick}
      className="card-premium p-5 text-left group w-full"
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    >
      <div className="flex items-center justify-between mb-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{
            background: `${accentColor}10`,
            border: `1px solid ${accentColor}20`,
          }}
        >
          <span style={{ color: accentColor }}>{icon}</span>
        </div>
        <ArrowRight
          size={15}
          className="transition-transform duration-200 group-hover:translate-x-1"
          style={{ color: accentColor, opacity: 0.4 }}
        />
      </div>
      <h4
        className="text-[0.75rem] font-bold text-white mb-1 uppercase tracking-wider"
        style={{ fontFamily: "'Exo 2', sans-serif" }}
      >
        {title}
      </h4>
      <p className="text-xs" style={{ color: 'rgba(232,244,253,0.45)', fontFamily: "'Exo 2', sans-serif" }}>{subtitle}</p>
    </motion.button>
  );
}

/* ─── Section Header ─── */
function SectionHeader({ label, title }) {
  return (
    <motion.div
      className="text-center mb-10"
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5 }}
    >
      <span
        className="text-[10px] font-bold uppercase tracking-[0.25em] mb-3 block"
        style={{ color: 'rgba(0, 212, 255, 0.6)', fontFamily: "'Exo 2', sans-serif" }}
      >
        {label}
      </span>
      <h2
        className="text-2xl md:text-3xl font-bold text-white"
        style={{ fontFamily: "'Exo 2', sans-serif" }}
      >
        {title}
      </h2>
    </motion.div>
  );
}

/* ─── Thin divider ─── */
function Divider() {
  return (
    <div
      className="w-full h-px"
      style={{ background: 'linear-gradient(90deg, transparent, rgba(0,212,255,0.12), transparent)' }}
    />
  );
}

/* ─── Main Home ─── */
export default function Home({ setActivePage, setChatOpen, mainScrollRef }) {
  return (
    <div className="flex-1 relative" style={{ background: 'var(--bg)' }}>

      {/* ═══ HERO ═══ */}
      <section
        className="relative flex flex-col justify-end overflow-hidden w-full"
        style={{
          minHeight: 'calc(100vh - 65px)',
          backgroundImage: `url(${bgImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        {/* Dark overlay at the bottom for text readability */}
        <div
          className="absolute inset-0 pointer-events-none z-0"
          style={{
            background: 'linear-gradient(to top, rgba(4, 12, 24, 1) 0%, rgba(4, 12, 24, 0.4) 40%, transparent 100%)',
          }}
        />

        <div className="relative z-10 w-full px-5 md:px-10 pb-12 flex flex-col items-start text-left">
          
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="w-full"
          >
            {/* The giant text like "EVASION" */}
            <h1
              className="font-normal tracking-wide uppercase select-none w-full leading-none"
              style={{
                fontFamily: "'Findet Nemo', sans-serif",
                fontSize: 'clamp(3rem, 10vw, 8rem)',
                color: '#ffffff',
                textShadow: '0 10px 40px rgba(0,0,0,0.5)',
              }}
            >
              FLOATCHAT
            </h1>
            <p className="mt-4 max-w-2xl text-lg md:text-xl font-medium tracking-wide" style={{ color: 'rgba(232, 244, 253, 0.85)', fontFamily: "'Findet Nemo', sans-serif" }}>
              AI-Powered Interactive Visualization from Autonomous ARGO Floats.
            </p>
          </motion.div>
          
          <motion.div
            className="mt-8 flex items-center justify-start gap-4 flex-wrap"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.6 }}
          >
            <button
              onClick={() => setActivePage('Argo Floats')}
              className="inline-flex items-center gap-2 px-8 py-4 btn-primary rounded-full text-base font-semibold shadow-xl hover:shadow-2xl transition-all"
              style={{ fontFamily: "'Findet Nemo', sans-serif" }}
            >
              <Compass size={18} />
              Explore Ocean Map
            </button>
            <button
              onClick={() => setChatOpen?.(true)}
              className="inline-flex items-center gap-2 px-8 py-4 bg-white/10 hover:bg-white/20 text-white rounded-full text-base font-semibold backdrop-blur-md border border-white/20 transition-all shadow-xl"
              style={{ fontFamily: "'Findet Nemo', sans-serif" }}
            >
              <Bot size={18} />
              Ask AI Assistant
            </button>
          </motion.div>
        </div>
      </section>

      {/* ═══ STATS BAR ═══ */}
      <section style={{ background: 'rgba(4,12,24,0.6)', borderTop: '1px solid rgba(0,212,255,0.06)', borderBottom: '1px solid rgba(0,212,255,0.06)' }}>
        <div className="max-w-6xl mx-auto px-5 md:px-10 py-8">
          <motion.div
            className="grid grid-cols-2 md:grid-cols-4 gap-4"
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <StatCounter value={3847}  label="Active Floats"   icon={<Activity size={18} />} color="#00d4ff" />
            <StatCounter value={12}    label="Ocean Regions"   icon={<Globe size={18} />}    color="#7c3aed" />
            <StatCounter value="2.4M"  label="Data Points"     icon={<Database size={18} />} color="#f97316" />
            <StatCounter value={147}   label="Countries"       icon={<MapPin size={18} />}   color="#22c55e" />
          </motion.div>
        </div>
      </section>

      {/* ═══ PHASE SECTIONS (split layout) ═══ */}
      <div className="max-w-6xl mx-auto px-5 md:px-10">

        <PhaseSection
          phase="Phase 01: Collection"
          title="Autonomous"
          titleAccent="Sensing"
          description="Thousands of autonomous Argo floats patrol the deep ocean. They continuously collect real-time, critical telemetry on temperature, salinity, and pressure from beneath the waves."
          image={imgArgo}
          imageAlt="Argo Float collecting ocean data"
          delay={0}
        />

        <Divider />

        <PhaseSection
          phase="Phase 02: Ingestion"
          title="Cloud"
          titleAccent="Processing"
          description="Every data point collected is instantly ingested into our cloud infrastructure, securely storing the ocean's metrics for real-time access, trend analysis, and AI-powered insights."
          image={imgDatabase}
          imageAlt="Cloud database ingestion pipeline"
          reverse
          delay={1}
        />

        <Divider />

        <PhaseSection
          phase="Phase 03: Intelligence"
          title="Interactive"
          titleAccent="Response"
          description="Query the ocean in real-time. Our interactive AI dashboard brings the deep sea directly to your screen with beautiful, insightful visualizations and natural-language analysis."
          image={imgDashboard}
          imageAlt="Interactive ocean dashboard"
          delay={2}
        />

      </div>

      <Divider />

      {/* ═══ FEATURES ═══ */}
      <section className="max-w-6xl mx-auto px-5 md:px-10 py-16 md:py-24">
        <SectionHeader label="Capabilities" title="Platform Features" />

        <motion.div
          className="grid md:grid-cols-3 gap-5"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.5 }}
        >
          <FeatureCard
            icon={<Waves size={22} />}
            title="Ocean Depth Profiles"
            description="Visualize ocean depth measurements with color-coded markers. Explore vertical profiles of temperature, salinity, and oxygen at any coordinate."
            accentColor="#00d4ff"
            onClick={() => setActivePage('Depth Profiles')}
          />
          <FeatureCard
            icon={<BarChart3 size={22} />}
            title="Advanced Analytics"
            description="Comprehensive analytics dashboard with real-time data processing. Monitor trends, detect anomalies, and compare oceanographic metrics."
            accentColor="#7c3aed"
            onClick={() => setActivePage('Depth Profiles')}
          />
          <FeatureCard
            icon={<Globe size={22} />}
            title="Global Coverage"
            description="Explore data from every major ocean basin. Complete coverage from the Arctic to the Antarctic with thousands of active measurement points."
            accentColor="#f97316"
            onClick={() => setActivePage('3D Globe')}
          />
        </motion.div>
      </section>

      <Divider />

      {/* ═══ QUICK EXPLORE ═══ */}
      <section className="max-w-6xl mx-auto px-5 md:px-10 py-16 md:py-24">
        <SectionHeader label="Quick Access" title="Explore by Metric" />

        <motion.div
          className="grid md:grid-cols-3 gap-5"
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.5 }}
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
      </section>

      {/* ═══ Bottom CTA ═══ */}
      <section className="max-w-6xl mx-auto px-5 md:px-10 pb-16 md:pb-24">
        <motion.div
          className="rounded-2xl p-10 text-center relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(0,212,255,0.05) 0%, rgba(124,58,237,0.04) 100%)',
            border: '1px solid rgba(0,212,255,0.1)',
          }}
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <Anchor size={28} className="mx-auto mb-4" style={{ color: '#00d4ff' }} />
          <h3
            className="text-xl md:text-2xl font-bold text-white mb-3"
            style={{ fontFamily: "'Exo 2', sans-serif" }}
          >
            Ready to explore the deep?
          </h3>
          <p className="text-sm mb-7" style={{ color: 'rgba(232,244,253,0.45)', fontFamily: "'Exo 2', sans-serif" }}>
            Thousands of data points from autonomous ARGO floats await your analysis.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <button
              onClick={() => setActivePage('Argo Floats')}
              className="inline-flex items-center gap-2 px-6 py-3 btn-primary rounded-xl text-sm"
              style={{ fontFamily: "'Exo 2', sans-serif" }}
            >
              <Compass size={15} />
              Open Ocean Map
            </button>
            <button
              onClick={() => setActivePage('Depth Profiles')}
              className="btn-outline inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm"
              style={{ fontFamily: "'Exo 2', sans-serif" }}
            >
              <BarChart3 size={15} />
              View Depth Profiles
            </button>
          </div>
        </motion.div>
      </section>

    </div>
  );
}
