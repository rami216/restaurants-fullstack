// "use client";

// import React, { useState, useRef, useEffect } from "react";
// import ReactMarkdown from "react-markdown";
// import api from "@/lib/axios";
// import { useSubscription } from "@/context/SubscriptionContext";
// import Link from "next/link";

// // --- Types ---
// type Message = {
//   id: string;
//   role: "user" | "ai";
//   content: string;
// };

// export default function ArchitectChat() {
//   const { subscriptionStatus } = useSubscription();
//   const isSubscribed = subscriptionStatus === "active";

//   const [messages, setMessages] = useState<Message[]>([]);
//   const [input, setInput] = useState("");
//   const [isLoading, setIsLoading] = useState(false);
//   const [currentWebsiteId, setCurrentWebsiteId] = useState<string | null>(null);
//   const messagesEndRef = useRef<HTMLDivElement>(null);

//   useEffect(() => {
//     const fetchWebsiteId = async () => {
//       try {
//         const res = await api.get("/builder/my-website-id");
//         if (res.data?.website_id) {
//           setCurrentWebsiteId(res.data.website_id);
//         }
//       } catch (err) {
//         console.error("Architect: Failed to load context", err);
//       }
//     };
//     fetchWebsiteId();
//   }, []);

//   const scrollToBottom = () => {
//     messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
//   };
//   useEffect(() => {
//     scrollToBottom();
//   }, [messages, isLoading]);

//   // ✅ New: Clear chat function to reset memory
//   const clearChat = () => {
//     if (
//       confirm(
//         "Start a new blueprint? This will clear the current conversation.",
//       )
//     ) {
//       setMessages([]);
//       setInput("");
//     }
//   };

//   const handleSend = async () => {
//     if (!isSubscribed) return;
//     if (!input.trim() || isLoading || !currentWebsiteId) return;

//     const userText = input.trim();

//     // ✅ 1. CAPTURE HISTORY BEFORE UPDATING STATE
//     const historyToSend = messages.map((m) => ({
//       role: m.role,
//       content: m.content,
//     }));

//     setInput("");

//     // ✅ 2. UPDATE UI (Added once, cleaned up duplicate from your snippet)
//     const newUserMsg: Message = {
//       id: Date.now().toString(),
//       role: "user",
//       content: userText,
//     };
//     setMessages((prev) => [...prev, newUserMsg]);
//     setIsLoading(true);

//     try {
//       // ✅ 3. CALL API WITH HISTORY
//       const res = await api.post("/ai/generate-architect-blueprint", {
//         idea: userText,
//         history: historyToSend,
//         website_id: currentWebsiteId,
//       });

