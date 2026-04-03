"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

interface WelcomeScreenProps {
  clientName: string;
  businessName: string;
  onContinue: () => void;
}

export default function WelcomeScreen({
  clientName,
  businessName,
  onContinue,
}: WelcomeScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -999, y: -999 });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 500);
    return () => clearTimeout(timer);
  }, []);

  // Neural particle system
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let W = (canvas.width = window.innerWidth);
    let H = (canvas.height = window.innerHeight);
    let animId: number;

    const COUNT = 80;
    const LINK_DIST = 130;
    const MOUSE_DIST = 180;

    const rand = (min: number, max: number) =>
      Math.random() * (max - min) + min;

    let nodes = Array.from({ length: COUNT }, () => ({
      x: rand(0, W),
      y: rand(0, H),
      vx: rand(-0.35, 0.35),
      vy: rand(-0.35, 0.35),
      r: rand(1.5, 3.2),
      pulse: rand(0, Math.PI * 2),
    }));

    const handleResize = () => {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
      nodes = Array.from({ length: COUNT }, () => ({
        x: rand(0, W),
        y: rand(0, H),
        vx: rand(-0.35, 0.35),
        vy: rand(-0.35, 0.35),
        r: rand(1.5, 3.2),
        pulse: rand(0, Math.PI * 2),
      }));
    };

    const handleMouse = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("mousemove", handleMouse);

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      const mouse = mouseRef.current;

      nodes.forEach((n) => {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0) n.x = W;
        if (n.x > W) n.x = 0;
        if (n.y < 0) n.y = H;
        if (n.y > H) n.y = 0;
        n.pulse += 0.02;
      });

      // Connections
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];

        // Mouse line
        const md = Math.hypot(a.x - mouse.x, a.y - mouse.y);
        if (md < MOUSE_DIST) {
          const alpha = (1 - md / MOUSE_DIST) * 0.5;
          const grad = ctx.createLinearGradient(
            a.x,
            a.y,
            mouse.x,
            mouse.y
          );
          grad.addColorStop(0, `rgba(180,60,255,${alpha})`);
          grad.addColorStop(1, `rgba(120,0,220,0)`);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.strokeStyle = grad;
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }

        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < LINK_DIST) {
            const alpha = (1 - d / LINK_DIST) * 0.45;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(130,40,240,${alpha})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }

      // Draw nodes
      nodes.forEach((n) => {
        const glow = (Math.sin(n.pulse) + 1) / 2;
        const r = n.r + glow * 1.2;

        const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r * 3.5);
        g.addColorStop(0, `rgba(200,80,255,${0.85 + glow * 0.15})`);
        g.addColorStop(1, `rgba(120,20,220,0)`);
        ctx.beginPath();
        ctx.arc(n.x, n.y, r * 3.5, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(230,120,255,${0.9 + glow * 0.1})`;
        ctx.fill();
      });

      animId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouse);
    };
  }, []);

  // Extract first name or "Dr. X" from client name
  const displayName = clientName
    ? clientName.includes("Dr")
      ? clientName
      : `Dr. ${clientName.split(" ")[1] || clientName}`
    : businessName;

  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center overflow-hidden">
      {/* Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* Grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(130,40,240,0.14) 1px, transparent 1px), linear-gradient(90deg, rgba(130,40,240,0.14) 1px, transparent 1px)",
          backgroundSize: "52px 52px",
          animation: "gridPulse 5s ease-in-out infinite",
        }}
      />

      {/* Orbs */}
      <div className="absolute top-[-140px] left-[-100px] w-[500px] h-[500px] rounded-full blur-[70px] pointer-events-none animate-float"
        style={{ background: "radial-gradient(circle, rgba(150,40,255,0.55) 0%, transparent 70%)" }} />
      <div className="absolute bottom-[-100px] right-[-80px] w-[400px] h-[400px] rounded-full blur-[70px] pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(70,0,200,0.6) 0%, transparent 70%)", animation: "float 13s ease-in-out infinite" }} />
      <div className="absolute top-[45%] left-[62%] w-[260px] h-[260px] rounded-full blur-[70px] pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(210,80,255,0.4) 0%, transparent 70%)", animation: "float 8s ease-in-out infinite" }} />

      {/* Scanline */}
      <div className="absolute left-0 right-0 h-[2px] pointer-events-none welcome-scanline"
        style={{ background: "linear-gradient(90deg, transparent 0%, rgba(180,60,255,0.9) 50%, transparent 100%)" }} />

      {/* Expanding rings */}
      <div className="absolute top-1/2 left-1/2 pointer-events-none">
        {[0, 1.65, 3.3].map((delay, i) => (
          <div
            key={i}
            className="absolute w-[240px] h-[240px] rounded-full border border-purple-500/30 welcome-ring"
            style={{ top: 0, left: 0, transform: "translate(-50%,-50%)", animationDelay: `${delay}s` }}
          />
        ))}
      </div>

      {/* Corner brackets */}
      <div className="absolute top-7 left-7 w-10 h-10 border-t-2 border-l-2 border-purple-500/60 welcome-bracket" />
      <div className="absolute top-7 right-7 w-10 h-10 border-t-2 border-r-2 border-purple-500/60 welcome-bracket" />
      <div className="absolute bottom-7 left-7 w-10 h-10 border-b-2 border-l-2 border-purple-500/60 welcome-bracket" />
      <div className="absolute bottom-7 right-7 w-10 h-10 border-b-2 border-r-2 border-purple-500/60 welcome-bracket" />

      {/* Floating data chips */}
      {["SYS_INIT", "NODE_09", "0xA3F2", "NET_OK", "AI_CORE"].map(
        (text, i) => (
          <div
            key={text}
            className="absolute text-[10px] font-mono text-purple-400/40 tracking-widest pointer-events-none welcome-chip"
            style={{
              left: ["6%", "80%", "12%", "74%", "50%"][i],
              top: ["18%", "12%", "72%", "78%", "8%"][i],
              animationDuration: ["14s", "18s", "11s", "16s", "20s"][i],
              animationDelay: ["0s", "-4s", "-7s", "-2s", "-9s"][i],
            }}
          >
            {text}
          </div>
        )
      )}

      {/* Horizontal streaks */}
      {[
        { top: "22%", dur: "4s", delay: "0s" },
        { top: "55%", dur: "6s", delay: "-2s" },
        { top: "80%", dur: "5s", delay: "-4s" },
      ].map((s, i) => (
        <div
          key={i}
          className="absolute h-[1px] pointer-events-none welcome-streak"
          style={{
            top: s.top,
            background:
              "linear-gradient(90deg, transparent, rgba(160,50,255,0.6), transparent)",
            animationDuration: s.dur,
            animationDelay: s.delay,
          }}
        />
      ))}

      {/* Content */}
      <div className="relative z-20 text-center px-10 max-w-[700px]">
        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.9 }}
          className="font-mono text-[11px] tracking-[0.3em] text-purple-400/85 uppercase mb-6"
        >
          {"// augra_media · ad_studio"}
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.9 }}
          className="text-[13px] tracking-[0.2em] text-white/35 uppercase mb-3"
        >
          Welcome
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.9 }}
          className="text-[clamp(44px,8vw,80px)] font-extrabold leading-none tracking-tight mb-1 font-heading"
          style={{
            background:
              "linear-gradient(135deg, #fff 0%, #cc66ff 45%, #6610cc 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          {displayName}
        </motion.h1>

        {/* Divider */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.9 }}
          className="flex items-center gap-3.5 mx-auto w-fit my-8"
        >
          <div className="w-[60px] h-[1px] bg-gradient-to-r from-transparent to-purple-500/80" />
          <div className="w-1.5 h-1.5 rounded-full bg-purple-500/90 shadow-[0_0_10px_rgba(180,60,255,0.8),0_0_24px_rgba(180,60,255,0.4)] animate-pulse" />
          <div className="w-[60px] h-[1px] bg-gradient-to-l from-transparent to-purple-500/80" />
        </motion.div>

        {/* Brand row */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.9 }}
          className="flex items-center justify-center gap-2.5"
        >
          <div className="w-7 h-7 border border-purple-500/70 rounded-md flex items-center justify-center welcome-mark-spin">
            <div className="w-2.5 h-2.5 bg-purple-500/90 rounded-sm welcome-mark-spin-reverse" />
          </div>
          <span className="font-mono text-[13px] tracking-[0.18em] text-white/70 uppercase">
            <span className="text-purple-400/95">Augra</span> Media
          </span>
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1, duration: 0.9 }}
          className="mt-5 text-[13px] tracking-[0.12em] text-white/30"
        >
          AI-Powered Ad Generation · Built for Growth
        </motion.p>

        {/* Continue button */}
        {ready && (
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.8, duration: 0.6 }}
            onClick={onContinue}
            className="mt-12 px-10 py-3.5 rounded-full text-sm font-semibold tracking-wide transition-all duration-300 cursor-pointer"
            style={{
              background:
                "linear-gradient(135deg, rgba(139,92,246,0.3) 0%, rgba(59,130,246,0.2) 100%)",
              border: "1px solid rgba(160,50,255,0.4)",
              color: "rgba(255,255,255,0.85)",
            }}
            whileHover={{
              boxShadow:
                "0 0 30px rgba(160,50,255,0.4), 0 0 60px rgba(160,50,255,0.15)",
              borderColor: "rgba(200,80,255,0.7)",
            }}
            whileTap={{ scale: 0.97 }}
          >
            Enter Studio →
          </motion.button>
        )}
      </div>
    </div>
  );
}
