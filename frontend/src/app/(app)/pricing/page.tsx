"use client";

import React from "react";
import { motion } from "framer-motion";
import Typewriter from "typewriter-effect";
import AccordionCard from "@/components/Accordion";
import { CheckCircle, Globe, Bot, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function PricingPage() {
  const faqs = [
    {
      question: "Are the desktop agents really free?",
      answer:
        "Yes! You can download the Zygoflow Desktop app and build completely unrestricted agent pipelines on your local machine. They don't even have to be related to your website—you can build any automation you want.",
    },
    {
      question: "What happens after my 50 free cloud runs?",
      answer:
        "Your agents will pause until the next month, or you can upgrade to the Unlimited Agents plan for $20/month to keep your webhooks and scheduled tasks running 24/7 without limits.",
    },
    {
      question: "Do I pay extra for the AI generation?",
      answer:
        "You simply connect your own OpenAI API key. This means you pay base wholesale rates directly to OpenAI for the exact tokens you use, with zero markup or hidden fees from us.",
    },
    {
      question: "Do I need both plans?",
      answer:
        "Nope! They are completely modular. You can buy the Website Builder to just host a site, or just use the Agents to automate your Telegram/Stripe workflows. But combining them gives you the ultimate superpower.",
    },
  ];

  return (
    <div className="bg-white min-h-screen">
      {/* ══════════════════════════════════════════ */}
      {/* HERO SECTION */}
      {/* ══════════════════════════════════════════ */}
      <section className="relative pt-24 pb-16 bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 mix-blend-overlay"></div>
        <div className="container mx-auto px-4 relative z-10 text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-4xl md:text-6xl font-extrabold mb-4 tracking-tight"
          >
            Simple, Straightforward Pricing
          </motion.h1>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.8 }}
            className="text-xl md:text-2xl text-gray-300 font-medium max-w-2xl mx-auto h-12"
          >
            <Typewriter
              onInit={(tw) =>
                tw
                  .typeString("Pick the tools you need.")
                  .pauseFor(1000)
                  .deleteAll()
                  .typeString("Scale your business on autopilot.")
                  .start()
              }
              options={{ loop: true, delay: 50, deleteSpeed: 30 }}
            />
          </motion.div>
        </div>
      </section>

      {/* ══════════════════════════════════════════ */}
      {/* PRICING CARDS */}
      {/* ══════════════════════════════════════════ */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="grid md:grid-cols-2 gap-8 items-stretch">
            {/* ── CARD 1: WEBSITE BUILDER ── */}
            <div className="bg-white rounded-3xl p-8 border border-gray-200 shadow-xl flex flex-col relative overflow-hidden transition-transform duration-300 hover:-translate-y-2">
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-pink-500 to-red-500"></div>

              <div className="flex items-center gap-3 mb-6">
                <div className="bg-pink-100 p-3 rounded-xl text-pink-600">
                  <Globe className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">
                  AI Website Builder
                </h2>
              </div>

              <div className="mb-6">
                <span className="text-5xl font-black text-gray-900">$20</span>
                <span className="text-gray-500 font-medium"> / month</span>
              </div>

              <p className="text-gray-600 mb-8 h-12">
                Everything you need to generate, host, and manage a full-stack
                website with a database.
              </p>

              <ul className="space-y-4 mb-10 flex-grow">
                {[
                  "Unlimited AI UI Generation",
                  "Integrated Database & CMS",
                  "1-Click Stripe E-commerce",
                  "Custom Domain Hosting",
                  "Zero setup or coding required",
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-gray-700">
                    <CheckCircle className="w-5 h-5 text-pink-500 flex-shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <Link href="/login" className="w-full">
                <button className="w-full bg-gray-900 hover:bg-black text-white font-bold py-4 rounded-xl transition-colors flex items-center justify-center gap-2 group">
                  Launch Web App
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </Link>
            </div>

            {/* ── CARD 2: ZYGOFLOW AGENTS ── */}
            <div className="bg-gradient-to-b from-purple-50 to-white rounded-3xl p-8 border border-purple-200 shadow-xl flex flex-col relative overflow-hidden transition-transform duration-300 hover:-translate-y-2">
              <div className="absolute top-0 right-0 bg-purple-600 text-white text-xs font-bold px-4 py-1.5 rounded-bl-xl">
                Most Powerful
              </div>

              <div className="flex items-center gap-3 mb-6">
                <div className="bg-purple-100 p-3 rounded-xl text-purple-600">
                  <Bot className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">
                  Autonomous Agents
                </h2>
              </div>

              <div className="mb-6">
                <span className="text-5xl font-black text-purple-600">
                  Free
                </span>
                <span className="text-gray-500 font-medium"> to start</span>
              </div>

              <p className="text-gray-600 mb-8 h-12">
                Build anything locally for free. Upgrade to run unlimited
                webhooks 24/7 in the cloud.
              </p>

              <ul className="space-y-4 mb-10 flex-grow">
                <li className="flex items-start gap-3 text-gray-900 font-semibold">
                  <CheckCircle className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                  <span>Local Desktop App (Build Anything)</span>
                </li>
                <li className="flex items-start gap-3 text-gray-700">
                  <CheckCircle className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                  <span>50 Free Cloud Runs / month</span>
                </li>
                <li className="flex items-start gap-3 text-gray-700">
                  <CheckCircle className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                  <span>Unlimited Cloud Runs for $20/mo</span>
                </li>
                <li className="flex items-start gap-3 text-gray-700">
                  <CheckCircle className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                  <span>Stripe, Telegram & Webhook Triggers</span>
                </li>
              </ul>

              <Link href="/agents/login" className="w-full">
                <button className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 rounded-xl transition-colors flex items-center justify-center gap-2 group shadow-lg shadow-purple-200">
                  Get Desktop Agents
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════ */}
      {/* FAQS */}
      {/* ══════════════════════════════════════════ */}
      <section className="py-20 bg-gray-900 text-white">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Pricing FAQs</h2>
            <p className="text-gray-400">
              Everything you need to know about how Zygoflow billing works.
            </p>
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
