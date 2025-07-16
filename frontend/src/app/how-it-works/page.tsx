// app/page.tsx
"use client";

import React from "react";
import { motion } from "framer-motion";
import Typewriter from "typewriter-effect";
import SpecialButton from "@/components/specialButton";
import PricingCard from "@/components/pricing";
import AccordionCard from "@/components/Accordion";
export default function PricingPage() {
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
          Babe, we are simple
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
                .typeString("no nodes,no coding,no api's,just type your menu!")
                .start()
            }
            options={{
              cursor: "",
              delay: 40,
            }}
          />
        </motion.div>
      </main>

      <section className="py-16 bg-gray-50">
        <div className="container mx-auto flex justify-center">
          <div className="bg-gradient-to-r from-pink-500 to-red-500 text-white rounded-lg shadow-lg p-8 w-full max-w-2xl">
            <h2 className="text-3xl font-bold mb-6">How it works</h2>
            <AccordionCard
              question="is there some nodes,coding,connecting things!!"
              answer="NO!"
            />
            <AccordionCard
              question="how to receive the order?"
              answer="via email"
            />
            <AccordionCard
              question="and when i receive the oder via email, then?"
              answer="you will have a whatsapp link, where when clicked, it will redirect you to the clients whatsapp"
            />
            <AccordionCard
              question="do i need to retype the order for the client when i click on the whatsapp link"
              answer="No, the order will be prefilled for you in the chat"
            />
            <AccordionCard
              question="if i have multiple locations, do i need to create another chatbot?"
              answer="No, you add the new location, its menus and schedules, and you are ready"
            />
            <AccordionCard
              question="how it will be created, how can i used it"
              answer="when you add your menu, schedule,etc... you will have a link, by clicking on it, it will redirect you to a chat webpage where you can test it, use it"
            />
            <AccordionCard
              question="where do i put it?"
              answer="you can put it everywhere, on instagram, tiktok, whenever you want"
            />
          </div>
        </div>
      </section>
    </>
  );
}
