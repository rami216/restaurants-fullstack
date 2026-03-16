// "use client";

// import React from "react";
// import { motion } from "framer-motion";
// import Typewriter from "typewriter-effect";
// import SpecialButton from "@/components/specialButton";
// import MagicCard from "@/components/magicCard";
// import { Bot, Database, Feather, ShoppingCart } from "lucide-react";

// // Feature data for the "What You Can Build" section
// const features = [
//   {
//     icon: <Feather className="w-8 h-8 mb-4 text-pink-500" />,
//     title: "AI Elements & Pages",
//     description:
//       "Describe any component or a full page layout. Watch our AI bring it to life in seconds, from galleries to contact forms.",
//   },
//   {
//     icon: <Database className="w-8 h-8 mb-4 text-green-500" />,
//     title: "Database-Powered Apps",
//     description:
//       "Generate and refine full CRUD applications. Build directories, listings, or member portals with no backend code required.",
//   },
//   {
//     icon: <ShoppingCart className="w-8 h-8 mb-4 text-red-500" />,
//     title: "One-Click E-commerce",
//     description:
//       "Instantly turn items into sellable products. Our AI configures everything you need to start making sales immediately.",
//   },
//   {
//     icon: <Bot className="w-8 h-8 mb-4 text-blue-500" />,
//     title: "Automated Chatbots",
//     description:
//       "Let the AI automatically build a chatbot from your content, ready to answer questions and assist your visitors 24/7.",
//   },
// ];

// export default function MainPage() {
//   return (
//     <>
//       {/* ========================= */}
//       {/* Hero Section */}
//       {/* ========================= */}
//       <main className="min-h-[calc(90vh-64px)] flex flex-col items-center justify-center text-center bg-gradient-to-r from-pink-500 to-red-500 text-white px-4 overflow-hidden">
//         <motion.h1
//           initial={{ opacity: 0, y: 20 }}
//           animate={{ opacity: 1, y: 0 }}
//           transition={{ duration: 0.8 }}
//           className="text-4xl md:text-6xl font-extrabold mb-4"
//         >
//           Your Idea, Instantly Real
//         </motion.h1>

//         <motion.div
//           initial={{ opacity: 0, y: 20 }}
//           animate={{ opacity: 1, y: 0 }}
//           transition={{ delay: 0.5, duration: 0.8 }}
//           className="text-lg md:text-2xl h-16 md:h-8"
//         >
//           <Typewriter
//             options={{
//               strings: [
//                 "Build AI elements from a prompt.",
//                 "Generate database-connected apps.",
//                 "Create entire pages in seconds.",
//                 "Sell products with one click.",
//               ],
//               autoStart: true,
//               loop: true,
//               delay: 50,
//               deleteSpeed: 30,
//             }}
//           />
//         </motion.div>
//         <motion.div
//           initial={{ opacity: 0, scale: 0.8 }}
//           animate={{ opacity: 1, scale: 1 }}
//           transition={{ delay: 1, duration: 0.5 }}
//           className="mt-10"
//         >
//           <SpecialButton />
//         </motion.div>
//       </main>

//       {/* ========================= */}
//       {/* What You Can Build Section */}
//       {/* ========================= */}
//       <section className="py-20 bg-gray-50">
//         <div className="container mx-auto px-4 text-center">
//           <motion.h2
//             initial={{ opacity: 0, y: 20 }}
//             whileInView={{ opacity: 1, y: 0 }}
//             viewport={{ once: true }}
//             transition={{ duration: 0.8 }}
//             className="text-4xl font-bold mb-12 text-gray-800"
//           >
//             What Will You Build?
//           </motion.h2>
//           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
//             {features.map((feature, index) => (
//               <motion.div
//                 key={feature.title}
//                 initial={{ opacity: 0, y: 30 }}
//                 whileInView={{ opacity: 1, y: 0 }}
//                 viewport={{ once: true }}
//                 transition={{ delay: index * 0.2, duration: 0.6 }}
//               >
//                 <MagicCard className="p-8 h-full text-gray-800 bg-white">
//                   {feature.icon}
//                   <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
//                   <p className="text-gray-600">{feature.description}</p>
//                 </MagicCard>
//               </motion.div>
//             ))}
//           </div>
//         </div>
//       </section>

