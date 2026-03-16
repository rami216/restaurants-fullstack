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

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Typewriter from "typewriter-effect";
import SpecialButton from "@/components/specialButton";
import MagicCard from "@/components/magicCard";
import {
  Bot,
  Database,
  ShoppingCart,
  Feather,
  Download,
  Zap,
  Globe,
  Clock,
  Webhook,
  CheckCircle,
  ArrowRight,
  Sparkles,
  Terminal,
  Mail,
  CreditCard,
  CloudLightning,
} from "lucide-react";

// ─────────────────────────────────────────────
// WEBSITE BUILDER FEATURES
// ─────────────────────────────────────────────
const builderFeatures = [
  {
    icon: <Feather className="w-8 h-8 mb-4 text-pink-500" />,
    title: "AI Website Generation",
    description:
      "Describe any component or full page. Watch our AI bring it to life in seconds — galleries, contact forms, hero sections, anything.",
  },
  {
    icon: <Database className="w-8 h-8 mb-4 text-green-500" />,
    title: "Integrated Databases",
    description:
      "Generate full CRUD applications instantly. Build directories, listings, or user portals with zero backend configuration.",
  },
  {
    icon: <ShoppingCart className="w-8 h-8 mb-4 text-red-500" />,
    title: "Instant E-commerce",
    description:
      "Turn any item into a sellable product. AI configures everything you need to start accepting Stripe payments immediately.",
  },
  {
    icon: <Bot className="w-8 h-8 mb-4 text-blue-500" />,
    title: "Custom AI Chatbots",
    description:
      "Embed intelligent chatbots directly into your new site, trained on your data to assist visitors 24/7.",
  },
];

// ─────────────────────────────────────────────
// THE ZYGOFLOW ECOSYSTEM (STEPS)
// ─────────────────────────────────────────────
const ecosystemSteps = [
  {
    number: "01",
    icon: <Globe className="w-6 h-6" />,
    title: "Build the Web App",
    description:
      "Use our web-based AI builder to generate your frontend, connect your database, and set up your products in minutes.",
    color: "from-pink-500 to-red-500",
    tag: "Web Builder",
  },
  {
    number: "02",
    icon: <Terminal className="w-6 h-6" />,
    title: "Test Agents Locally",
    description:
      "Download the Zygoflow Desktop App (Mac/PC) to visually build and test your AI workflows on your own machine for free.",
    color: "from-orange-500 to-pink-500",
    tag: "Desktop App",
  },
  {
    number: "03",
    icon: <CloudLightning className="w-6 h-6" />,
    title: "Deploy to ZygoCloud",
    description:
      "One click pushes your local pipelines to the cloud. They now run 24/7, listening for Stripe webhooks and scheduled triggers.",
    color: "from-purple-500 to-pink-500",
    tag: "Cloud Hosting",
  },
];

// ─────────────────────────────────────────────
// AGENT CAPABILITIES
// ─────────────────────────────────────────────
const agentCaps = [
  {
    icon: <Webhook className="w-5 h-5 text-pink-500" />,
    title: "Webhook Triggers",
    desc: "Stripe payments, Telegram messages, or custom API calls fire your pipeline instantly.",
  },
  {
    icon: <Clock className="w-5 h-5 text-purple-500" />,
    title: "Scheduled Triggers",
    desc: "Run cloud pipelines every hour, daily at 9am, or at any custom interval.",
  },
  {
    icon: <Zap className="w-5 h-5 text-yellow-500" />,
    title: "Dynamic AI Routing",
    desc: "Agents pass data to each other based on AI decisions. Order? FAQ? Support? Auto-routed.",
  },
  {
    icon: <CreditCard className="w-5 h-5 text-green-500" />,
    title: "Stripe Automation",
    desc: "Create payment links on the fly, listen for successful checkouts, and trigger delivery.",
  },
  {
    icon: <Mail className="w-5 h-5 text-blue-500" />,
    title: "Email & Notifications",
    desc: "Send personalized receipts, alerts, and reports via your connected email providers.",
  },
  {
    icon: <Database className="w-5 h-5 text-red-500" />,
    title: "Data Syncing",
    desc: "Read and write data directly to your Zygoflow database, Google Sheets, or external CRMs.",
  },
];

// ─────────────────────────────────────────────
// LIVE PIPELINE DEMO
// ─────────────────────────────────────────────
const pipelineAgents = [
  {
    name: "Receptionist",
    desc: "Classifies intent",
    color: "text-pink-500",
    bg: "bg-pink-50 border-pink-300",
  },
  {
    name: "Order Taker",
    desc: "Takes the order",
    color: "text-orange-500",
    bg: "bg-orange-50 border-orange-300",
  },
  {
    name: "Stripe Bot",
    desc: "Creates payment",
    color: "text-green-600",
    bg: "bg-green-50 border-green-300",
  },
  {
    name: "Notifier",
    desc: "Sends confirmation",
    color: "text-blue-500",
    bg: "bg-blue-50 border-blue-300",
  },
];

