import React, { useState, useEffect } from "react";
import { LayoutDashboard, Home, Map, Thermometer, Droplets, Gauge, ChartNoAxesCombined, Menu, X, Globe } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "../lib/utils";

function Navbar({ activePage, setActivePage }) {
    const [mobileOpen, setMobileOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 8);
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    const navItems = [
        { name: "Home",          icon: <Home size={14} /> },
        { name: "Depth Profiles", icon: <ChartNoAxesCombined size={14} /> },
        { name: "Argo Floats",   icon: <Map size={14} /> },
        { name: "3D Globe",      icon: <Globe size={14} /> },
        { name: "Temperature",   icon: <Thermometer size={14} /> },
        { name: "Salinity",      icon: <Droplets size={14} /> },
        { name: "Pressure",      icon: <Gauge size={14} /> },
    ];

    function handleNav(name) {
        setActivePage(name);
        setMobileOpen(false);
    }

    const isDarkCanvasBg = activePage === 'Home' && !scrolled;

    return (
        <header
            className={cn(
                "w-full sticky top-0 z-30 transition-all duration-300",
                scrolled ? "bg-background/80 backdrop-blur-md border-b border-border shadow-sm" : "bg-transparent border-b border-transparent"
            )}
        >
            <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
                {/* Logo */}
                <button
                    onClick={() => handleNav('Home')}
                    className="flex items-center gap-2 group cursor-pointer"
                    aria-label="Go to Home"
                >
                    <span className={cn("text-2xl font-display tracking-tight", isDarkCanvasBg ? "text-white" : "text-foreground")}>
                        Float<span className="text-periwinkle italic">CHAT</span>
                    </span>
                </button>

                {/* Desktop Nav */}
                <nav className="hidden md:flex items-center gap-2">
                    {navItems.map((item) => {
                        const isActive = activePage === item.name;
                        return (
                            <button
                                key={item.name}
                                onClick={() => handleNav(item.name)}
                                className={cn(
                                    "relative flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-sans font-medium transition-colors duration-200 cursor-pointer",
                                    isActive 
                                        ? (isDarkCanvasBg ? "text-white" : "text-foreground") 
                                        : (isDarkCanvasBg ? "text-white/70 hover:text-white hover:bg-white/10" : "text-muted-foreground hover:text-foreground hover:bg-muted")
                                )}
                                title={item.name}
                            >
                                <span className={isActive ? "text-periwinkle" : (isDarkCanvasBg ? "text-white/70" : "text-muted-foreground")}>
                                    {item.icon}
                                </span>
                                <span>{item.name}</span>

                                {/* Active indicator */}
                                {isActive && (
                                    <motion.span
                                        layoutId="nav-indicator"
                                        className="absolute bottom-0 left-3 right-3 h-[2px] bg-periwinkle"
                                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                                    />
                                )}
                            </button>
                        );
                    })}
                </nav>

                {/* Mobile Hamburger */}
                <button
                    className={cn(
                        "md:hidden flex items-center justify-center p-2 rounded-md transition-colors cursor-pointer",
                        isDarkCanvasBg ? "text-white hover:bg-white/10" : "text-foreground hover:bg-muted"
                    )}
                    onClick={() => setMobileOpen(!mobileOpen)}
                    aria-label="Toggle navigation"
                >
                    <AnimatePresence mode="wait">
                        {mobileOpen
                            ? <motion.span key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}><X size={20} /></motion.span>
                            : <motion.span key="menu" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}><Menu size={20} /></motion.span>
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
                        className="md:hidden overflow-hidden border-t border-border bg-background"
                    >
                        <div className="px-4 py-4 flex flex-col gap-2">
                            {navItems.map((item) => {
                                const isActive = activePage === item.name;
                                return (
                                    <button
                                        key={item.name}
                                        onClick={() => handleNav(item.name)}
                                        className={cn(
                                            "flex items-center gap-3 px-3 py-3 rounded-md text-sm font-sans font-medium transition-all duration-200 cursor-pointer",
                                            isActive ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50"
                                        )}
                                    >
                                        <span className={isActive ? "text-periwinkle" : ""}>{item.icon}</span>
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