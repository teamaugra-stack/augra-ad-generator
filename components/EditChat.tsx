"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ChatMessage, AdState, AdCopyData, AdLayout } from "@/types/chat";

interface EditChatProps {
  initialAdState: AdState;
  onUpdate: (update: {
    imageUrl: string;
    bgImageUrl: string;
    adCopy: AdCopyData;
    layout: AdLayout;
  }) => void;
}

const QUICK_EDITS = [
  "Change the headline",
  "Make it bolder",
  "Adjust the colors",
  "Change the CTA",
  "Darker background",
  "Regenerate image",
];

export default function EditChat({ initialAdState, onUpdate }: EditChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [adState, setAdState] = useState<AdState>(initialAdState);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
        body: JSON.stringify({ messages: updatedMessages, adState }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.error || "Something went wrong. Try again." },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.reply },
        ]);

        // Update state and notify parent
        const newAdCopy = data.updatedAdCopy || adState.adCopy;
        const newLayout = data.updatedLayout || adState.layout;
        const newBgUrl = data.updatedBgImageUrl || adState.currentBgImageUrl;

        setAdState((prev) => ({
          ...prev,
          adCopy: newAdCopy,
          layout: newLayout,
          currentBgImageUrl: newBgUrl,
        }));

        if (data.updatedImageUrl) {
          onUpdate({
            imageUrl: data.updatedImageUrl,
            bgImageUrl: newBgUrl,
            adCopy: newAdCopy,
            layout: newLayout,
          });
        }
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Connection error. Try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <div className="border-t border-white/[0.04] bg-black/50 backdrop-blur-lg">
      {/* Messages area — scrollable, compact */}
      <AnimatePresence>
        {(messages.length > 0 || loading) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="max-h-[200px] overflow-y-auto px-4 pt-3 space-y-2">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                      msg.role === "user"
                        ? "bg-violet-500/15 text-white rounded-br-md"
                        : "bg-white/[0.05] text-neutral-300 rounded-bl-md"
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-white/[0.05] rounded-2xl rounded-bl-md px-4 py-2.5 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    <span className="text-xs text-neutral-500 ml-1">Editing...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick edits — show only when no messages */}
      {messages.length === 0 && !loading && (
        <div className="flex gap-2 px-4 pt-3 overflow-x-auto no-scrollbar">
          {QUICK_EDITS.map((edit) => (
            <button
              key={edit}
              onClick={() => sendMessage(edit)}
              className="flex-shrink-0 text-xs px-3.5 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.07] text-neutral-500 hover:text-white hover:bg-violet-500/10 hover:border-violet-500/30 transition-all duration-200 cursor-pointer"
            >
              {edit}
            </button>
          ))}
        </div>
      )}

      {/* Input bar */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2 p-4">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Describe what to change..."
          className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-2xl px-5 py-3 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-violet-500/40 transition-all"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="w-11 h-11 rounded-2xl bg-gradient-to-r from-violet-500 to-blue-500 flex items-center justify-center text-white disabled:opacity-20 disabled:cursor-not-allowed hover:shadow-[0_0_20px_rgba(139,92,246,0.3)] transition-all cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </form>
    </div>
  );
}