const logMessages = [
  "▶ Webhook Received: Telegram Message",
  "▶ Running: Receptionist — classifying intent...",
  "📤 Intent: order → routing to Order Taker",
  "▶ Running: Order Taker — reading menu database...",
  "📤 Reply sent. Waiting for confirmation.",
  "▶ Running: Stripe Bot — generating checkout...",
  "💳 Payment link generated: $24.99",
  "▶ Running: Notifier — sending email receipt...",
  "✅ Pipeline complete. Data saved to DB.",
];

function LivePipelineDemo() {
  const [activeAgent, setActiveAgent] = useState(0);
  const [done, setDone] = useState<number[]>([]);
  const [logIndex, setLogIndex] = useState(0);
  const [visibleLogs, setVisibleLogs] = useState<string[]>([]);

  useEffect(() => {
    const agentTimer = setInterval(() => {
      setActiveAgent((prev) => {
        const next = (prev + 1) % pipelineAgents.length;
        if (next === 0) {
          setDone([]);
          setVisibleLogs([]);
          setLogIndex(0);
        } else setDone((d) => [...d, prev]);
        return next;
      });
    }, 2000);
    return () => clearInterval(agentTimer);
  }, []);

  useEffect(() => {
    if (logIndex >= logMessages.length) return;
    const t = setTimeout(() => {
      setVisibleLogs((prev) => [...prev, logMessages[logIndex]]);
      setLogIndex((i) => i + 1);
    }, 600);
    return () => clearTimeout(t);
  }, [logIndex, activeAgent]);

  return (
    <div className="bg-gray-900 rounded-2xl overflow-hidden border border-gray-700 shadow-2xl">
      <div className="flex items-center gap-2 px-4 py-3 bg-gray-800 border-b border-gray-700">
        <div className="w-3 h-3 rounded-full bg-red-500" />
        <div className="w-3 h-3 rounded-full bg-yellow-500" />
        <div className="w-3 h-3 rounded-full bg-green-500" />
        <span className="ml-2 text-gray-400 text-xs font-mono">
          zygo-cloud — automated-sales-pipeline
        </span>
        <span className="ml-auto flex items-center gap-1.5 text-green-400 text-xs font-mono">
          <motion.span
            animate={{ opacity: [1, 0, 1] }}
            transition={{ duration: 1.2, repeat: Infinity }}
            className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block"
          />
          deployed
        </span>
      </div>

      <div className="p-5 border-b border-gray-800">
        <div className="flex flex-wrap gap-2">
          {pipelineAgents.map((agent, i) => (
            <React.Fragment key={agent.name}>
              <div
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-all duration-300 ${
                  activeAgent === i
                    ? agent.bg + " shadow-sm"
                    : "bg-gray-800 border-gray-700"
                }`}
              >
                {done.includes(i) && (
                  <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                )}
                {activeAgent === i && (
                  <motion.span
                    animate={{ opacity: [1, 0.2, 1] }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${agent.color.replace("text-", "bg-")}`}
                  />
                )}
                <span
                  className={`font-medium text-xs ${activeAgent === i ? agent.color : "text-gray-500"}`}
                >
                  {agent.name}
                </span>
              </div>
              {i < pipelineAgents.length - 1 && (
                <div className="flex items-center">
                  <ArrowRight
                    className={`w-3.5 h-3.5 ${done.includes(i) ? "text-green-400" : "text-gray-700"}`}
                  />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="p-5 font-mono text-xs space-y-1.5 min-h-[140px]">
        {visibleLogs.map((log, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            className={
              log.startsWith("✅")
                ? "text-green-400"
                : log.startsWith("💳")
                  ? "text-yellow-400"
                  : log.startsWith("▶")
                    ? "text-blue-400"
                    : "text-gray-400"
            }
          >
            {log}
          </motion.div>
        ))}
        {logIndex < logMessages.length && (
          <motion.span
            animate={{ opacity: [1, 0] }}
            transition={{ duration: 0.6, repeat: Infinity }}
            className="inline-block w-2 h-3.5 bg-green-400 align-middle ml-1"
          />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// USE CASE TICKER
// ─────────────────────────────────────────────
const useCases = [
  "🍕 Restaurant Sites & Bots",
  "📚 Course Platforms",
  "💼 SaaS Landing Pages",
  "📦 Inventory Dashboards",
  "💇 Booking Portals",
  "📊 Automated Reports",
  "🤖 Telegram AI Agents",
  "📧 Support Desks",
  "💳 E-commerce Stores",
];

function UseCaseTicker() {
  return (
    <div className="relative overflow-hidden py-3">
      <div className="absolute left-0 top-0 bottom-0 w-24 z-10 bg-gradient-to-r from-gray-50 to-transparent" />
      <div className="absolute right-0 top-0 bottom-0 w-24 z-10 bg-gradient-to-l from-gray-50 to-transparent" />
      <motion.div
        animate={{ x: ["0%", "-50%"] }}
        transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
        className="flex gap-3 w-max"
      >
        {[...useCases, ...useCases].map((uc, i) => (
          <span
            key={i}
            className="px-4 py-2 rounded-full bg-white border border-gray-200 text-gray-600 text-sm font-medium whitespace-nowrap shadow-sm"
          >
            {uc}
          </span>
        ))}
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────
export default function MainPage() {
  return (
    <>
      {/* ══════════════════════════════════════════ */}
      {/* HERO */}
      {/* ══════════════════════════════════════════ */}
      <main className="relative min-h-[calc(90vh-64px)] flex flex-col items-center justify-center text-center bg-gradient-to-br from-pink-500 via-red-500 to-orange-500 text-white px-4 overflow-hidden">
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)",
            backgroundSize: "50px 50px",
          }}
        />
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 6, repeat: Infinity }}
          className="absolute top-16 left-16 w-72 h-72 rounded-full bg-white/10 blur-3xl pointer-events-none"
        />
        <motion.div
          animate={{ scale: [1.2, 1, 1.2], opacity: [0.15, 0.3, 0.15] }}
          transition={{ duration: 9, repeat: Infinity }}
          className="absolute bottom-16 right-16 w-96 h-96 rounded-full bg-yellow-200/10 blur-3xl pointer-events-none"
        />

        <div className="relative z-10 max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm border border-white/30 rounded-full px-4 py-1.5 text-sm font-semibold mb-6"
          >
            <Sparkles className="w-4 h-4" />
            The All-In-One Platform for AI Startups
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="text-5xl md:text-7xl font-extrabold mb-4 leading-tight"
          >
            Build the Website.
            <br />
            Automate the Work.
          </motion.h1>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.8 }}
            className="text-xl md:text-2xl text-white/90 h-10 mb-10"
          >
            <Typewriter
              options={{
                strings: [
                  "Generate full websites with databases instantly.",
                  "Build AI agents locally on your desktop.",
                  "Deploy pipelines to the cloud for 24/7 webhooks.",
                  "Accept Stripe payments on autopilot.",
                ],
                autoStart: true,
                loop: true,
                delay: 45,
                deleteSpeed: 25,
              }}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.7, duration: 0.5 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <SpecialButton text="Start Building Free" />
            <a
              href="#ecosystem"
              className="flex items-center gap-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm border border-white/30 text-white font-semibold px-6 py-3 rounded-full transition-all duration-200"
            >
              See How It Works
            </a>
          </motion.div>
        </div>

        <div className="absolute bottom-0 left-0 right-0">
          <svg
            viewBox="0 0 1440 80"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M0 80L1440 80L1440 40C1200 80 960 0 720 20C480 40 240 80 0 40L0 80Z"
              fill="#f9fafb"
            />
          </svg>
        </div>
      </main>

      {/* ══════════════════════════════════════════ */}
      {/* STATS */}
      {/* ══════════════════════════════════════════ */}
      <section className="bg-gray-50 py-10 border-b border-gray-100">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: "UI & DB", label: "Generated Instantly" },
              { value: "Local", label: "Agent Testing" },
              { value: "24/7", label: "Cloud Deployment" },
              { value: "Stripe", label: "Built-In Monetization" },
            ].map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <div className="text-3xl font-extrabold bg-gradient-to-r from-pink-500 to-red-500 bg-clip-text text-transparent mb-1">
                  {stat.value}
                </div>
                <div className="text-gray-500 text-sm">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════ */}
      {/* WEBSITE BUILDER */}
      {/* ══════════════════════════════════════════ */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-6"
          >
            <span className="inline-flex items-center gap-2 bg-pink-100 text-pink-600 text-sm font-semibold px-4 py-1.5 rounded-full mb-4">
              <Globe className="w-4 h-4" /> Part 1: The Platform
            </span>
            <h2 className="text-4xl md:text-5xl font-extrabold text-gray-800 mb-4">
              AI-Powered Web Apps
            </h2>
            <p className="text-gray-500 max-w-xl mx-auto text-lg">
              Generate frontends, provision databases, and spin up e-commerce
              portals right from your browser.
            </p>
          </motion.div>

          <div className="my-10">
            <UseCaseTicker />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {builderFeatures.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.15, duration: 0.6 }}
              >
                <MagicCard className="p-8 h-full text-gray-800 bg-white">
                  {feature.icon}
                  <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                  <p className="text-gray-600">{feature.description}</p>
                </MagicCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════ */}
      {/* AGENTS & ECOSYSTEM (HOW IT WORKS) */}
      {/* ══════════════════════════════════════════ */}
      <section id="ecosystem" className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="inline-flex items-center gap-2 bg-purple-100 text-purple-600 text-sm font-semibold px-4 py-1.5 rounded-full mb-4">
              <Bot className="w-4 h-4" /> Part 2: The Agents
            </span>
            <h2 className="text-4xl md:text-5xl font-extrabold text-gray-800 mb-4">
              Run Locally. Deploy Globally.
            </h2>
            <p className="text-gray-500 max-w-2xl mx-auto text-lg">
              Your website is only half the battle. Use the Zygoflow ecosystem
              to build autonomous agents that process orders, update your
              databases, and handle support.
            </p>
          </motion.div>

          {/* 3 Ecosystem Steps */}
          <div className="grid md:grid-cols-3 gap-8 mb-16">
            {ecosystemSteps.map((step, i) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.2, duration: 0.6 }}
                className="relative"
              >
                {i < ecosystemSteps.length - 1 && (
                  <div className="hidden md:block absolute top-8 left-full w-8 h-px bg-gray-200 z-10" />
                )}
                <div className="bg-gray-50 rounded-2xl p-7 h-full border border-gray-100 hover:border-pink-200 hover:shadow-lg transition-all duration-300">
                  <div
                    className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-r ${step.color} text-white mb-4`}
                  >
                    {step.icon}
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <span
                      className={`text-4xl font-black bg-gradient-to-r ${step.color} bg-clip-text text-transparent`}
                    >
                      {step.number}
                    </span>
                    <span className="text-xs font-semibold text-pink-500 border border-pink-200 px-2 py-0.5 rounded-full">
                      {step.tag}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-800 mb-3">
                    {step.title}
                  </h3>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Live Demo + Capabilities */}
          <div className="grid lg:grid-cols-2 gap-10 items-start mt-24">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <h3 className="text-2xl font-bold text-gray-800 mb-2">
                Watch a cloud pipeline run live
              </h3>
              <p className="text-gray-500 mb-6 text-sm">
                A webhook triggers the pipeline. Agents read your database,
                generate a Stripe link, and email the customer automatically.
              </p>
              <LivePipelineDemo />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <h3 className="text-2xl font-bold text-gray-800 mb-6">
                What happens in the cloud?
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {agentCaps.map((cap, i) => (
                  <motion.div
                    key={cap.title}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.08 }}
                    className="flex gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-pink-200 hover:bg-pink-50/30 transition-all duration-200"
                  >
                    <div className="flex-shrink-0 mt-0.5">{cap.icon}</div>
                    <div>
                      <div className="font-semibold text-gray-800 text-sm mb-1">
                        {cap.title}
                      </div>
                      <div className="text-gray-500 text-xs leading-relaxed">
                        {cap.desc}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════ */}
      {/* FINAL CTA */}
      {/* ══════════════════════════════════════════ */}
      <section className="relative py-24 bg-gradient-to-r from-pink-500 via-red-500 to-orange-500 overflow-hidden">
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)",
            backgroundSize: "50px 50px",
          }}
        />
        <motion.div
          animate={{ scale: [1, 1.3, 1] }}
          transition={{ duration: 8, repeat: Infinity }}
          className="absolute top-0 left-1/3 w-96 h-96 rounded-full bg-white/10 blur-3xl pointer-events-none"
        />

        <div className="container mx-auto text-center px-4 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-4">
              Stop Dreaming.
              <br />
              Start Building.
            </h2>
            <p className="text-white/80 text-xl mb-10 max-w-lg mx-auto">
              Your website. Your agents. Your database. Build it once — let
              Zygoflow run it forever.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <SpecialButton text="Launch Web App" />
              <a
                href="#download"
                className="flex items-center gap-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm border border-white/30 text-white font-semibold px-6 py-3 rounded-full transition-all duration-200"
              >
                <Terminal className="w-4 h-4" />
                Optional: Get Desktop Agents
              </a>
            </div>
          </motion.div>
        </div>
      </section>
    </>
  );
}
