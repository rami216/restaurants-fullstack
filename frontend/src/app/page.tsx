// app/page.tsx
"use client";

import React from "react";
import NavBar from "@/components/NavBar";
import { motion } from "framer-motion";
import Typewriter from "typewriter-effect";
import SpecialButton from "@/components/specialButton";
import MagicCard from "@/components/magicCard";
export default function MainPage() {
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
          Super simple chatbot
        </motion.h1>

        {/* 2) After a short delay, fade in “for your restaurant” */}
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1, duration: 0.8 }}
          className="text-3xl md:text-5xl font-extrabold mb-6"
        >
          for your restaurant
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
                  "Let your guests chat and order with your menu instantly."
                )
                .start()
            }
            options={{
              cursor: "", // no cursor
              delay: 40, // adjust for typing speed
            }}
          />
        </motion.div>
        <div className="mt-8">
          <SpecialButton />
        </div>
      </main>
      {/* Why choose us section */}
      {/* ========================= */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto grid gap-8 md:grid-cols-2 items-center">
          {/* Left: Heading */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="text-3xl font-bold mb-4">Why choose us</h2>
            <p className="text-gray-700">
              We make it effortless to add conversational AI to your restaurant.
            </p>
          </motion.div>

          {/* Right: Animated gradient container */}
          <MagicCard />
        </div>

        {/* Bottom note */}
        <motion.div
          className="mt-12 text-center"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 1, duration: 0.8 }}
        >
          <p className="text-lg text-gray-600">
            No website needed—your chatbot link is ready instantly.
          </p>
        </motion.div>
      </section>
      {/* How it works section */}
      {/* ========================= */}
      <section className="py-16 bg-white">
        <div className="container mx-auto text-center">
          {/* Animated heading */}
          <motion.h2
            initial={{ opacity: 0, y: -20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-4xl font-bold mb-6"
          >
            How it works
          </motion.h2>

          {/* Animated gradient container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5, duration: 0.8 }}
            className="mx-auto mt-8 max-w-2xl p-8 bg-gradient-to-r from-green-400 via-teal-400 to-blue-500 rounded-2xl"
          >
            <p className="text-white text-lg md:text-xl">
              In just a few clicks, spin up a single chatbot that serves all
              your restaurant locations—no extra setup needed for each branch!
            </p>
          </motion.div>
        </div>
      </section>
    </>
  );
}
