// app/page.tsx
"use client";

import React from "react";
import { motion } from "framer-motion";
import Typewriter from "typewriter-effect";
import AccordionCard from "@/components/Accordion";
export default function AskPage() {
  return (
    <>
      <main className="h-[calc(90vh-64px)] flex flex-col items-center justify-center bg-gradient-to-r from-pink-500 to-red-500 text-white px-4">
        {/* 1) Fade in “Super simple chatbot” */}
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-3xl md:text-5xl font-extrabold mb-2"
        >
          Connect with us
        </motion.h1>

        {/* 3) Finally, type out the subtitle */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.5 }}
          className="text-lg md:text-2xl"
        >
          <Typewriter
            onInit={(tw) =>
              tw
                .typeString(
                  "Feel free to reach out, and our dedicated team will respond to your inquiries promptly."
                )
                .start()
            }
            options={{
              cursor: "",
              delay: 40,
            }}
          />
        </motion.div>
      </main>
      {/* pricing section */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto flex justify-center">
          <div className="bg-gradient-to-r from-pink-500 to-red-500 text-white rounded-lg shadow-lg p-8 w-full max-w-2xl">
            <h2 className="text-3xl font-bold mb-6">Ask Us</h2>

            <form className="space-y-4">
              <div>
                <label className="block mb-1 text-white font-medium">
                  Name
                </label>
                <input
                  type="text"
                  className="w-full rounded px-3 py-2 bg-white text-gray-800 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-white"
                  placeholder="Your name"
                />
              </div>

              <div>
                <label className="block mb-1 text-white font-medium">
                  Email <span className="text-red-300">*</span>
                </label>
                <input
                  type="email"
                  required
                  className="w-full rounded px-3 py-2 bg-white text-gray-800 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-white"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label className="block mb-1 text-white font-medium">
                  Phone Number
                </label>
                <input
                  type="tel"
                  className="w-full rounded px-3 py-2 bg-white text-gray-800 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-white"
                  placeholder="+1 234 567 890"
                />
              </div>

              <div>
                <label className="block mb-1 text-white font-medium">
                  Business Name
                </label>
                <input
                  type="text"
                  className="w-full rounded px-3 py-2 bg-white text-gray-800 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-white"
                  placeholder="Your business name"
                />
              </div>

              <div>
                <label className="block mb-1 text-white font-medium">
                  Message
                </label>
                <textarea
                  rows={4}
                  className="w-full rounded px-3 py-2 bg-white text-gray-800 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-white"
                  placeholder="Your message..."
                ></textarea>
              </div>

              <button
                type="submit"
                className="mt-4 w-full bg-white text-pink-600 font-bold py-2 rounded hover:bg-pink-100 transition-colors"
              >
                Send Message
              </button>
            </form>
          </div>
        </div>
      </section>
    </>
  );
}
