"use client";

import React, { useState } from "react";

export default function AccordionCard({
  question,
  answer,
}: {
  question: string;
  answer: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border border-gray-300 rounded p-4 w-full max-w-md mx-auto bg-white">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full text-left flex justify-between items-center font-semibold text-lg text-gray-800"
      >
        <span>{question}?</span>
        <span className="text-gray-500">{isOpen ? "▲" : "▼"}</span>
      </button>
      {isOpen && <p className="mt-2 text-gray-600">{answer}.</p>}
    </div>
  );
}
