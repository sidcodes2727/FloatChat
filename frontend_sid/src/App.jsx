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
import { Bot, X } from 'lucide-react';

function OceanVizApp() {
    const [chatOpen, setChatOpen] = useState(false);
    const [activePage, setActivePage] = useState('Home');
    const [chatPlotsData, setChatPlotsData] = useState(null);
    const [chatInput, setChatInput] = useState('');
    const mainScrollRef = useRef(null);

    const isFullScreenMap = ['Argo Floats', 'Salinity', 'Temperature', 'Pressure', '3D Globe'].includes(activePage);

    const handleMapClick = (lat, lon) => {
        setChatInput(`Tell me about the ocean at lat ${lat.toFixed(2)}, lon ${lon.toFixed(2)}`);
        setChatOpen(true);
    };

    return (
        <div className="h-screen flex flex-col text-white w-full overflow-hidden" style={{ background: 'transparent' }}>
            <Navbar activePage={activePage} setActivePage={setActivePage} />

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
                        <div
                            className="rounded-xl mx-3 md:mx-5 my-3"
                            style={{
                                background: 'rgba(4, 12, 26, 0.4)',
                                border: '1px solid rgba(0, 212, 255, 0.07)',
                                backdropFilter: 'blur(8px)',
                            }}
                        >
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

            <ChatPlots data={chatPlotsData} onClose={() => setChatPlotsData(null)} />

            {/* ── Chatbot FAB ── */}
            <motion.button
                onClick={() => setChatOpen(!chatOpen)}
                className="fixed bottom-5 right-5 z-50 w-13 h-13 rounded-2xl flex items-center justify-center"
                style={{
                    width: 50,
                    height: 50,
                    background: chatOpen
                        ? 'rgba(6, 18, 40, 0.92)'
                        : 'linear-gradient(135deg, #00d4ff 0%, #0099cc 100%)',
                    border: chatOpen
                        ? '1px solid rgba(0, 212, 255, 0.25)'
                        : '1px solid rgba(0, 212, 255, 0.0)',
                    boxShadow: chatOpen
                        ? '0 4px 20px rgba(0,0,0,0.4)'
                        : '0 4px 20px rgba(0, 212, 255, 0.35), 0 2px 8px rgba(0,0,0,0.3)',
                    backdropFilter: chatOpen ? 'blur(16px)' : 'none',
                }}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                aria-label={chatOpen ? 'Close chat' : 'Open chat'}
            >
                {/* Pulse ring when closed */}
                {!chatOpen && (
                    <span
                        className="absolute inset-0 rounded-2xl"
                        style={{
                            border: '1px solid rgba(0, 212, 255, 0.5)',
                            animation: 'ping-ring 2s ease-out infinite',
                        }}
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
                            <X size={18} style={{ color: 'rgba(0, 212, 255, 0.85)' }} />
                        </motion.div>
                    ) : (
                        <motion.div
                            key="bot"
                            initial={{ rotate: 90, opacity: 0, scale: 0.7 }}
                            animate={{ rotate: 0, opacity: 1, scale: 1 }}
                            exit={{ rotate: -90, opacity: 0, scale: 0.7 }}
                            transition={{ duration: 0.18 }}
                        >
                            <Bot size={20} style={{ color: '#001a2e' }} />
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
            />
        </div>
    );
}

export default OceanVizApp;