"use client";

import React from "react";
import { motion } from "framer-motion";
import Typewriter from "typewriter-effect";
import SpecialButton from "@/components/specialButton";
import MagicCard from "@/components/magicCard";
import { Bot, Database, Feather, ShoppingCart } from "lucide-react";

// Feature data for the "What You Can Build" section
const features = [
  {
    icon: <Feather className="w-8 h-8 mb-4 text-pink-500" />,
    title: "AI Elements & Pages",
    description:
      "Describe any component or a full page layout. Watch our AI bring it to life in seconds, from galleries to contact forms.",
  },
  {
    icon: <Database className="w-8 h-8 mb-4 text-green-500" />,
    title: "Database-Powered Apps",
    description:
      "Generate and refine full CRUD applications. Build directories, listings, or member portals with no backend code required.",
  },
  {
    icon: <ShoppingCart className="w-8 h-8 mb-4 text-red-500" />,
    title: "One-Click E-commerce",
    description:
      "Instantly turn items into sellable products. Our AI configures everything you need to start making sales immediately.",
  },
  {
    icon: <Bot className="w-8 h-8 mb-4 text-blue-500" />,
    title: "Automated Chatbots",
    description:
      "Let the AI automatically build a chatbot from your content, ready to answer questions and assist your visitors 24/7.",
  },
];

export default function MainPage() {
  return (
    <>
      {/* ========================= */}
      {/* Hero Section */}
      {/* ========================= */}
      <main className="min-h-[calc(90vh-64px)] flex flex-col items-center justify-center text-center bg-gradient-to-r from-pink-500 to-red-500 text-white px-4 overflow-hidden">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-4xl md:text-6xl font-extrabold mb-4"
        >
          Your Idea, Instantly Real
        </motion.h1>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="text-lg md:text-2xl h-16 md:h-8"
        >
          <Typewriter
            options={{
              strings: [
                "Build AI elements from a prompt.",
                "Generate database-connected apps.",
                "Create entire pages in seconds.",
                "Sell products with one click.",
              ],
              autoStart: true,
              loop: true,
              delay: 50,
              deleteSpeed: 30,
            }}
          />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1, duration: 0.5 }}
          className="mt-10"
        >
          <SpecialButton />
        </motion.div>
      </main>

      {/* ========================= */}
      {/* What You Can Build Section */}
      {/* ========================= */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4 text-center">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-4xl font-bold mb-12 text-gray-800"
          >
            What Will You Build?
          </motion.h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.2, duration: 0.6 }}
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

      {/* ========================= */}
      {/* How It Works Section */}
      {/* ========================= */}
      <section className="py-20 bg-white">
        <div className="container mx-auto text-center px-4">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-4xl font-bold mb-16 text-gray-800"
          >
            A Simple, Powerful Workflow
          </motion.h2>

          <div className="grid md:grid-cols-3 gap-12 items-start">
            {/* Step 1 */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="text-center"
            >
              <div className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-pink-500 mb-4">
                01
              </div>
              <h3 className="text-2xl font-bold mb-2 text-gray-800">
                Describe
              </h3>
              <p className="text-gray-600">
                Start with a simple prompt. Describe the element, section, or
                even a full data application you want to create.
              </p>
            </motion.div>

            {/* Step 2 */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="text-center"
            >
              <div className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-red-500 mb-4">
                02
              </div>
              <h3 className="text-2xl font-bold mb-2 text-gray-800">
                Generate & Refine
              </h3>
              <p className="text-gray-600">
                Our AI builds your component instantly. Don't like something?
                Just ask for a change and refine it to perfection.
              </p>
            </motion.div>

            {/* Step 3 */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.6, duration: 0.6 }}
              className="text-center"
            >
              <div className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-yellow-500 mb-4">
                03
              </div>
              <h3 className="text-2xl font-bold mb-2 text-gray-800">Launch</h3>
              <p className="text-gray-600">
                Your creation is ready. Launch your new site, app, or chatbot
                with a single click.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ========================= */}
      {/* Final CTA Section */}
      {/* ========================= */}
      <section className="py-20 bg-gradient-to-r from-green-400 via-teal-400 to-blue-500">
        <div className="container mx-auto text-center px-4">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-3xl md:text-4xl font-bold text-white mb-8"
          >
            Stop Dreaming. Start Building.
          </motion.h2>
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4, duration: 0.5 }}
          >
            <SpecialButton />
          </motion.div>
        </div>
      </section>
    </>
  );
}