//       {/* ========================= */}
//       {/* How It Works Section */}
//       {/* ========================= */}
//       <section className="py-20 bg-white">
//         <div className="container mx-auto text-center px-4">
//           <motion.h2
//             initial={{ opacity: 0, y: 20 }}
//             whileInView={{ opacity: 1, y: 0 }}
//             viewport={{ once: true }}
//             transition={{ duration: 0.8 }}
//             className="text-4xl font-bold mb-16 text-gray-800"
//           >
//             A Simple, Powerful Workflow
//           </motion.h2>

//           <div className="grid md:grid-cols-3 gap-12 items-start">
//             {/* Step 1 */}
//             <motion.div
//               initial={{ opacity: 0, scale: 0.9 }}
//               whileInView={{ opacity: 1, scale: 1 }}
//               viewport={{ once: true }}
//               transition={{ delay: 0.2, duration: 0.6 }}
//               className="text-center"
//             >
//               <div className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-pink-500 mb-4">
//                 01
//               </div>
//               <h3 className="text-2xl font-bold mb-2 text-gray-800">
//                 Describe
//               </h3>
//               <p className="text-gray-600">
//                 Start with a simple prompt. Describe the element, section, or
//                 even a full data application you want to create.
//               </p>
//             </motion.div>

//             {/* Step 2 */}
//             <motion.div
//               initial={{ opacity: 0, scale: 0.9 }}
//               whileInView={{ opacity: 1, scale: 1 }}
//               viewport={{ once: true }}
//               transition={{ delay: 0.4, duration: 0.6 }}
//               className="text-center"
//             >
//               <div className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-red-500 mb-4">
//                 02
//               </div>
//               <h3 className="text-2xl font-bold mb-2 text-gray-800">
//                 Generate & Refine
//               </h3>
//               <p className="text-gray-600">
//                 Our AI builds your component instantly. Don't like something?
//                 Just ask for a change and refine it to perfection.
//               </p>
//             </motion.div>

//             {/* Step 3 */}
//             <motion.div
//               initial={{ opacity: 0, scale: 0.9 }}
//               whileInView={{ opacity: 1, scale: 1 }}
//               viewport={{ once: true }}
//               transition={{ delay: 0.6, duration: 0.6 }}
//               className="text-center"
//             >
//               <div className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-yellow-500 mb-4">
//                 03
//               </div>
//               <h3 className="text-2xl font-bold mb-2 text-gray-800">Launch</h3>
//               <p className="text-gray-600">
//                 Your creation is ready. Launch your new site, app, or chatbot
//                 with a single click.
//               </p>
//             </motion.div>
//           </div>
//         </div>
//       </section>

//       {/* ========================= */}
//       {/* Final CTA Section */}
//       {/* ========================= */}
//       <section className="py-20 bg-gradient-to-r from-green-400 via-teal-400 to-blue-500">
//         <div className="container mx-auto text-center px-4">
//           <motion.h2
//             initial={{ opacity: 0, y: 20 }}
//             whileInView={{ opacity: 1, y: 0 }}
//             viewport={{ once: true }}
//             transition={{ duration: 0.8 }}
//             className="text-3xl md:text-4xl font-bold text-white mb-8"
//           >
//             Stop Dreaming. Start Building.
//           </motion.h2>
//           <motion.div
//             initial={{ opacity: 0, scale: 0.8 }}
//             whileInView={{ opacity: 1, scale: 1 }}
//             viewport={{ once: true }}
//             transition={{ delay: 0.4, duration: 0.5 }}
//           >
//             <SpecialButton />
//           </motion.div>
//         </div>
//       </section>
//     </>
//   );
// }
"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  motion,
  useScroll,
  useTransform,
  AnimatePresence,
} from "framer-motion";
import SpecialButton from "@/components/specialButton";

// ── Types ──────────────────────────────────────────────────────
interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
}

// ── Floating particle background ──────────────────────────────
function ParticleField() {
  const [particles] = useState<Particle[]>(() =>
    Array.from({ length: 40 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 3 + 1,
      duration: Math.random() * 8 + 6,
      delay: Math.random() * 4,
    })),
  );

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full bg-white/20"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
          }}
          animate={{ y: [-20, 20, -20], opacity: [0.1, 0.5, 0.1] }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

// ── Animated counter ──────────────────────────────────────────
function Counter({ to, suffix = "" }: { to: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started) setStarted(true);
      },
      { threshold: 0.5 },
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [started]);

  useEffect(() => {
    if (!started) return;
    let frame = 0;
    const total = 60;
    const timer = setInterval(() => {
      frame++;
      setCount(Math.round((frame / total) * to));
      if (frame >= total) clearInterval(timer);
    }, 20);
    return () => clearInterval(timer);
  }, [started, to]);

  return (
    <span ref={ref}>
      {count}
      {suffix}
    </span>
  );
}

