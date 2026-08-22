import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from './components/navbar';
import Chatbot from './components/Chatbot';
import ChatPlots from './components/ChatPlots';
import Dashboard from './components/Dashboard';
import Home from './components/Home';
import OceanMap from './components/OceanMap';
import MetricMap from './components/MetricMap';
import GlobeMap from './components/GlobeMap';
import { Bot, X, BarChart3 } from 'lucide-react';

function OceanVizApp() {
    const [chatOpen, setChatOpen] = useState(false);
    const [activePage, setActivePage] = useState('Home');
    const [chatPlotsData, setChatPlotsData] = useState(null);
    const [chatPlotsOpen, setChatPlotsOpen] = useState(false);
    const [chatInput, setChatInput] = useState('');
    const mainScrollRef = useRef(null);

    const isFullScreenMap = ['Argo Floats', 'Salinity', 'Temperature', 'Pressure', '3D Globe'].includes(activePage);

    const handleMapClick = (lat, lon) => {
        setChatInput(`Tell me about the ocean at lat ${lat.toFixed(2)}, lon ${lon.toFixed(2)}`);
        setChatOpen(true);
    };

    return (
        <div className={`h-screen flex flex-col w-full overflow-hidden text-foreground ${activePage === 'Home' ? '' : 'bg-background'}`}>
            <div className="relative z-30">
                <Navbar activePage={activePage} setActivePage={setActivePage} />
            </div>

            <AnimatePresence mode="wait">
                <motion.div
                    key={activePage}
                    ref={mainScrollRef}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                    className={isFullScreenMap ? 'flex-1 relative overflow-hidden' : 'flex-1 relative overflow-y-auto overflow-x-hidden'}
                >
                    {activePage === 'Depth Profiles' && (
                        <div className="mx-4 md:mx-auto my-4 max-w-7xl">
                            <Dashboard />
                        </div>
                    )}
                    {activePage === 'Home' && <Home setActivePage={setActivePage} setChatOpen={setChatOpen} mainScrollRef={mainScrollRef} />}
                    {activePage === 'Argo Floats' && <OceanMap setActivePage={setActivePage} onMapClick={handleMapClick} />}
                    {activePage === 'Salinity' && <MetricMap metric="salinity" onMapClick={handleMapClick} />}
                    {activePage === 'Temperature' && <MetricMap metric="temperature" onMapClick={handleMapClick} />}
                    {activePage === 'Pressure' && <MetricMap metric="pressure" onMapClick={handleMapClick} />}
                    {activePage === '3D Globe' && <GlobeMap onMapClick={handleMapClick} />}
                </motion.div>
            </AnimatePresence>

            <ChatPlots data={chatPlotsData} isOpen={chatPlotsOpen} onClose={() => setChatPlotsOpen(false)} />

            {/* ── Data Analysis FAB ── */}
            <AnimatePresence>
                {chatPlotsData && !chatPlotsOpen && (
                    <motion.button
                        initial={{ opacity: 0, x: -20, scale: 0.9 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: -20, scale: 0.9 }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setChatPlotsOpen(true)}
                        className="fixed bottom-6 left-5 md:left-6 z-40 flex items-center gap-2 px-4 py-2.5 rounded-full font-mono tracking-widest text-xs uppercase shadow-md transition-all cursor-pointer bg-foreground text-background border border-foreground/10 hover:shadow-lg"
                    >
                        <BarChart3 size={16} />
                        Data Analysis
                    </motion.button>
                )}
            </AnimatePresence>

            {/* ── Chatbot FAB ── */}
            <motion.button
                onClick={() => setChatOpen(!chatOpen)}
                className="fixed bottom-6 right-5 md:right-6 z-50 rounded-full flex items-center justify-center cursor-pointer border border-border shadow-md transition-all hover:shadow-lg"
                style={{
                    width: 52,
                    height: 52,
                    background: chatOpen ? 'var(--muted)' : 'var(--background)',
                    color: 'var(--foreground)',
                }}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                aria-label={chatOpen ? 'Close chat' : 'Open chat'}
            >
                {/* Pulse ring when closed */}
                {!chatOpen && (
                    <span
                        className="absolute inset-0 rounded-full border border-border/50"
                        style={{ animation: 'ping-ring 2s ease-out infinite' }}
                    />
                )}

                <AnimatePresence mode="wait">
                    {chatOpen ? (
                        <motion.div
                            key="close"
                            initial={{ rotate: -90, opacity: 0, scale: 0.7 }}
                            animate={{ rotate: 0, opacity: 1, scale: 1 }}
                            exit={{ rotate: 90, opacity: 0, scale: 0.7 }}
                            transition={{ duration: 0.18 }}
                        >
                            <X size={18} style={{ color: 'var(--color-light-blue)' }} />
                        </motion.div>
                    ) : (
                        <motion.div
                            key="bot"
                            initial={{ rotate: 90, opacity: 0, scale: 0.7 }}
                            animate={{ rotate: 0, opacity: 1, scale: 1 }}
                            exit={{ rotate: -90, opacity: 0, scale: 0.7 }}
                            transition={{ duration: 0.18 }}
                        >
                            <Bot size={20} style={{ color: 'var(--color-royal-blue)' }} />
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.button>

            <Chatbot 
               chatOpen={chatOpen} 
               setChatOpen={setChatOpen} 
               chatInput={chatInput} 
               setChatInput={setChatInput}
               setChatPlotsData={setChatPlotsData}
               setChatPlotsOpen={setChatPlotsOpen}
            />
        </div>
    );
}

export default OceanVizApp;