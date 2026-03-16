"use client";

import React from "react";
import { motion } from "framer-motion";
import Typewriter from "typewriter-effect";
import AccordionCard from "@/components/Accordion";
import {
  Globe,
  Bot,
  Database,
  ShoppingCart,
  Terminal,
  Zap,
  CheckCircle,
  CloudLightning,
} from "lucide-react";

export default function PricingPage() {
  const faqs = [
    {
      question: "Is this another complicated, node-based builder?",
      answer:
        "Absolutely not! No connecting nodes, no complex setup. Just describe what you want, and our AI builds the frontend and database for you.",
    },
    {
      question: "How do the pay-as-you-go credits work?",
      answer:
        "You only pay for what you use. The core builder is free. When you ask the AI to generate a page or when your Agents run tasks in the cloud, it deducts a tiny fraction of a credit. You can top up anytime.",
    },
    {
      question: "Can I test my agents before paying?",
      answer:
        "Yes! You can download the Zygoflow Desktop app to build and test your agent pipelines locally on your machine for completely free.",
    },
    {
      question: "Do I need my own OpenAI or Stripe keys?",
      answer:
        "Yes, you connect your own API keys. This means Zygoflow doesn't upcharge you on OpenAI usage or take hidden cuts from your Stripe payments. You keep 100% of your revenue.",
    },
  ];

  return (
    <div className="bg-white">
      {/* ══════════════════════════════════════════ */}
      {/* HERO SECTION */}
      {/* ══════════════════════════════════════════ */}
      <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-28 bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 mix-blend-overlay"></div>
        <div className="container mx-auto px-4 relative z-10 text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-5xl md:text-7xl font-extrabold mb-6 tracking-tight"
          >
            One Platform. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-orange-400">
              Infinite Possibilities.
            </span>
          </motion.h1>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.8 }}
            className="text-xl md:text-2xl text-gray-300 font-medium max-w-2xl mx-auto h-16"
          >
            <Typewriter
              onInit={(tw) =>
                tw
                  .typeString("Build AI websites for free.")
                  .pauseFor(1000)
                  .deleteAll()
                  .typeString("Deploy autonomous agents instantly.")
                  .pauseFor(1000)
                  .deleteAll()
                  .typeString("Pay only for the AI power you use.")
                  .start()
              }
              options={{ loop: true, delay: 50, deleteSpeed: 30 }}
            />
          </motion.div>
        </div>
      </section>

      {/* ══════════════════════════════════════════ */}
      {/* PILLAR 1: THE WEBSITE BUILDER */}
      {/* ══════════════════════════════════════════ */}
      <section className="py-24 bg-white border-b border-gray-100">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-100 text-pink-600 font-semibold text-sm mb-6">
                <Globe className="w-4 h-4" /> Pillar 1
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
                The AI Website Builder
              </h2>
              <p className="text-lg text-gray-600 mb-8 leading-relaxed">
                Stop fighting with drag-and-drop templates. Describe what you
                want, and Zygoflow generates the UI, connects the database, and
                sets up your products instantly.
              </p>

              <div className="space-y-6">
                {[
                  {
                    icon: <Database className="text-pink-500" />,
                    title: "Auto-Provisioned Databases",
                    desc: "Every site comes with an instant, ready-to-use database. No backend setup required.",
                  },
                  {
                    icon: <ShoppingCart className="text-orange-500" />,
                    title: "1-Click E-commerce",
                    desc: "Turn any database item into a sellable product connected straight to your Stripe.",
                  },
                ].map((feature, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="mt-1 bg-gray-50 p-3 rounded-lg border border-gray-100 h-max">
                      {feature.icon}
                    </div>
                    <div>
                      <h4 className="text-xl font-bold text-gray-900">
                        {feature.title}
                      </h4>
                      <p className="text-gray-600 mt-1">{feature.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="bg-gray-50 rounded-2xl p-8 border border-gray-200 shadow-xl relative"
            >
              {/* Fake UI mockup of the builder */}
              <div className="w-full h-8 bg-gray-200 rounded-t-lg mb-4 flex items-center px-3 gap-2">
                <div className="w-3 h-3 rounded-full bg-red-400"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                <div className="w-3 h-3 rounded-full bg-green-400"></div>
              </div>
              <div className="space-y-4">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                <div className="h-32 bg-pink-100 rounded-lg border border-pink-200 flex items-center justify-center text-pink-500 font-mono text-sm">
                  Generating AI layout...
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════ */}
      {/* PILLAR 2: AUTONOMOUS AGENTS */}
      {/* ══════════════════════════════════════════ */}
      <section className="py-24 bg-gray-50 border-b border-gray-200">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-16 items-center flex-col-reverse lg:flex-row-reverse">
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-100 text-purple-600 font-semibold text-sm mb-6">
                <Bot className="w-4 h-4" /> Pillar 2
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
                Autonomous AI Agents
              </h2>
              <p className="text-lg text-gray-600 mb-8 leading-relaxed">
                Build a digital workforce. Zygoflow agents can read your
                database, reply to Telegram messages, process Stripe webhooks,
                and send emails while you sleep.
              </p>

              <div className="space-y-6">
                {[
                  {
                    icon: <Zap className="text-yellow-500" />,
                    title: "Write APIs with a Prompt",
                    desc: "Just describe the workflow. Zygoflow instantly writes the logic and gives you a live Webhook URL to use anywhere.",
                  },
                  {
                    icon: <CloudLightning className="text-purple-500" />,
                    title: "Deploy to ZygoCloud",
                    desc: "Build locally for free. Push to the cloud with one click to run 24/7 on schedules or webhooks.",
                  },
                ].map((feature, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="mt-1 bg-white p-3 rounded-lg border border-gray-100 h-max shadow-sm">
                      {feature.icon}
                    </div>
                    <div>
                      <h4 className="text-xl font-bold text-gray-900">
                        {feature.title}
                      </h4>
                      <p className="text-gray-600 mt-1">{feature.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="bg-gray-900 rounded-2xl p-6 border border-gray-700 shadow-2xl text-left font-mono text-sm"
            >
              <div className="flex gap-2 mb-4">
                <Terminal className="text-gray-400 w-5 h-5" />
                <span className="text-gray-400">zygo-cloud-terminal</span>
              </div>
              <div className="space-y-2">
                <p className="text-green-400">
                  ▶ Webhook caught: Stripe Payment
                </p>
                <p className="text-blue-400">
                  ▶ Agent: Updating Database Inventory...
                </p>
                <p className="text-purple-400">
                  ▶ Agent: Generating email receipt...
                </p>
                <p className="text-gray-300">
                  📤 Email sent successfully via SendGrid.
                </p>
                <p className="text-green-400 font-bold mt-4">
                  ✅ Pipeline execution complete.
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════ */}
      {/* PRICING (PAY AS YOU GO) */}
      {/* ══════════════════════════════════════════ */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-xl text-gray-500 mb-12">
            No massive monthly subscriptions. Top up when you need it.
          </p>

          <div className="grid md:grid-cols-2 gap-8 text-left">
            {/* Free Tier */}
            <div className="bg-gray-50 rounded-2xl p-8 border border-gray-200">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                The Platform
              </h3>
              <div className="text-4xl font-black text-gray-900 mb-6">Free</div>
              <ul className="space-y-3 mb-8">
                {[
                  "Host your Website",
                  "Access to CMS / Database",
                  "Stripe E-commerce Setup",
                  "Test Agents Locally on Desktop",
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-gray-700">
                    <CheckCircle className="w-5 h-5 text-green-500" /> {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Credit Tier */}
            <div className="bg-gradient-to-br from-pink-50 to-orange-50 rounded-2xl p-8 border border-pink-200 shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-pink-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
                Pay As You Go
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                AI & Cloud Power
              </h3>
              <div className="text-4xl font-black text-pink-600 mb-6">
                Credits
              </div>
              <ul className="space-y-3 mb-8">
                {[
                  "Generate AI UI & Layouts",
                  "Deploy Agents to ZygoCloud",
                  "Execute Webhooks 24/7",
                  "Run Scheduled Tasks",
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-gray-800">
                    <CheckCircle className="w-5 h-5 text-pink-500" /> {item}
                  </li>
                ))}
              </ul>
              <div className="bg-white/60 p-4 rounded-xl text-sm text-gray-700 border border-pink-100">
                Top up with $5, $10, or $20 whenever you need more AI power.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════ */}
      {/* FAQS */}
      {/* ══════════════════════════════════════════ */}
      <section className="py-24 bg-gray-900 text-white">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">Got Questions?</h2>
          </div>
          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <AccordionCard
                key={index}
                question={faq.question}
                answer={faq.answer}
              />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