// ── Terminal demo component ───────────────────────────────────
const terminalLines = [
  {
    text: "$ zygoflow deploy --pipeline restaurant-bot",
    color: "#a3e635",
    delay: 0,
  },
  { text: "▶ Sandbox started", color: "#86efac", delay: 0.6 },
  { text: "▶ Running: Receptionist", color: "#67e8f9", delay: 1.2 },
  { text: "📤 Intent classified: order", color: "#e2e8f0", delay: 1.8 },
  { text: "▶ Running: Order Taker", color: "#67e8f9", delay: 2.4 },
  { text: "📤 Stripe payment link created", color: "#e2e8f0", delay: 3.0 },
  {
    text: "✅ Pipeline complete. Revenue: $24.99",
    color: "#4ade80",
    delay: 3.6,
  },
];

function TerminalDemo() {
  const [visibleLines, setVisibleLines] = useState<number[]>([]);

  useEffect(() => {
    terminalLines.forEach((line, i) => {
      setTimeout(
        () => {
          setVisibleLines((prev) => [...prev, i]);
        },
        line.delay * 1000 + 500,
      );
    });
  }, []);

  return (
    <div className="bg-[#0d1117] rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
      <div className="flex items-center gap-2 px-4 py-3 bg-white/5 border-b border-white/10">
        <div className="w-3 h-3 rounded-full bg-red-500/80" />
        <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
        <div className="w-3 h-3 rounded-full bg-green-500/80" />
        <span className="ml-2 text-xs text-white/40 font-mono">
          zygoflow terminal
        </span>
      </div>
      <div className="p-5 font-mono text-sm space-y-2 min-h-[220px]">
        {terminalLines.map((line, i) => (
          <AnimatePresence key={i}>
            {visibleLines.includes(i) && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
                style={{ color: line.color }}
              >
                {line.text}
                {i === visibleLines[visibleLines.length - 1] &&
                  visibleLines.length < terminalLines.length && (
                    <motion.span
                      animate={{ opacity: [1, 0] }}
                      transition={{ duration: 0.6, repeat: Infinity }}
                      className="ml-1 inline-block w-2 h-4 bg-green-400 align-middle"
                    />
                  )}
              </motion.div>
            )}
          </AnimatePresence>
        ))}
      </div>
    </div>
  );
}

// ── Agent flow visual ─────────────────────────────────────────
const agents = ["Receiver", "Solver", "Formatter", "Emailer"];

