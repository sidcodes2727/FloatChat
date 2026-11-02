import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, ChevronDown, ChevronUp, Bot, MapPin, Sparkles, GitCompare } from "lucide-react";
import { API_BASE } from '../config';

// Named ocean regions for client-side detection
const OCEAN_REGION_MAP = {
    'indian ocean':      { lat: -20,  lon:  80,  rangeDeg: 40 },
    'pacific ocean':     { lat:   0,  lon: 180,  rangeDeg: 60 },
    'north pacific':     { lat:  30,  lon: 180,  rangeDeg: 35 },
    'south pacific':     { lat: -30,  lon: 200,  rangeDeg: 35 },
    'atlantic ocean':    { lat:   0,  lon: -30,  rangeDeg: 50 },
    'north atlantic':    { lat:  40,  lon: -35,  rangeDeg: 30 },
    'south atlantic':    { lat: -30,  lon: -20,  rangeDeg: 30 },
    'arctic ocean':      { lat:  85,  lon:   0,  rangeDeg: 15 },
    'southern ocean':    { lat: -65,  lon:   0,  rangeDeg: 20 },
    'antarctic ocean':   { lat: -65,  lon:   0,  rangeDeg: 20 },
    'arabian sea':       { lat:  15,  lon:  65,  rangeDeg: 12 },
    'bay of bengal':     { lat:  13,  lon:  88,  rangeDeg: 10 },
    'mediterranean':     { lat:  36,  lon:  18,  rangeDeg: 12 },
    'mediterranean sea': { lat:  36,  lon:  18,  rangeDeg: 12 },
    'caribbean sea':     { lat:  15,  lon: -75,  rangeDeg: 10 },
    'caribbean':         { lat:  15,  lon: -75,  rangeDeg: 10 },
    'red sea':           { lat:  20,  lon:  38,  rangeDeg:  6 },
    'gulf of mexico':    { lat:  25,  lon: -90,  rangeDeg:  8 },
    'south china sea':   { lat:  12,  lon: 114,  rangeDeg: 10 },
    'coral sea':         { lat: -18,  lon: 154,  rangeDeg: 10 },
    'tasman sea':        { lat: -38,  lon: 160,  rangeDeg:  8 },
    'bering sea':        { lat:  58,  lon: 180,  rangeDeg: 10 },
    'north sea':         { lat:  57,  lon:   4,  rangeDeg:  6 },
    'persian gulf':      { lat:  26,  lon:  52,  rangeDeg:  4 },
};

/**
 * Extract all named regions from a message text.
 * Returns array of { label, lat, lon, rangeDeg }
 */
function extractAllNamedRegions(text) {
    const lower = text.toLowerCase();
    const found = [];
    const keys = Object.keys(OCEAN_REGION_MAP).sort((a, b) => b.length - a.length);
    const usedRanges = [];

    for (const key of keys) {
        const idx = lower.indexOf(key);
        if (idx === -1) continue;
        // Avoid overlapping matches
        const overlaps = usedRanges.some(([s, e]) => idx < e && idx + key.length > s);
        if (overlaps) continue;
        usedRanges.push([idx, idx + key.length]);
        const region = OCEAN_REGION_MAP[key];
        found.push({
            label: key.replace(/\b\w/g, c => c.toUpperCase()),
            lat: region.lat,
            lon: region.lon,
            rangeDeg: region.rangeDeg,
        });
    }
    return found;
}

/* ─── Typing animation ─── */
function TypingDots() {
    return (
        <div className="flex items-center gap-1.5 px-4 py-3">
            {[0, 1, 2].map(i => (
                <span
                    key={i}
                    className="block rounded-full"
                    style={{
                        width: 6,
                        height: 6,
                        background: '#00d4ff',
                        animation: `typing-bounce 0.9s ease-in-out ${i * 0.18}s infinite`,
                        opacity: 0.7,
                    }}
                />
            ))}
        </div>
    );
}

/* ─── Message bubble ─── */
function MessageBubble({ message }) {
    const isUser = message.role === 'user';
    return (
        <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            className={`flex ${isUser ? 'justify-end' : 'justify-start'} items-end gap-2`}
        >
            {/* Bot avatar */}
            {!isUser && (
                <div
                    className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mb-0.5"
                    style={{
                        background: 'rgba(0,212,255,0.12)',
                        border: '1px solid rgba(0,212,255,0.2)',
                    }}
                >
                    <Bot size={12} style={{ color: '#00d4ff' }} />
                </div>
            )}

            <div
                className="max-w-[82%] px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap rounded-2xl"
                style={
                    isUser
                        ? {
                            background: 'linear-gradient(135deg, rgba(0,212,255,0.18), rgba(0,176,216,0.12))',
                            border: '1px solid rgba(0,212,255,0.22)',
                            borderBottomRightRadius: 4,
                            color: '#e8f4fd',
                        }
                        : {
                            background: 'rgba(255,255,255,0.055)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderBottomLeftRadius: 4,
                            color: 'rgba(232,244,253,0.88)',
                        }
                }
            >
                {message.content}
            </div>
        </motion.div>
    );
}

