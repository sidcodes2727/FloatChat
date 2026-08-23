import React, { useEffect, useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  MapPin, Waves, BarChart3, Bot, Thermometer, Droplets,
  Gauge, ArrowRight, Sparkles, Globe, Database, Activity,
  ChevronRight
} from 'lucide-react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { cn } from '../lib/utils';
import argoBuoyImg from '../assets/argo-buoy.png';
import databaseImg from '../assets/database-ingestion.jpg';
import dashboardImg from '../assets/dashboard-ui.png';
import bgImg from '../assets/bg.jpg';

gsap.registerPlugin(ScrollTrigger);

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
function StatCounter({ value, label, suffix = '', icon, color = 'var(--color-periwinkle)' }) {
  const isString = typeof value === 'string';
  const num = useCounter(isString ? 0 : value);

  return (
    <motion.div
      className="flex flex-col gap-3 py-6 px-4 border-l border-border"
      whileHover={{ x: 4 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    >
      <div className="flex items-center gap-2 mb-1">
        <span style={{ color }}>{icon}</span>
        <p className="text-[10px] font-bold font-mono uppercase tracking-widest text-muted-foreground">{label}</p>
      </div>
      <div>
        <p className="text-4xl font-display text-foreground tracking-tight">
          {isString ? value : num.toLocaleString()}{suffix}
        </p>
      </div>
    </motion.div>
  );
}

/* ─── Feature card ─── */
function FeatureCard({ icon, title, description, delay = 0 }) {
  return (
    <motion.div
      className="card p-8 group cursor-default h-full flex flex-col"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay / 1000 + 0.1, duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
    >
      <div className="w-12 h-12 rounded-full flex items-center justify-center mb-6 bg-muted text-foreground transition-colors group-hover:bg-periwinkle group-hover:text-white">
        {icon}
      </div>

      <h3 className="text-xl font-display text-foreground mb-3">
        {title}
      </h3>
      <p className="text-sm leading-relaxed font-sans text-muted-foreground flex-1">
        {description}
      </p>

      <div className="flex items-center gap-1 mt-6 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <span className="text-xs font-semibold uppercase tracking-wider text-periwinkle">Learn more</span>
        <ChevronRight size={14} className="text-periwinkle" />
      </div>
    </motion.div>
  );
}

/* ─── Quick Explore Card ─── */
function QuickExploreCard({ icon, title, subtitle, onClick }) {
  return (
    <motion.button
      onClick={onClick}
      className="group w-full text-left p-6 border border-border rounded-lg bg-background hover:border-periwinkle hover:shadow-sm transition-all duration-300"
      whileTap={{ scale: 0.98 }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="text-foreground group-hover:text-periwinkle transition-colors">
          {icon}
        </div>
        <ArrowRight
          size={16}
          className="text-muted-foreground group-hover:text-periwinkle group-hover:translate-x-1 transition-all"
        />
      </div>
      <h4 className="text-lg font-display text-foreground mb-1">{title}</h4>
      <p className="text-sm font-sans text-muted-foreground">{subtitle}</p>
    </motion.button>
  );
}





const SCROLL_SECTIONS = [
  {
    phase: '01',
    label: 'Collection',
    heading: <>Autonomous <span className="italic text-periwinkle">Sensing</span></>,
    body: 'Thousands of autonomous Argo floats patrol the deep ocean. They continuously collect real-time, critical telemetry on temperature, salinity, and pressure from beneath the waves.',
    image: argoBuoyImg,
  },
  {
    phase: '02',
    label: 'Descent',
    heading: <>Into the <span className="italic text-royal-blue">Deep</span></>,
    body: 'Each float descends through the water column, sampling temperature and salinity at every depth — from the sunlit surface to the crushing abyss at 2,000 meters below.',
    image: bgImg,
  },
  {
    phase: '03',
    label: 'Measurement',
    heading: <>Scientific <span className="italic text-periwinkle">Data</span></>,
    body: 'Temperature gradients, salinity distributions, and pressure profiles are captured with laboratory precision. This data forms the backbone of global ocean monitoring.',
    image: databaseImg,
  },
  {
    phase: '04',
    label: 'Analysis',
    heading: <>AI-Powered <span className="italic text-royal-blue">Insights</span></>,
    body: 'Query the ocean through natural language. FloatCHAT synthesizes millions of data points into immediate, actionable oceanographic intelligence.',
    image: dashboardImg,
  },
];

/* ─── Main Home ─── */
export default function Home({ setActivePage, setChatOpen, mainScrollRef }) {
  const [scrollProgress, setScrollProgress] = useState(0);
  const heroSectionRef = useRef(null);

  useEffect(() => {
    const container = mainScrollRef?.current;
    if (!container) return;
    const trigger = heroSectionRef.current;
    if (!trigger) return;

    const st = ScrollTrigger.create({
      trigger: trigger,
      scroller: container,
      start: 'top top',
      end: 'bottom bottom',
      scrub: 0.8,
      onUpdate: (self) => {
        setScrollProgress(self.progress);
      },
    });

    return () => st.kill();
  }, [mainScrollRef]);
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.hero-word', { yPercent: 100, opacity: 0, stagger: 0.08, duration: 0.9, ease: 'power3.out', delay: 0.3 });
      gsap.from('.hero-sub', { opacity: 0, y: 20, duration: 0.7, ease: 'power2.out', delay: 0.8 });
      gsap.from('.hero-cta', { opacity: 0, y: 12, duration: 0.5, ease: 'power2.out', delay: 1.0 });
    });
    return () => ctx.revert();
  }, []);

  return (
    <div className="flex-1 relative bg-background">
      <div className="relative z-10">
        <div ref={heroSectionRef} style={{ height: '500vh' }}>
          <div className="sticky top-0 left-0 w-full h-screen overflow-hidden flex items-center">
            <div className="max-w-7xl mx-auto px-6 md:px-12 w-full">

              {/* Scroll Story Sections */}
              {SCROLL_SECTIONS.map((section, idx) => {
                const start = idx * 0.26;
                const fadeOutStart = start + 0.20;
                const fadeOutEnd = start + 0.26;
                
                let sectionOpacity = 0;
                if (scrollProgress >= start && scrollProgress <= fadeOutEnd) {
                  const fadeIn = idx === 0 
                    ? 1 
                    : (scrollProgress - start) / 0.06;
                    
                  const fadeOut = idx === SCROLL_SECTIONS.length - 1
                    ? 1
                    : (fadeOutEnd - scrollProgress) / 0.06;
                    
                  sectionOpacity = Math.max(0, Math.min(1, fadeIn, fadeOut));
                }
                
                return (
                  <div key={section.phase} className="absolute top-0 left-0 w-full h-full flex items-center pointer-events-none" style={{ opacity: sectionOpacity }}>
                    <div className="max-w-7xl mx-auto px-6 md:px-12 w-full grid md:grid-cols-2 gap-16 items-center">
                      {/* Text Column */}
                      <div>
                        <span className="font-mono text-xs md:text-sm font-bold uppercase tracking-[0.2em] text-muted-foreground mb-6 block">
                          Phase {section.phase}: {section.label}
                        </span>
                        <h2 className="text-4xl md:text-5xl lg:text-6xl text-foreground font-display mb-6 leading-[1.15]">
                          {section.heading}
                        </h2>
                        <p className="text-lg md:text-xl text-muted-foreground font-sans leading-relaxed max-w-xl">
                          {section.body}
                        </p>
                      </div>
                      
                      {/* Image Column */}
                      <div className="relative rounded-xl overflow-hidden shadow-lg">
                        <div className="aspect-[4/3] w-full">
                          {section.image && (
                            <img src={section.image} alt={section.label} className="w-full h-full object-cover" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          
          {/* Data Analysis Button (pinned bottom-left like in video) */}
          <div className="fixed bottom-6 left-6 z-20 hidden md:block transition-opacity duration-300" style={{ opacity: scrollProgress < 0.9 ? 1 : 0 }}>
            <button
              onClick={() => setActivePage('Depth Profiles')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-deep-navy text-white text-[11px] font-mono font-bold uppercase tracking-widest shadow-lg hover:bg-royal-blue transition-colors cursor-pointer"
            >
              <BarChart3 size={14} />
              Data Analysis
            </button>
          </div>

          {/* Scroll progress bar (right edge) */}
          <div className="fixed right-6 bottom-6 z-20 pointer-events-none hidden md:flex items-center gap-3 transition-opacity duration-300" style={{ opacity: scrollProgress > 0.01 && scrollProgress < 0.9 ? 0.6 : 0 }}>
            <div className="w-[2px] h-16 bg-border rounded-full relative overflow-hidden">
              <div className="w-full bg-periwinkle absolute top-0 rounded-full" style={{ height: `${scrollProgress * 100}%` }} />
            </div>
          </div>
        </div>

        <div className="bg-background relative z-10">
          <div className="max-w-7xl mx-auto px-6 md:px-12 py-16 md:py-24">
            
            {/* Main Hero (moved below scroll animation) */}
            <div className="py-24 mb-12">
              <div className="inline-flex items-center gap-2 px-3 py-1 mb-8 border border-border rounded-full bg-muted/50">
                <Sparkles size={12} className="text-periwinkle" />
                <span className="text-[10px] font-semibold tracking-widest font-mono uppercase text-muted-foreground">
                  Ocean Telemetry Active
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded font-bold font-mono bg-periwinkle/10 text-periwinkle border border-periwinkle/20">
                  LIVE
                </span>
              </div>
              <h1 className="text-5xl md:text-7xl lg:text-[5.5rem] mb-8 tracking-tight font-display text-foreground overflow-hidden">
                <span className="hero-word inline-block">Explore&nbsp;</span>
                <span className="hero-word inline-block">the&nbsp;</span>
                <span className="hero-word inline-block italic text-royal-blue">Depths</span>
                <br />
                <span className="hero-word inline-block">of&nbsp;</span>
                <span className="hero-word inline-block">Our&nbsp;</span>
                <span className="hero-word inline-block text-periwinkle">Oceans.</span>
              </h1>
              <p className="hero-sub text-lg md:text-xl mb-12 max-w-2xl leading-relaxed font-sans text-muted-foreground">
                Interactive visualization from thousands of autonomous ARGO floats.
                Analyze temperature, salinity, pressure, and depth across the globe—powered by conversational AI.
              </p>
              <div className="hero-cta flex items-center gap-4 flex-wrap">
                <button
                  onClick={() => setActivePage('Argo Floats')}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-md font-sans font-medium text-sm bg-royal-blue text-white hover:bg-[#1d4ed8] transition-all shadow-md cursor-pointer"
                >
                  <MapPin size={16} />
                  Init Ocean Map
                </button>
                <button
                  onClick={() => setChatOpen?.(true)}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-md font-sans font-medium text-sm border border-border text-foreground hover:bg-muted transition-all cursor-pointer bg-background"
                  aria-label="Open chatbot assistant"
                >
                  <Bot size={16} />
                  Query AI Agent
                </button>
              </div>
            </div>

            <motion.div
              className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-32 border-y border-border py-8"
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.5 }}
            >
              <StatCounter value={3847}  label="Active Floats"   icon={<Activity size={14} />} color="var(--color-periwinkle)" />
              <StatCounter value={12}    label="Ocean Regions"   icon={<Globe size={14} />}    color="var(--color-light-ocean)" />
              <StatCounter value="2.4M"  label="Data Points"     icon={<Database size={14} />} color="var(--color-royal-blue)" />
              <StatCounter value={147}   label="Countries"       icon={<MapPin size={14} />}   color="var(--color-deep-navy)" />
            </motion.div>

            <div className="mb-32">
              <motion.div className="mb-16" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.4 }}>
                <span className="font-mono text-[10px] font-bold uppercase tracking-widest mb-4 block text-muted-foreground">
                  System Capabilities
                </span>
                <h2 className="text-4xl md:text-5xl font-display text-foreground">
                  Platform Features
                </h2>
              </motion.div>
              <div className="grid md:grid-cols-3 gap-6">
                <FeatureCard icon={<Waves size={20} />} title="Ocean Depth Profiles" description="Visualize ocean depth measurements with color-coded markers. Explore vertical profiles of temperature, salinity, and oxygen at any coordinate." delay={0} />
                <FeatureCard icon={<BarChart3 size={20} />} title="Advanced Analytics" description="Comprehensive analytics dashboard with real-time data processing. Monitor trends, detect anomalies, and compare oceanographic metrics across regions." delay={100} />
                <FeatureCard icon={<Globe size={20} />} title="Global Coverage" description="Explore oceanographic data from every major ocean basin. Complete coverage from the Arctic to the Antarctic with thousands of active measurement points." delay={200} />
              </div>
            </div>

            <motion.div
              className="mb-32 py-16 border-y border-border"
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <div className="mb-16">
                <span className="font-mono text-[10px] font-bold uppercase tracking-widest mb-4 block text-muted-foreground">
                  Data Pipeline
                </span>
                <h2 className="text-4xl md:text-5xl font-display text-foreground">
                  Operational Workflow
                </h2>
              </div>
              <div className="grid md:grid-cols-3 gap-12 relative">
                {[
                  { n: '01', title: 'Target Area', desc: 'Input coordinates or select region on the global projection to initiate scan.' },
                  { n: '02', title: 'Data Retrieval', desc: 'Retrieve depth profiles, temperature gradients, and salinity distributions from active floats.' },
                  { n: '03', title: 'AI Synthesis', desc: 'Query floatCHAT to summarize patterns, detect anomalies, or compare specific oceanic metrics.' },
                ].map((step) => (
                  <div key={step.n} className="flex flex-col border-l-2 border-royal-blue pl-6">
                    <div className="font-mono text-sm text-muted-foreground mb-4">{step.n}</div>
                    <h4 className="text-xl font-display text-foreground mb-3 font-semibold">{step.title}</h4>
                    <p className="text-sm font-sans text-muted-foreground leading-relaxed">{step.desc}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            <div className="mb-24">
              <motion.div className="mb-12" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.4 }}>
                <span className="font-mono text-[10px] font-bold uppercase tracking-widest mb-4 block text-muted-foreground">
                  Quick Access
                </span>
                <h2 className="text-4xl font-display text-foreground">
                  Explore by Metric
                </h2>
              </motion.div>
              <motion.div className="grid md:grid-cols-3 gap-4" initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.45 }}>
                <QuickExploreCard icon={<Thermometer size={20} />} title="Temperature Map" subtitle="Sea surface & depth temperature gradients" onClick={() => setActivePage('Temperature')} />
                <QuickExploreCard icon={<Droplets size={20} />} title="Salinity Map" subtitle="Ocean salinity distribution & patterns" onClick={() => setActivePage('Salinity')} />
                <QuickExploreCard icon={<Gauge size={20} />} title="Pressure Map" subtitle="Pressure measurements at various depths" onClick={() => setActivePage('Pressure')} />
              </motion.div>
            </div>

            <motion.div
              className="rounded-2xl p-12 text-center bg-muted"
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <h3 className="text-4xl font-display text-foreground mb-4">
                Ready to deploy?
              </h3>
              <p className="text-base font-sans text-muted-foreground max-w-lg mx-auto mb-10">
                Thousands of data points from autonomous ARGO floats await your analysis.
              </p>
              <div className="flex justify-center gap-4">
                <button
                  onClick={() => setActivePage('Argo Floats')}
                  className="px-6 py-3 rounded-md font-sans font-medium text-sm bg-foreground text-background hover:bg-foreground/90 transition-all cursor-pointer"
                >
                  Open Ocean Map
                </button>
                <button
                  onClick={() => setActivePage('Depth Profiles')}
                  className="btn-outline"
                >
                  View Depth Profiles
                </button>
              </div>
            </motion.div>

          </div>
        </div>
      </div>
    </div>
  );
}


