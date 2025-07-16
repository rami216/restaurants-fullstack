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
          As we are simple and straightforward
        </motion.h1>

        {/* 3) Finally, type out the subtitle */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.5 }}
          className="text-lg md:text-2xl"
        >
          <Typewriter
            onInit={(tw) => tw.typeString("We only have one pricing!").start()}
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
          <PricingCard
            theme="unlimited restaurant locations"
            about="just one plan"
            price="20/month"
            options={[
              "add menuitems",
              "add extras",
              "add options",
              "add schedule",
            ]}
          />
        </div>
      </section>
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto flex justify-center">
          <div className="bg-gradient-to-r from-pink-500 to-red-500 text-white rounded-lg shadow-lg p-8 w-full max-w-2xl">
            <h2 className="text-3xl font-bold mb-6">Pricing FAQs</h2>
            <AccordionCard
              question="Do I need to create those apis,etc....?"
              answer="NO!"
            />
            <AccordionCard
              question="which ai model are you using?"
              answer="open ai's model api"
            />
            <AccordionCard
              question="i will only pay 20$ per month?"
              answer="no, you need to add amount of funds(as you which) so you will use the open ai api"
            />
            <AccordionCard
              question="how much i need to add funds"
              answer="as you which, but we recommend 10$ for starter(if you have not a lot of orders"
            />
            <AccordionCard
              question="Is there a free trial available?"
              answer="Yes, we offer a free trial for new users, but you need to add funds so you can use the ai model"
            />
          </div>
        </div>
      </section>
    </>
  );
}
