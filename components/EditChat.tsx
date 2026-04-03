"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
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
  "Different layout style",
  "Make it bolder",
  "Adjust the colors",
  "Change the CTA",
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
  }, [messages]);

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
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.error || "Something went wrong. Try again.",
          },
        ]);
      } else {
        // Update messages
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.reply },
        ]);

        // Update ad state
        const newState: AdState = {
          ...adState,
          adCopy: data.updatedAdCopy || adState.adCopy,
          layout: data.updatedLayout || adState.layout,
          currentBgImageUrl: data.updatedBgImageUrl || adState.currentBgImageUrl,
        };
        setAdState(newState);

        // Notify parent
        onUpdate({
          imageUrl: data.updatedImageUrl,
          bgImageUrl: data.updatedBgImageUrl || adState.currentBgImageUrl,
          adCopy: data.updatedAdCopy || adState.adCopy,
          layout: data.updatedLayout || adState.layout,
        });
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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="glass-card rounded-2xl p-6 md:p-8 mt-6"
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <svg
          className="w-4 h-4 text-violet-400/70"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
        <h3 className="text-sm font-medium text-white">Edit your ad</h3>
        <span className="text-xs text-neutral-500">
          — describe what to change
        </span>
      </div>

      {/* Messages */}
      {messages.length > 0 && (
        <div className="max-h-[300px] overflow-y-auto mb-4 space-y-3 pr-2 scrollbar-thin">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm ${
                  msg.role === "user"
                    ? "bg-white/[0.08] text-white"
                    : "bg-violet-500/[0.08] border border-violet-500/[0.1] text-neutral-300"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-violet-500/[0.08] border border-violet-500/[0.1] rounded-xl px-4 py-2.5">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-neutral-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-2 h-2 bg-neutral-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-2 h-2 bg-neutral-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Quick edit chips */}
      {messages.length === 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {QUICK_EDITS.map((edit) => (
            <button
              key={edit}
              type="button"
              onClick={() => sendMessage(edit)}
              className="text-xs px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.08] text-neutral-400 hover:text-white hover:bg-white/[0.08] hover:border-white/[0.15] transition-all duration-200"
            >
              {edit}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. Make the headline bigger and change CTA to 'Book Today'"
          className="input-style flex-1 !py-2.5 text-sm"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="px-4 py-2.5 bg-white/[0.08] border border-white/[0.1] rounded-xl text-white hover:bg-white/[0.12] transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
            />
          </svg>
        </button>
      </form>
    </motion.div>
  );
}