//       const newAiMsg: Message = {
//         id: (Date.now() + 1).toString(),
//         role: "ai",
//         content:
//           res.data.result || "I couldn't generate a blueprint. Try again!",
//       };
//       setMessages((prev) => [...prev, newAiMsg]);
//     } catch (error) {
//       console.error("Architect Error:", error);
//       setMessages((prev) => [
//         ...prev,
//         {
//           id: "error",
//           role: "ai",
//           content:
//             "⚠️ **System Error:** I'm having trouble connecting to my brain. Check your AI usage limits.",
//         },
//       ]);
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const handleKeyDown = (e: React.KeyboardEvent) => {
//     if (e.key === "Enter" && !e.shiftKey) {
//       e.preventDefault();
//       handleSend();
//     }
//   };

//   const quickPrompts = [
//     "A medical clinic with doctor schedules and patient booking",
//     "An inventory manager with barcode fields and low-stock alerts",
//     "A real estate portal with property galleries and lead forms",
//   ];

//   return (
//     <div className="relative flex flex-col h-[calc(100vh-4rem)] bg-[#F9FAFB] font-sans">
//       {/* 🔒 SUBSCRIPTION OVERLAY */}
//       {!isSubscribed && (
//         <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/40 backdrop-blur-md p-6">
//           <div className="max-w-md w-full bg-white border border-gray-200 rounded-[2.5rem] p-10 shadow-2xl text-center animate-in fade-in zoom-in duration-300">
//             <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-8 ring-8 ring-blue-50/50">
//               <svg
//                 className="w-10 h-10"
//                 fill="none"
//                 stroke="currentColor"
//                 viewBox="0 0 24 24"
//               >
//                 <path
//                   strokeLinecap="round"
//                   strokeLinejoin="round"
//                   strokeWidth={2}
//                   d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
//                 />
//               </svg>
//             </div>
//             <h2 className="text-3xl font-extrabold text-gray-900 mb-3 tracking-tight">
//               Architect Pro
//             </h2>
//             <p className="text-gray-500 mb-10 text-lg leading-relaxed">
//               Unlock our AI CTO to generate professional database schemas and
//               copy-paste prompts.
//             </p>
//             <Link
//               href="/billingPage"
//               className="block w-full bg-blue-600 text-white font-bold py-5 rounded-2xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-200 active:scale-[0.98]"
//             >
//               Upgrade to Unlock
//             </Link>
//           </div>
//         </div>
//       )}

//       {/* --- HEADER --- */}
//       <header className="bg-white border-b border-gray-200 px-8 py-5 flex items-center justify-between shadow-sm shrink-0">
//         <div>
//           <div className="flex items-center gap-3">
//             <div className="bg-blue-600 text-white p-1.5 rounded-lg shadow-inner">
//               <svg
//                 className="w-5 h-5"
//                 fill="none"
//                 stroke="currentColor"
//                 viewBox="0 0 24 24"
//               >
//                 <path
//                   strokeLinecap="round"
//                   strokeLinejoin="round"
//                   strokeWidth={2.5}
//                   d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
//                 />
//               </svg>
//             </div>
//             <h1 className="text-xl font-black text-gray-900 tracking-tight uppercase">
//               Architect
//             </h1>
//           </div>
//           <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1 ml-10">
//             Zygoflow Senior Blueprint Engine
//           </p>
//         </div>

//         <div className="flex items-center gap-4">
//           {/* ✅ CLEAR CHAT BUTTON */}
//           {messages.length > 0 && (
//             <button
//               onClick={clearChat}
//               className="text-xs font-bold text-gray-400 hover:text-red-500 transition-colors uppercase tracking-tighter"
//             >
//               New Blueprint
//             </button>
//           )}
//           {currentWebsiteId && (
//             <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-full">
//               <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
//               <span className="text-[10px] font-black text-blue-700 uppercase tracking-tighter">
//                 Usage Tracking Active
//               </span>
//             </div>
//           )}
//         </div>
//       </header>

//       {/* --- CHAT DISPLAY --- */}
//       <div className="flex-1 overflow-y-auto px-4 py-10">
//         <div className="max-w-3xl mx-auto space-y-10">
//           {messages.length === 0 && (
//             <div className="py-12 text-center animate-in fade-in slide-in-from-bottom-8 duration-1000">
//               <h2 className="text-4xl font-black text-gray-900 mb-4 tracking-tighter leading-none">
//                 The smartest way to build.
//               </h2>
//               <p className="text-gray-500 mb-12 text-xl font-medium">
//                 I create the architecture. You just copy and paste.
//               </p>
//               <div className="grid grid-cols-1 md:grid-cols-3 gap-4 px-4">
//                 {quickPrompts.map((p, i) => (
//                   <button
//                     key={i}
//                     onClick={() => setInput(p)}
//                     className="p-5 bg-white border border-gray-200 rounded-2xl text-sm text-gray-600 font-semibold hover:border-blue-500 hover:shadow-xl transition-all text-left group"
//                   >
//                     <span className="text-blue-500 mb-2 block opacity-50 group-hover:opacity-100">
//                       Try this:
//                     </span>
//                     "{p}"
//                   </button>
//                 ))}
//               </div>
//             </div>
//           )}

//           {messages.map((msg) => (
//             <div
//               key={msg.id}
//               className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
//             >
//               <div
//                 className={`max-w-[95%] md:max-w-[85%] rounded-[2rem] px-7 py-5 shadow-sm ${msg.role === "user" ? "bg-gray-900 text-white rounded-br-none" : "bg-white border border-gray-200 text-gray-800 rounded-bl-none"}`}
//               >
//                 {msg.role === "user" ? (
//                   <p className="text-lg font-medium leading-relaxed">
//                     {msg.content}
//                   </p>
//                 ) : (
//                   <div
//                     className="prose prose-slate max-w-none
//                     prose-headings:text-gray-900 prose-headings:font-black prose-headings:tracking-tight
//                     prose-h3:text-xl prose-h3:border-b-2 prose-h3:border-blue-50 prose-h3:pb-2 prose-h3:mb-6
//                     prose-strong:text-blue-700 prose-strong:font-extrabold
//                     prose-code:text-blue-600 prose-code:bg-blue-50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:font-bold
//                     prose-pre:bg-gray-900 prose-pre:text-blue-100 prose-pre:border-0 prose-pre:p-6 prose-pre:rounded-3xl prose-pre:shadow-2xl"
//                   >
//                     <ReactMarkdown>{msg.content}</ReactMarkdown>
//                   </div>
//                 )}
//               </div>
//             </div>
//           ))}

//           {isLoading && (
//             <div className="flex justify-start">
//               <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm flex items-center gap-4">
//                 <div className="flex gap-1.5">
//                   <div className="w-2.5 h-2.5 bg-blue-600 rounded-full animate-bounce"></div>
//                   <div className="w-2.5 h-2.5 bg-blue-600 rounded-full animate-bounce [animation-delay:0.2s]"></div>
//                   <div className="w-2.5 h-2.5 bg-blue-600 rounded-full animate-bounce [animation-delay:0.4s]"></div>
//                 </div>
//                 <span className="text-xs font-black text-gray-400 uppercase tracking-widest">
//                   Architecting SaaS...
//                 </span>
//               </div>
//             </div>
//           )}
//           <div ref={messagesEndRef} />
//         </div>
//       </div>

//       {/* --- INPUT AREA --- */}
//       <div className="p-8 bg-white border-t border-gray-100 shrink-0">
//         <div className="max-w-3xl mx-auto relative">
//           <textarea
//             value={input}
//             onChange={(e) => setInput(e.target.value)}
//             onKeyDown={handleKeyDown}
//             placeholder="Describe your project..."
//             className="w-full bg-gray-50 border border-gray-200 rounded-[2rem] pl-6 pr-20 py-6 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:bg-white focus:border-blue-500 transition-all shadow-inner resize-none min-h-[90px] text-lg font-medium"
//           />
//           <button
//             onClick={handleSend}
//             disabled={!input.trim() || isLoading || !isSubscribed}
//             className="absolute right-4 bottom-4 w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-xl hover:bg-blue-700 hover:scale-105 active:scale-95 disabled:bg-gray-200 transition-all"
//           >
//             <svg
//               className="w-6 h-6"
//               fill="none"
//               stroke="currentColor"
//               viewBox="0 0 24 24"
//             >
//               <path
//                 strokeLinecap="round"
//                 strokeLinejoin="round"
//                 strokeWidth={3}
//                 d="M5 12h14M12 5l7 7-7 7"
//               />
//             </svg>
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// }
"use client";

import React, { useState, useEffect } from "react";
import api from "@/lib/axios";
import { useSubscription } from "@/context/SubscriptionContext";
import Link from "next/link";

export default function ArchitectChat() {
  const { subscriptionStatus } = useSubscription();
  const isSubscribed = subscriptionStatus === "active";

  const [currentWebsiteId, setCurrentWebsiteId] = useState<string | null>(null);

  useEffect(() => {
    const fetchWebsiteId = async () => {
      try {
        const res = await api.get("/builder/my-website-id");
        if (res.data?.website_id) {
          setCurrentWebsiteId(res.data.website_id);
        }
      } catch (err) {
        console.error("Architect: Failed to load context", err);
      }
    };
    fetchWebsiteId();
  }, []);

  return (
    <div className="relative flex flex-col h-[calc(100vh-4rem)] bg-[#F9FAFB] font-sans">
      {/* 🔒 SUBSCRIPTION OVERLAY */}
      {!isSubscribed && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/40 backdrop-blur-md p-6">
          <div className="max-w-md w-full bg-white border border-gray-200 rounded-[2.5rem] p-10 shadow-2xl text-center animate-in fade-in zoom-in duration-300">
            <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-8 ring-8 ring-blue-50/50">
              <svg
                className="w-10 h-10"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
            <h2 className="text-3xl font-extrabold text-gray-900 mb-3 tracking-tight">
              Architect Pro
            </h2>
            <p className="text-gray-500 mb-10 text-lg leading-relaxed">
              Unlock our AI CTO to generate professional database schemas and
              copy-paste prompts.
            </p>
            <Link
              href="/billingPage"
              className="block w-full bg-blue-600 text-white font-bold py-5 rounded-2xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-200 active:scale-[0.98]"
            >
              Upgrade to Unlock
            </Link>
          </div>
        </div>
      )}

      {/* --- HEADER --- */}
      <header className="bg-white border-b border-gray-200 px-8 py-5 flex items-center justify-between shadow-sm shrink-0">
        <div>
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 text-white p-1.5 rounded-lg shadow-inner">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
            </div>
            <h1 className="text-xl font-black text-gray-900 tracking-tight uppercase">
              Architect
            </h1>
          </div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1 ml-10">
            Zygoflow Senior Blueprint Engine
          </p>
        </div>

        <div className="flex items-center gap-4">
          {currentWebsiteId && (
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-full">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              <span className="text-[10px] font-black text-blue-700 uppercase tracking-tighter">
                Usage Tracking Active
              </span>
            </div>
          )}
        </div>
      </header>

      {/* --- COMING SOON DISPLAY --- */}
      <div className="flex-1 overflow-y-auto px-4 flex items-center justify-center">
        <div className="max-w-3xl mx-auto text-center animate-in fade-in zoom-in duration-700">
          <div className="inline-flex items-center justify-center p-4 bg-indigo-50 rounded-full mb-6">
            <svg
              className="w-12 h-12 text-indigo-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </div>
          <h2 className="text-5xl font-black text-gray-900 mb-6 tracking-tighter leading-tight">
            The smartest way to build.
          </h2>
          <p className="text-gray-600 mb-8 text-2xl font-medium">
            I create the architecture. You just copy and paste.
          </p>
          <div className="bg-white border border-gray-200 rounded-3xl p-8 shadow-sm inline-block max-w-xl mx-auto">
            <p className="text-lg text-gray-700 leading-relaxed font-semibold">
              <span className="text-indigo-600 font-bold uppercase tracking-widest text-sm block mb-3">
                Coming Soon
              </span>
              Describe any idea, and the Architect will give you all the precise
              prompts you need to build your dream platform effortlessly.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
