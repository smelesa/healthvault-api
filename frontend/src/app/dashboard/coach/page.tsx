"use client";

import { useEffect, useState, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { createChatSession, chat, getChatHistory, type ChatMessage } from "@/lib/api";

const GUARDRAIL = "This is an AI health assistant for informational purposes only. It is not a substitute for professional medical advice, diagnosis, or treatment. Always consult your doctor before making any health decisions.";

export default function CoachPage() {
  const { getToken } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getToken().then(setToken);
  }, [getToken]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function startSession() {
    if (!token) return;
    const data = await createChatSession(token);
    setSessionId(data.session_id);
    setMessages([{
      role: "assistant",
      content: `Ciao! Sono il tuo Health Coach. Puoi chiedermi qualsiasi cosa sui tuoi biomarcatori, risultati delle analisi, o consigli generali per migliorare la tua salute. ${GUARDRAIL}`,
      sources: [],
      created_at: new Date().toISOString(),
    }]);
  }

  async function sendMessage() {
    if (!token || !sessionId || !input.trim()) return;
    const userMsg = input.trim();
    setInput("");
    setSending(true);

    setMessages((prev) => [...prev, {
      role: "user",
      content: userMsg,
      sources: [],
      created_at: new Date().toISOString(),
    }]);

    try {
      const reply = await chat(token, sessionId, userMsg);
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: reply.reply + "\n\n" + GUARDRAIL,
        sources: reply.sources || [],
        created_at: new Date().toISOString(),
      }]);
    } catch (e) {
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
        sources: [],
        created_at: new Date().toISOString(),
      }]);
    } finally {
      setSending(false);
    }
  }

  if (!sessionId) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center p-8 gap-6">
        <div className="text-6xl">💜</div>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-black dark:text-white">Health Coach</h2>
          <p className="text-zinc-500 dark:text-zinc-400 mt-2 max-w-sm">
            Chat with an AI health assistant trained on your biomarker data and clinical guidelines.
          </p>
        </div>
        <button
          onClick={startSession}
          className="px-6 py-3 text-base font-medium text-white bg-black dark:bg-white dark:text-black rounded-full hover:opacity-90 transition-opacity"
        >
          Start conversation →
        </button>
        <p className="text-xs text-zinc-400 max-w-xs text-center">{GUARDRAIL}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 p-8 gap-4">
      <div>
        <h1 className="text-3xl font-bold text-black dark:text-white">Health Coach</h1>
        <p className="text-zinc-500 dark:text-zinc-400 mt-1">AI-powered health guidance based on your data.</p>
      </div>

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-3 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 min-h-[400px] max-h-[500px]">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
              msg.role === "user"
                ? "bg-black text-white dark:bg-white dark:text-black"
                : "bg-zinc-100 dark:bg-zinc-800 text-black dark:text-white"
            }`}>
              {msg.content.split("\n\n").map((para, j) => (
                <p key={j} className={j > 0 ? "mt-2" : ""}>{para}</p>
              ))}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-zinc-100 dark:bg-zinc-800 px-4 py-3 rounded-2xl">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex gap-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !sending && sendMessage()}
          placeholder="Ask about your health…"
          className="flex-1 px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-black dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
          disabled={sending}
        />
        <button
          onClick={sendMessage}
          disabled={sending || !input.trim()}
          className="px-5 py-3 text-sm font-medium text-white bg-black dark:bg-white dark:text-black rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          Send
        </button>
      </div>
    </div>
  );
}