/* ─── Chatbot panel ─── */
export default function Chatbot({ chatOpen, setChatOpen, chatInput, setChatInput, setChatPlotsData }) {
    const CONCISE_INSTRUCTIONS = "You are floatCHAT. Answer very concisely (1–2 sentences). Use ARGO data when provided. Include numbers with units. If uncertain, say so briefly.";

    const [messages, setMessages] = useState([
        { id: 1, role: 'assistant', content: "Hi! I'm floatCHAT — your ocean data assistant. Ask me about ARGO floats, temperature, salinity, or any oceanographic data." }
    ]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const listRef = useRef(null);

    useEffect(() => {
        if (chatInput) {
            setInput(chatInput);
            setChatInput('');
        }
    }, [chatInput, setChatInput]);

    useEffect(() => {
        if (!listRef.current) return;
        listRef.current.scrollTop = listRef.current.scrollHeight;
    }, [messages, chatOpen]);

    // Auto-populate location when map point is clicked
    useEffect(() => {
        if (selectedCoords) {
            setLat(String(selectedCoords.lat));
            setLon(String(selectedCoords.lon));
            if (!rangeDeg || rangeDeg === '') setRangeDeg('2');
            setContextOpen(true);
        }
    }, [selectedCoords]);

    const suggestedPrompts = [
        "What is the average ocean temperature?",
        "Compare Indian Ocean vs Atlantic Ocean",
        "Arabian Sea salinity data",
        "Explain thermocline",
    ];

    async function sendMessage(text) {
        text = (text || input).trim();
        if (!text || loading) return;
        setError(null);
        setInput("");
        const userMsg = { id: Date.now(), role: 'user', content: text };
        setMessages(prev => [...prev, userMsg]);
        setLoading(true);

        // ── Detect multiple named regions for comparison ──
        const detectedRegions = extractAllNamedRegions(text);
        const isComparison = detectedRegions.length >= 2;
        if (isComparison && onCompareLocations) {
            onCompareLocations(detectedRegions);
        }

        try {
            const endpoint = `${API_BASE}/ai/chat`;
            const baseMsgs = [{ role: 'user', content: CONCISE_INSTRUCTIONS }, ...messages, userMsg];
            const payload = { messages: baseMsgs.map(m => ({ role: m.role, content: m.content })) };
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (!res.ok) {
                const errorMsg = data?.details ? `${data.error}: ${data.details}` : (data?.error || 'Failed to get response');
                throw new Error(errorMsg);
            }
            const raw = (data?.text || '').trim() || "I'm not sure how to answer that yet.";
            const reply = raw;
            setMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', content: reply }]);
            if (data?.plottingData && setChatPlotsData) {
                setChatPlotsData(data.plottingData);
            }
        } catch (e) {
            setError(e.message || 'Something went wrong');
            setMessages(prev => [...prev, { id: Date.now() + 2, role: 'assistant', content: 'Sorry, I could not reach the AI service.' }]);
        } finally {
            setLoading(false);
        }
    }

    function onKeyDown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    }

    return (
        <AnimatePresence>
            {chatOpen && (
                <motion.div
                    initial={{ opacity: 0, y: 32, scale: 0.94 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 32, scale: 0.94 }}
                    transition={{ duration: 0.28, ease: [0.34, 1.56, 0.64, 1] }}
                    className="fixed bottom-24 right-4 md:right-6 z-50 w-[calc(100vw-2rem)] md:w-[420px] h-[560px] flex flex-col overflow-hidden"
                    style={{
                        background: 'linear-gradient(160deg, rgba(6, 18, 40, 0.97), rgba(3, 10, 22, 0.98))',
                        border: '1px solid rgba(0, 212, 255, 0.18)',
                        borderRadius: 20,
                        boxShadow: '0 0 0 1px rgba(0,212,255,0.06), 0 24px 60px rgba(0,0,0,0.7), 0 0 40px rgba(0,212,255,0.06)',
                        backdropFilter: 'blur(20px)',
                    }}
                >
                    {/* ── Header ── */}
                    <div
                        className="flex items-center justify-between px-4 py-3 shrink-0"
                        style={{ borderBottom: '1px solid rgba(0,212,255,0.1)' }}
                    >
                        <div className="flex items-center gap-3">
                            <div
                                className="w-9 h-9 rounded-xl flex items-center justify-center relative"
                                style={{
                                    background: 'linear-gradient(135deg, rgba(0,212,255,0.15), rgba(0,150,200,0.1))',
                                    border: '1px solid rgba(0,212,255,0.25)',
                                    boxShadow: '0 0 16px rgba(0,212,255,0.15)',
                                }}
                            >
                                <Bot size={17} style={{ color: '#00d4ff' }} />
                                {/* Ping animation */}
                                <span
                                    className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400"
                                    style={{ boxShadow: '0 0 6px rgba(52,211,153,0.8)', border: '1.5px solid rgba(3,10,22,0.9)' }}
                                />
                            </div>
                            <div>
                                <h3
                                    className="text-lg text-white leading-none font-bold"
                                    style={{ fontFamily: "'Shark Heavy', sans-serif", letterSpacing: '1px' }}
                                >
                                    floatCHAT
                                </h3>
                                <div className="flex items-center gap-1.5 mt-1">
                                    <span className="glow-dot" style={{ width: 5, height: 5 }} />
                                    <span className="text-[10px]" style={{ color: 'rgba(232,244,253,0.4)' }}>
                                        Online · Ocean AI
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <div
                                className="flex items-center gap-1 px-2 py-1 rounded-full"
                                style={{ background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.15)' }}
                            >
                                <Sparkles size={10} style={{ color: '#00d4ff' }} />
                                <span className="text-[10px] font-semibold" style={{ color: '#00d4ff' }}>AI</span>
                            </div>
                            <div
                                title="Compare locations: mention 2+ ocean regions"
                                className="flex items-center gap-1 px-2 py-1 rounded-full cursor-default"
                                style={{ background: 'rgba(153,51,255,0.08)', border: '1px solid rgba(153,51,255,0.18)' }}
                            >
                                <GitCompare size={10} style={{ color: '#9933ff' }} />
                                <span className="text-[10px] font-semibold" style={{ color: '#9933ff' }}>Compare</span>
                            </div>
                            <button
                                className="w-7 h-7 flex items-center justify-center rounded-lg transition-all"
                                style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(232,244,253,0.5)' }}
                                onClick={() => setChatOpen(false)}
                            >
                                <X size={14} />
                            </button>
                        </div>
                    </div>



                    {/* ── Messages ── */}
                    <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                        {messages.map((m) => (
                            <MessageBubble key={m.id} message={m} />
                        ))}

                        {/* Suggested prompts */}
                        {messages.length === 1 && !loading && (
                            <motion.div
                                className="flex flex-wrap gap-2 mt-3"
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 }}
                            >
                                {suggestedPrompts.map((prompt) => (
                                    <button
                                        key={prompt}
                                        onClick={() => sendMessage(prompt)}
                                        className="text-[11px] px-3 py-1.5 rounded-full transition-all duration-200"
                                        style={{
                                            border: '1px solid rgba(0,212,255,0.18)',
                                            color: 'rgba(0,212,255,0.8)',
                                            background: 'rgba(0,212,255,0.06)',
                                        }}
                                        onMouseEnter={e => {
                                            e.currentTarget.style.background = 'rgba(0,212,255,0.12)';
                                            e.currentTarget.style.borderColor = 'rgba(0,212,255,0.35)';
                                        }}
                                        onMouseLeave={e => {
                                            e.currentTarget.style.background = 'rgba(0,212,255,0.06)';
                                            e.currentTarget.style.borderColor = 'rgba(0,212,255,0.18)';
                                        }}
                                    >
                                        {prompt}
                                    </button>
                                ))}
                            </motion.div>
                        )}

                        {error && (
                            <div
                                className="text-xs px-3 py-2 rounded-lg"
                                style={{ color: 'rgba(248,113,113,0.9)', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}
                            >
                                {error}
                            </div>
                        )}
                        {loading && <TypingDots />}
                    </div>

                    {/* ── Input ── */}
                    <div
                        className="px-3 py-3 shrink-0"
                        style={{ borderTop: '1px solid rgba(0,212,255,0.08)' }}
                    >
                        <div
                            className="flex items-center gap-2 px-3 py-2 rounded-xl"
                            style={{
                                background: 'rgba(2, 10, 22, 0.7)',
                                border: '1px solid rgba(255,255,255,0.09)',
                                transition: 'border-color 200ms ease',
                            }}
                            onFocusCapture={e => e.currentTarget.style.borderColor = 'rgba(0,212,255,0.3)'}
                            onBlurCapture={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'}
                        >
                            <input
                                type="text"
                                placeholder="Ask about oceanographic data..."
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={onKeyDown}
                                className="flex-1 text-sm bg-transparent border-none outline-none"
                                style={{ color: 'rgba(232,244,253,0.9)' }}
                            />
                            <button
                                onClick={() => sendMessage()}
                                disabled={loading || !input.trim()}
                                className="w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200"
                                style={{
                                    background: input.trim() && !loading
                                        ? 'linear-gradient(135deg, #00d4ff, #0099cc)'
                                        : 'rgba(255,255,255,0.06)',
                                    color: input.trim() && !loading ? '#001a2e' : 'rgba(232,244,253,0.25)',
                                    boxShadow: input.trim() && !loading ? '0 2px 10px rgba(0,212,255,0.3)' : 'none',
                                    cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
                                }}
                            >
                                <Send size={13} />
                            </button>
                        </div>
                        <p className="text-center mt-1.5 text-[10px]" style={{ color: 'rgba(232,244,253,0.25)' }}>
                            Powered by ARGO float data
                        </p>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}