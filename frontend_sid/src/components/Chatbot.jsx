import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Bot, Sparkles } from "lucide-react";
import { API_BASE } from '../config';

/* ─── Typing animation ─── */
function TypingDots() {
    return (
        <div className="flex items-center gap-1.5 px-4 py-3">
            {[0, 1, 2].map(i => (
                <span
                    key={i}
                    className="block rounded-full bg-periwinkle"
                    style={{
                        width: 6,
                        height: 6,
                        animation: `typing-bounce 0.9s ease-in-out ${i * 0.18}s infinite`,
                        opacity: 0.8,
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
            {!isUser && (
                <div className="w-7 h-7 rounded bg-white flex items-center justify-center shrink-0 mb-0.5 border border-border shadow-sm">
                    <Bot size={14} className="text-[var(--color-royal-blue)]" />
                </div>
            )}

            <div
                className={`max-w-[82%] px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap rounded-2xl shadow-sm ${
                    isUser
                        ? 'bg-[var(--color-royal-blue)] text-white rounded-br-sm'
                        : 'bg-white text-foreground border border-border rounded-bl-sm font-sans'
                }`}
            >
                {message.content}
            </div>
        </motion.div>
    );
}

/* ─── Chatbot panel ─── */
export default function Chatbot({ chatOpen, setChatOpen, chatInput, setChatInput, setChatPlotsData, setChatPlotsOpen }) {
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
    }, [messages, chatOpen, loading]);

    const suggestedPrompts = [
        "What is the average ocean temperature?",
        "Explain ARGO floats",
        "Show salinity trends",
    ];

    async function sendMessage(text) {
        text = (text || input).trim();
        if (!text || loading) return;
        setError(null);
        setInput("");
        const userMsg = { id: Date.now(), role: 'user', content: text };
        setMessages(prev => [...prev, userMsg]);
        setLoading(true);
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
            if (!res.ok) throw new Error(data?.error || 'Failed to get response');
            const raw = (data?.text || '').trim() || "I'm not sure how to answer that yet.";
            const reply = raw;
            setMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', content: reply }]);
            if (data?.plottingData && setChatPlotsData) {
                setChatPlotsData(data.plottingData);
                if (setChatPlotsOpen) setChatPlotsOpen(true);
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
                    className="fixed bottom-24 right-4 md:right-6 z-50 w-[calc(100vw-2rem)] md:w-[420px] h-[560px] flex flex-col overflow-hidden shadow-2xl rounded-2xl bg-white border border-border"
                >
                    {/* ── Header ── */}
                    <div className="flex items-center justify-between px-5 py-4 shrink-0 border-b border-border bg-muted/50">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded bg-white border border-border flex items-center justify-center relative shadow-sm">
                                <Bot size={20} className="text-[var(--color-royal-blue)]" />
                                <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-green-500 border-2 border-white" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-foreground leading-none font-sans tracking-wide uppercase">
                                    floatCHAT
                                </h3>
                                <div className="flex items-center gap-1.5 mt-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                    <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                                        Online · Ocean AI
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-[var(--color-royal-blue)]/10 border border-[var(--color-royal-blue)]/20">
                                <Sparkles size={12} className="text-[var(--color-royal-blue)]" />
                                <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-royal-blue)]">AI</span>
                            </div>
                            <button
                                className="text-muted-foreground hover:text-foreground hover:bg-black/5 p-1.5 rounded-md transition-colors cursor-pointer"
                                onClick={() => setChatOpen(false)}
                            >
                                <X size={16} />
                            </button>
                        </div>
                    </div>

                    {/* ── Messages ── */}
                    <div ref={listRef} className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
                        {messages.map((m) => (
                            <MessageBubble key={m.id} message={m} />
                        ))}

                        {/* Suggested prompts */}
                        {messages.length === 1 && !loading && (
                            <motion.div
                                className="flex flex-wrap gap-2 mt-4"
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 }}
                            >
                                {suggestedPrompts.map((prompt) => (
                                    <button
                                        key={prompt}
                                        onClick={() => sendMessage(prompt)}
                                        className="text-[11px] px-3 py-1.5 rounded border border-border text-foreground hover:border-[var(--color-royal-blue)] hover:text-[var(--color-royal-blue)] hover:bg-muted font-mono tracking-tight transition-colors cursor-pointer"
                                    >
                                        {prompt}
                                    </button>
                                ))}
                            </motion.div>
                        )}

                        {error && (
                            <div className="text-xs px-3 py-2 rounded border border-red-500/30 bg-red-500/10 text-red-200 font-mono">
                                {error}
                            </div>
                        )}
                        {loading && <TypingDots />}
                    </div>

                    {/* ── Input ── */}
                    <div className="px-4 py-4 shrink-0 border-t border-border bg-white">
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-background focus-within:border-[var(--color-royal-blue)] focus-within:ring-1 focus-within:ring-[var(--color-royal-blue)] transition-all">
                            <input
                                type="text"
                                placeholder="Ask about oceanographic data..."
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={onKeyDown}
                                className="flex-1 text-sm bg-transparent border-none outline-none font-sans text-foreground placeholder:text-muted-foreground px-1"
                            />
                            <button
                                onClick={() => sendMessage()}
                                disabled={loading || !input.trim()}
                                className={`w-8 h-8 flex items-center justify-center rounded transition-all duration-200 cursor-pointer ${
                                    input.trim() && !loading
                                        ? 'bg-[var(--color-royal-blue)] text-white hover:bg-blue-700 shadow-sm'
                                        : 'bg-muted text-muted-foreground cursor-not-allowed'
                                }`}
                            >
                                <Send size={14} className={input.trim() && !loading ? 'ml-0.5' : ''} />
                            </button>
                        </div>
                        <p className="text-center mt-3 text-[10px] font-mono tracking-widest uppercase text-muted-foreground">
                            Powered by ARGO float data
                        </p>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}