function AgentFlow() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActive((prev) => (prev + 1) % agents.length);
    }, 1200);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex items-center gap-2 justify-center flex-wrap">
      {agents.map((agent, i) => (
        <React.Fragment key={agent}>
          <motion.div
            animate={{
              borderColor: active === i ? "#a3e635" : "rgba(255,255,255,0.1)",
              backgroundColor:
                active === i
                  ? "rgba(163,230,53,0.1)"
                  : "rgba(255,255,255,0.03)",
              scale: active === i ? 1.05 : 1,
            }}
            transition={{ duration: 0.3 }}
            className="px-4 py-2 rounded-lg border text-sm font-mono"
            style={{
              color: active === i ? "#a3e635" : "rgba(255,255,255,0.5)",
            }}
          >
            <motion.span
              animate={{ opacity: active === i ? [1, 0.5, 1] : 1 }}
              transition={{
                duration: 0.8,
                repeat: active === i ? Infinity : 0,
              }}
            >
              {active === i ? "▶ " : "○ "}
              {agent}
            </motion.span>
          </motion.div>
          {i < agents.length - 1 && (
            <motion.span
              animate={{
                color: active > i ? "#4ade80" : "rgba(255,255,255,0.2)",
              }}
              className="text-lg font-bold"
            >
              →
            </motion.span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ── Feature card ──────────────────────────────────────────────
function FeatureCard({
  number,
  title,
  desc,
  tag,
  gradient,
  delay,
}: {
  number: string;
  title: string;
  desc: string;
  tag: string;
  gradient: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -6, transition: { duration: 0.2 } }}
      className="relative group bg-white/[0.03] border border-white/10 rounded-2xl p-7 overflow-hidden cursor-default"
    >
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background: `radial-gradient(circle at 50% 0%, ${gradient}15, transparent 70%)`,
        }}
      />
      <div className="relative z-10">
        <div
          className="text-5xl font-black mb-4 tabular-nums"
          style={{
            background: gradient,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          {number}
        </div>
        <div
          className="inline-block text-xs font-mono px-2 py-1 rounded-full border mb-3"
          style={{
            borderColor: `${gradient.split(",")[0].replace("linear-gradient(135deg,", "").trim()}40`,
            color: gradient
              .split(",")[0]
              .replace("linear-gradient(135deg,", "")
              .trim(),
          }}
        >
          {tag}
        </div>
        <h3 className="text-white font-bold text-xl mb-3">{title}</h3>
        <p className="text-white/50 text-sm leading-relaxed">{desc}</p>
      </div>
    </motion.div>
  );
}

// ── Use case pill ─────────────────────────────────────────────
const useCases = [
  "🍕 Restaurant Bot",
  "📚 Homework AI",
  "🏠 Airbnb Host",
  "💼 Job Applier",
  "📦 Order Fulfillment",
  "💇 Booking System",
  "📊 Sales Reports",
  "🤖 Lead Qualifier",
  "📧 Email Campaigns",
  "🔔 Alert System",
  "💳 Payment Flows",
  "📱 WhatsApp Bot",
];

function UseCaseTicker() {
  return (
    <div className="relative overflow-hidden py-4">
      <div className="absolute left-0 top-0 bottom-0 w-20 z-10 bg-gradient-to-r from-[#050508] to-transparent" />
      <div className="absolute right-0 top-0 bottom-0 w-20 z-10 bg-gradient-to-l from-[#050508] to-transparent" />
      <motion.div
        animate={{ x: ["0%", "-50%"] }}
        transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
        className="flex gap-3 w-max"
      >
        {[...useCases, ...useCases].map((uc, i) => (
          <span
            key={i}
            className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-white/60 text-sm font-mono whitespace-nowrap"
          >
            {uc}
          </span>
        ))}
      </motion.div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────
export default function MainPage() {
  const { scrollYProgress } = useScroll();
  const heroY = useTransform(scrollYProgress, [0, 0.3], [0, -80]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.25], [1, 0]);

  return (
    <div className="bg-[#050508] text-white overflow-x-hidden">
      {/* ── HERO ─────────────────────────────────────────── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-4 overflow-hidden">
        {/* Radial glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(163,230,53,0.08) 0%, transparent 70%)",
            }}
          />
          <div
            className="absolute top-0 left-1/4 w-[400px] h-[400px] rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(103,232,249,0.05) 0%, transparent 70%)",
            }}
          />
          <div
            className="absolute bottom-0 right-1/4 w-[300px] h-[300px] rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(167,139,250,0.05) 0%, transparent 70%)",
            }}
          />
        </div>

        {/* Grid lines */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />

        <ParticleField />

        <motion.div
          style={{ y: heroY, opacity: heroOpacity }}
          className="relative z-10 max-w-5xl mx-auto"
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-lime-500/30 bg-lime-500/10 text-lime-400 text-sm font-mono mb-8"
          >
            <span className="w-2 h-2 rounded-full bg-lime-400 animate-pulse" />
            AI Website Builder + Autonomous Agents
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="text-5xl md:text-7xl lg:text-8xl font-black leading-[0.95] tracking-tight mb-6"
            style={{ fontFamily: "'Syne', sans-serif" }}
          >
            <span className="text-white">Build.</span>{" "}
            <span
              style={{
                background: "linear-gradient(135deg, #a3e635, #67e8f9)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Automate.
            </span>
            <br />
            <span className="text-white/40">While You Sleep.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.8 }}
            className="text-white/50 text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            The only platform that combines an AI website builder with a full
            automation engine. Build your site. Deploy AI agents. Watch your
            business run itself.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.6 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
          >
            <SpecialButton />
            <button className="flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm font-mono group">
              <span className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center group-hover:border-white/40 transition-colors">
                ▶
              </span>
              Watch demo
            </button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.8 }}
            className="max-w-2xl mx-auto"
          >
            <TerminalDemo />
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
        >
          <span className="text-white/20 text-xs font-mono tracking-widest uppercase">
            scroll
          </span>
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="w-px h-8 bg-gradient-to-b from-white/20 to-transparent"
          />
        </motion.div>
      </section>

      {/* ── STATS ─────────────────────────────────────── */}
      <section className="py-16 border-y border-white/[0.06]">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: 10, suffix: "x", label: "faster than coding" },
              { value: 100, suffix: "%", label: "no backend required" },
              { value: 24, suffix: "/7", label: "agents run nonstop" },
              { value: 0, suffix: " humans", label: "needed to operate" },
            ].map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.6 }}
              >
                <div className="text-3xl md:text-4xl font-black text-lime-400 font-mono mb-1">
                  <Counter to={stat.value} suffix={stat.suffix} />
                </div>
                <div className="text-white/40 text-sm">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TWO PRODUCTS ─────────────────────────────── */}
      <section className="py-24 px-4">
        <div className="container mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2
              className="text-4xl md:text-5xl font-black mb-4"
              style={{ fontFamily: "'Syne', sans-serif" }}
            >
              Two products.
              <br />
              <span
                style={{
                  background: "linear-gradient(135deg, #a3e635, #67e8f9)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                One unstoppable platform.
              </span>
            </h2>
            <p className="text-white/40 max-w-xl mx-auto">
              Everything you need to build, launch, and automate — without
              touching a line of code.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Product 1 — Website Builder */}
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="relative bg-white/[0.03] border border-white/10 rounded-3xl p-8 overflow-hidden group"
            >
              <div
                className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700"
                style={{
                  background:
                    "radial-gradient(circle, rgba(163,230,53,0.08), transparent 70%)",
                  transform: "translate(30%, -30%)",
                }}
              />

              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-lime-500/10 border border-lime-500/20 text-lime-400 text-xs font-mono mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-lime-400" />
                AI Website Builder
              </div>

              <h3
                className="text-2xl font-bold text-white mb-3"
                style={{ fontFamily: "'Syne', sans-serif" }}
              >
                Your entire website,
                <br />
                described in one sentence.
              </h3>
              <p className="text-white/40 text-sm mb-6 leading-relaxed">
                Type what you want. Watch it appear. No templates, no
                drag-and-drop, no designers needed. Full database integration,
                e-commerce, chatbots — all generated by AI.
              </p>

              <div className="space-y-3">
                {[
                  "AI generates pages from a description",
                  "Database + CRUD apps instantly",
                  "One-click e-commerce",
                  "Chatbots from your content",
                ].map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-3 text-sm text-white/60"
                  >
                    <div className="w-4 h-4 rounded-full bg-lime-500/20 border border-lime-500/40 flex items-center justify-center flex-shrink-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-lime-400" />
                    </div>
                    {item}
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Product 2 — Agents */}
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="relative bg-white/[0.03] border border-white/10 rounded-3xl p-8 overflow-hidden group"
            >
              <div
                className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700"
                style={{
                  background:
                    "radial-gradient(circle, rgba(103,232,249,0.08), transparent 70%)",
                  transform: "translate(30%, -30%)",
                }}
              />

              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-mono mb-6">
                <motion.span
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="w-1.5 h-1.5 rounded-full bg-cyan-400"
                />
                AI Agents — Live
              </div>

              <h3
                className="text-2xl font-bold text-white mb-3"
                style={{ fontFamily: "'Syne', sans-serif" }}
              >
                Autonomous agents that
                <br />
                run your entire business.
              </h3>
              <p className="text-white/40 text-sm mb-6 leading-relaxed">
                Build multi-agent pipelines that take orders, process payments,
                send emails, and respond to customers — 24/7, automatically,
                with zero human involvement.
              </p>

              <AgentFlow />

              <div className="mt-6 space-y-3">
                {[
                  "Webhook + scheduled triggers",
                  "Dynamic agent routing",
                  "Stripe, Telegram, Email built-in",
                  "Deploy to cloud in one click",
                ].map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-3 text-sm text-white/60"
                  >
                    <div className="w-4 h-4 rounded-full bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center flex-shrink-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                    </div>
                    {item}
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── USE CASES TICKER ─────────────────────────── */}
      <section className="py-8 border-y border-white/[0.04]">
        <div className="mb-4 text-center">
          <span className="text-white/20 text-xs font-mono tracking-widest uppercase">
            What people are building
          </span>
        </div>
        <UseCaseTicker />
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────── */}
      <section className="py-24 px-4">
        <div className="container mx-auto max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2
              className="text-4xl md:text-5xl font-black mb-4"
              style={{ fontFamily: "'Syne', sans-serif" }}
            >
              From idea to income
              <br />
              <span className="text-white/30">in three steps.</span>
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            <FeatureCard
              number="01"
              title="Build your site"
              tag="Website Builder"
              desc="Describe your website in plain English. AI generates every page, connects your database, sets up e-commerce, and deploys — instantly."
              gradient="linear-gradient(135deg, #a3e635, #84cc16)"
              delay={0}
            />
            <FeatureCard
              number="02"
              title="Deploy your agents"
              tag="AI Agents"
              desc="Build multi-step pipelines visually. Each agent handles one job: classify, respond, charge, notify. Deploy to the cloud with one click."
              gradient="linear-gradient(135deg, #67e8f9, #22d3ee)"
              delay={0.15}
            />
            <FeatureCard
              number="03"
              title="Watch it run"
              tag="Full Automation"
              desc="Webhooks fire. Agents wake up. Customers get served. Money lands in your account. You do absolutely nothing."
              gradient="linear-gradient(135deg, #a78bfa, #8b5cf6)"
              delay={0.3}
            />
          </div>
        </div>
      </section>

      {/* ── REAL DEMO SECTION ────────────────────────── */}
      <section className="py-24 px-4 bg-white/[0.02] border-y border-white/[0.05]">
        <div className="container mx-auto max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2
              className="text-4xl md:text-5xl font-black mb-4"
              style={{ fontFamily: "'Syne', sans-serif" }}
            >
              A real pipeline,
              <br />
              <span
                style={{
                  background: "linear-gradient(135deg, #a3e635, #67e8f9)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                running right now.
              </span>
            </h2>
            <p className="text-white/40">
              This is an actual restaurant bot built on Zygoflow. No demo. No
              fake data.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <div className="space-y-4">
                {[
                  {
                    step: "1",
                    text: "Customer sends 'I want pizza' on Telegram",
                    icon: "💬",
                    color: "#a3e635",
                  },
                  {
                    step: "2",
                    text: "Receptionist classifies intent → routes to Order Taker",
                    icon: "🤖",
                    color: "#67e8f9",
                  },
                  {
                    step: "3",
                    text: "Order Taker takes the order, asks for email",
                    icon: "📋",
                    color: "#a78bfa",
                  },
                  {
                    step: "4",
                    text: "Stripe payment link sent automatically",
                    icon: "💳",
                    color: "#f59e0b",
                  },
                  {
                    step: "5",
                    text: "Payment confirmed → kitchen notified + email receipt",
                    icon: "✅",
                    color: "#4ade80",
                  },
                ].map((item, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1, duration: 0.5 }}
                    className="flex items-start gap-4 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] group hover:border-white/20 transition-colors"
                  >
                    <span className="text-2xl">{item.icon}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="text-xs font-mono px-2 py-0.5 rounded-full bg-white/5"
                          style={{ color: item.color }}
                        >
                          step {item.step}
                        </span>
                      </div>
                      <p className="text-white/70 text-sm">{item.text}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <TerminalDemo />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ─────────────────────────────────── */}
      <section className="relative py-32 px-4 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(163,230,53,0.07) 0%, transparent 70%)",
            }}
          />
        </div>

        <div className="container mx-auto max-w-3xl text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 text-white/40 text-xs font-mono mb-8">
              No credit card. No code. No excuses.
            </div>

            <h2
              className="text-5xl md:text-6xl font-black leading-tight mb-6"
              style={{ fontFamily: "'Syne', sans-serif" }}
            >
              Your business
              <br />
              <span
                style={{
                  background: "linear-gradient(135deg, #a3e635, #67e8f9)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                doesn't need you.
              </span>
            </h2>

            <p className="text-white/40 text-lg mb-10 max-w-lg mx-auto">
              Build it once. Let Zygoflow run it forever. While you sleep,
              travel, or build the next one.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <SpecialButton />
              <span className="text-white/20 text-sm font-mono">
                → takes less than 2 minutes
              </span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Google Font */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800;900&display=swap"
        rel="stylesheet"
      />
    </div>
  );
}
