import React, { useState, useEffect } from "react";
import { LayoutDashboard, Home, Map, Thermometer, Droplets, Gauge, ChartNoAxesCombined, Menu, X, Globe } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import logo from '../assets/logo.png';

function Navbar({ activePage, setActivePage }) {
    const [mobileOpen, setMobileOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 8);
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    const navItems = [
        { name: "Home",          icon: <Home size={15} /> },
        { name: "Depth Profiles", icon: <ChartNoAxesCombined size={15} /> },
        { name: "Argo Floats",   icon: <Map size={15} /> },
        { name: "3D Globe",      icon: <Globe size={15} /> },
        { name: "Temperature",   icon: <Thermometer size={15} /> },
        { name: "Salinity",      icon: <Droplets size={15} /> },
        { name: "Pressure",      icon: <Gauge size={15} /> },
    ];

    function handleNav(name) {
        setActivePage(name);
        setMobileOpen(false);
    }

    return (
        <header
            className="w-full sticky top-0 z-30 nav-water-line"
            style={{
                backdropFilter: 'blur(20px) saturate(160%)',
                WebkitBackdropFilter: 'blur(20px) saturate(160%)',
                background: scrolled
                    ? 'linear-gradient(160deg, rgba(4, 14, 30, 0.92), rgba(2, 10, 22, 0.88))'
                    : 'linear-gradient(160deg, rgba(4, 14, 30, 0.75), rgba(2, 10, 22, 0.65))',
                borderBottom: '1px solid rgba(0, 212, 255, 0.1)',
                boxShadow: scrolled
                    ? '0 4px 24px rgba(0, 0, 0, 0.4), 0 1px 0 rgba(0, 212, 255, 0.06)'
                    : 'none',
                transition: 'background 300ms ease, box-shadow 300ms ease',
            }}
        >
            <div className="flex items-center justify-between px-4 md:px-6 py-3">
                {/* Logo */}
                <button
                    onClick={() => handleNav('Home')}
                    className="flex items-center gap-2.5 group"
                    aria-label="Go to Home"
                >
                    <div className="relative">
                        <img
                            src={logo}
                            className="h-8 w-8 rounded-xl object-cover"
                            alt="floatCHAT logo"
                            style={{ boxShadow: '0 0 12px rgba(0,212,255,0.3), 0 2px 8px rgba(0,0,0,0.4)' }}
                        />
                        <span
                            className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400"
                            style={{ boxShadow: '0 0 6px rgba(52, 211, 153, 0.8)', border: '1.5px solid rgba(4,14,30,0.9)' }}
                        />
                    </div>
                    <span
                        className="text-3xl tracking-tighter"
                        style={{
                            fontFamily: "'Shark Heavy', sans-serif",
                            background: 'linear-gradient(135deg, #00f5d4 0%, #00d4ff 50%, #38e8ff 100%)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            backgroundClip: 'text',
                        }}
                    >
                        floatCHAT
                    </span>
                </button>

                {/* Desktop Nav */}
                <nav className="hidden md:flex items-center gap-0.5 px-1.5 py-1 rounded-xl"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
                >
                    {navItems.map((item) => {
                        const isActive = activePage === item.name;
                        return (
                            <button
                                key={item.name}
                                onClick={() => handleNav(item.name)}
                                className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-200"
                                style={{
                                    color: isActive ? '#fff' : 'rgba(232,244,253,0.55)',
                                    background: isActive ? 'rgba(0, 212, 255, 0.1)' : 'transparent',
                                    fontFamily: "'Exo 2', sans-serif",
                                }}
                                title={item.name}
                            >
                                <span style={{ color: isActive ? '#00d4ff' : 'inherit' }}>
                                    {item.icon}
                                </span>
                                <span>{item.name}</span>

                                {/* Active indicator */}
                                {isActive && (
                                    <motion.span
                                        layoutId="nav-indicator"
                                        className="absolute inset-0 rounded-lg"
                                        style={{
                                            background: 'rgba(0, 212, 255, 0.08)',
                                            border: '1px solid rgba(0, 212, 255, 0.18)',
                                        }}
                                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                                    />
                                )}
                            </button>
                        );
                    })}
                </nav>

                {/* Mobile Hamburger */}
                <button
                    className="md:hidden flex items-center justify-center w-9 h-9 rounded-xl transition-all"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                    onClick={() => setMobileOpen(!mobileOpen)}
                    aria-label="Toggle navigation"
                >
                    <AnimatePresence mode="wait">
                        {mobileOpen
                            ? <motion.span key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}><X size={18} /></motion.span>
                            : <motion.span key="menu" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}><Menu size={18} /></motion.span>
                        }
                    </AnimatePresence>
                </button>
            </div>

            {/* Mobile Nav */}
            <AnimatePresence>
                {mobileOpen && (
                    <motion.nav
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                        className="md:hidden overflow-hidden border-t"
                        style={{ borderColor: 'rgba(0, 212, 255, 0.08)' }}
                    >
                        <div className="px-3 pt-2 pb-3 flex flex-col gap-0.5">
                            {navItems.map((item) => {
                                const isActive = activePage === item.name;
                                return (
                                    <button
                                        key={item.name}
                                        onClick={() => handleNav(item.name)}
                                        className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200"
                                        style={{
                                            color: isActive ? '#fff' : 'rgba(232,244,253,0.6)',
                                            background: isActive ? 'rgba(0, 212, 255, 0.1)' : 'transparent',
                                            borderLeft: isActive ? '2px solid #00d4ff' : '2px solid transparent',
                                            fontFamily: "'Exo 2', sans-serif",
                                        }}
                                    >
                                        <span style={{ color: isActive ? '#00d4ff' : 'inherit' }}>{item.icon}</span>
                                        <span>{item.name}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </motion.nav>
                )}
            </AnimatePresence>
        </header>
    );
}

export default Navbar;