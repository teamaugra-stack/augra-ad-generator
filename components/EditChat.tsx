"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ChatMessage, AdState, AdCopyData, AdLayout } from "@/types/chat";

interface EditChatProps {
  initialAdState: AdState;
  clientName?: string;
  onUpdate: (update: {
    imageUrl: string;
    bgImageUrl: string;
    adCopy: AdCopyData;
    layout: AdLayout;
  }) => void;
}

const MODELS = [
  { id: "auto", label: "Auto", desc: "AI picks best model" },
  { id: "nano_banana_pro", label: "Nano Banana", desc: "Best all-rounder" },
  { id: "gpt_image", label: "GPT Image", desc: "Medical/anatomy" },
  { id: "flux_kontext", label: "Kontext", desc: "Fast simple edits" },
  { id: "seedream", label: "Seedream", desc: "Artistic/editorial" },
];

const QUICK_EDITS = [
  "Make it darker and more dramatic",
  "Change the background to a luxury clinic",
  "Make the colors warmer",
  "Zoom out and show more of the environment",
  "Make it brighter and more energetic",
  "Change the headline",
];

export default function EditChat({ initialAdState, clientName, onUpdate }: EditChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [adState, setAdState] = useState<AdState>(initialAdState);
  const [selectedModel, setSelectedModel] = useState("auto");
  const [showModels, setShowModels] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: ChatMessage = { role: "user", content: text.trim() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages,
          adState,
          preferredModel: selectedModel !== "auto" ? selectedModel : undefined,
          clientName: clientName || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setMessages((prev) => [...prev, { role: "assistant", content: data.error || "Something went wrong." }]);
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);

        const newAdCopy = data.updatedAdCopy || adState.adCopy;
        const newLayout = data.updatedLayout || adState.layout;
        const newBgUrl = data.updatedBgImageUrl || adState.currentBgImageUrl;

        setAdState((prev) => ({ ...prev, adCopy: newAdCopy, layout: newLayout, currentBgImageUrl: newBgUrl }));

        if (data.updatedImageUrl) {
          onUpdate({ imageUrl: data.updatedImageUrl, bgImageUrl: newBgUrl, adCopy: newAdCopy, layout: newLayout });
        }
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Connection error. Try again." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border-t border-white/[0.04] bg-[rgba(5,5,7,0.8)] backdrop-blur-lg">
      {/* Messages */}
      <AnimatePresence>
        {(messages.length > 0 || loading) && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="max-h-[200px] overflow-y-auto px-4 pt-3 space-y-2">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${msg.role === "user" ? "bg-[var(--purple)]/15 text-white rounded-br-md" : "bg-white/[0.05] text-neutral-300 rounded-bl-md"}`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-white/[0.05] rounded-2xl rounded-bl-md px-4 py-2.5 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-[var(--teal)] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-1.5 h-1.5 bg-[var(--teal)] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-1.5 h-1.5 bg-[var(--teal)] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    <span className="text-xs text-neutral-500 ml-1">Editing image...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick edits */}
      {messages.length === 0 && !loading && (
        <div className="flex gap-2 px-4 pt-3 overflow-x-auto no-scrollbar">
          {QUICK_EDITS.map((edit) => (
            <button key={edit} onClick={() => sendMessage(edit)}
              className="flex-shrink-0 text-xs px-3.5 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.07] text-neutral-500 hover:text-white hover:bg-[var(--purple-dim)] hover:border-[var(--purple-border)] transition-all cursor-pointer">
              {edit}
            </button>
          ))}
        </div>
      )}

      {/* Input bar with model selector */}
      <div className="flex items-center gap-2 p-4">
        {/* Model selector */}
        <div className="relative">
          <button
            onClick={() => setShowModels(!showModels)}
            className="h-11 px-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs text-neutral-400 hover:text-white hover:border-[var(--purple-border)] transition-all cursor-pointer flex items-center gap-1.5"
          >
            <span className="text-[var(--teal)] text-[10px]">●</span>
            {MODELS.find(m => m.id === selectedModel)?.label || "Auto"}
            <svg className={`w-3 h-3 transition-transform ${showModels ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <AnimatePresence>
            {showModels && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="absolute bottom-full mb-2 left-0 w-52 bg-[rgba(8,5,18,0.97)] border border-[var(--purple-border)] rounded-xl overflow-hidden backdrop-blur-xl z-50"
              >
                {MODELS.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => { setSelectedModel(model.id); setShowModels(false); }}
                    className={`w-full text-left px-3 py-2.5 text-sm transition-colors cursor-pointer ${
                      selectedModel === model.id ? "bg-[var(--purple-dim)] text-white" : "text-neutral-400 hover:text-white hover:bg-white/[0.04]"
                    }`}
                  >
                    <div className="font-medium text-xs">{model.label}</div>
                    <div className="text-[10px] text-neutral-600">{model.desc}</div>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Text input */}
        <form onSubmit={(e) => { e.preventDefault(); sendMessage(input); }} className="flex-1 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe what to change..."
            className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-5 py-3 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-[var(--purple-border)] transition-all"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="w-11 h-11 rounded-xl bg-[var(--purple)] flex items-center justify-center text-white disabled:opacity-20 cursor-pointer hover:shadow-[0_0_20px_rgba(155,61,255,0.4)] transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}
