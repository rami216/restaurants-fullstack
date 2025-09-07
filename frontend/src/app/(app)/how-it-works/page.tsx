// app/pricing/page.tsx
"use client";

import React from "react";
import { motion } from "framer-motion";
import Typewriter from "typewriter-effect";
import AccordionCard from "@/components/Accordion";

export default function PricingPage() {
  const features = [
    {
      question: "Is this another complicated, node-based builder?",
      answer:
        "Absolutely not! There is no coding, no connecting nodes, and no complex setup. Just describe what you want, and our AI builds it for you.",
    },
    {
      question: "How does the AI website builder work?",
      answer:
        "You can generate anything from a single button to a full data-driven application just by describing it. Use simple prompts to refine styles, change layouts, or add new features on the fly.",
    },
    {
      question: "How do I sell products?",
      answer:
        "Simply create an item on your site and enable it as a product with a single click. We handle the rest to make it instantly available for purchase.",
    },
    {
      question: "How is the chatbot created and how does it work?",
      answer:
        "The chatbot is built automatically from your website's content and menu items. When a customer places an order via chat, you receive it by email with a direct WhatsApp link to confirm with them. The order details are pre-filled in the message!",
    },
    {
      question: "Can I use this for free?",
      answer:
        "Yes! The core website builder is free to use. The AI generation features and chatbot usage are pay-as-you-go. Simply top up your account with credits (e.g., $1, $2, or more) and use them as needed.",
    },
    {
      question: "How does it handle multiple locations?",
      answer:
        "Easily. Just add your new locations and their specific menus. The chatbot and website will automatically handle the rest, with no need to create separate sites or bots.",
    },
  ];

  return (
    <>
      <main className="h-[calc(90vh-64px)] flex flex-col items-center justify-center bg-gradient-to-r from-pink-500 to-red-500 text-white px-4">
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-3xl md:text-5xl font-extrabold mb-2"
        >
          Powerful, Not Complicated
        </motion.h1>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.5 }}
          className="text-lg md:text-2xl"
        >
          <Typewriter
            onInit={(tw) =>
              tw
                .typeString("The simplicity you want. The power you need.")
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
        <div className="container mx-auto flex justify-center px-4">
          <div className="bg-gradient-to-r from-pink-500 to-red-500 text-white rounded-lg shadow-lg p-8 w-full max-w-3xl">
            <h2 className="text-3xl font-bold mb-6 text-center">
              Frequently Asked Questions
            </h2>
            {features.map((feature, index) => (
              <AccordionCard
                key={index}
                question={feature.question}
                answer={feature.answer}
              />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
