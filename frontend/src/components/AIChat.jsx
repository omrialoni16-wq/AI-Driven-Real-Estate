import { useState, useRef, useEffect } from "react";
import { Bot, Send, X, MessageCircle, Sparkles } from "lucide-react";

import api from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function AIChat({ onActionCompleted }) {
  const [input, setInput] = useState("");
  const [isMinimized, setIsMinimized] = useState(true);
  const [messages, setMessages] = useState([
    {
      text: "היי! אני העוזר החכם שלך. אני יכול להוסיף מודעות חדשות, לחפש נכסים או לבדוק מחירי שוק — פשוט תשאל/י!",
      sender: "ai",
    },
  ]);
  const [chatHistory, setChatHistory] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = { text: input, sender: "user" };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);

    try {
      const response = await api.post("/api/chat", {
        message: userMessage.text,
        history: chatHistory,
      });
      const aiMessage = { text: response.data.reply, sender: "ai" };
      setMessages((prev) => [...prev, aiMessage]);

      if (response.data.updatedHistory) {
        setChatHistory(response.data.updatedHistory);
      }
      if (response.data.actionPerformed) {
        onActionCompleted();
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => [
        ...prev,
        {
          text: "אופס, אירעה שגיאה בתקשורת עם השרת.",
          sender: "ai",
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  if (isMinimized) {
    return (
      <Button
        size="icon"
        onClick={() => setIsMinimized(false)}
        className="fixed bottom-8 left-8 z-40 size-14 rounded-full shadow-lg shadow-primary/30 transition-transform hover:scale-105 [&_svg:not([class*='size-'])]:size-6"
        aria-label="פתח את העוזר החכם"
      >
        <MessageCircle />
      </Button>
    );
  }

  return (
    <div className="fixed bottom-8 left-8 z-40 flex h-[540px] w-[calc(100vw-4rem)] max-w-sm flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 bg-primary px-4 py-3 text-primary-foreground">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-full bg-primary-foreground/15">
            <Bot className="size-5" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold">עוזר חכם</p>
            <p className="flex items-center gap-1 text-xs opacity-80">
              <Sparkles className="size-3" /> מופעל על ידי Groq
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsMinimized(true)}
          className="rounded-md p-1 opacity-80 transition-opacity hover:opacity-100"
          aria-label="מזער את הצ'אט"
        >
          <X className="size-5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={cn(
              "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed break-words",
              msg.sender === "ai"
                ? "self-start rounded-bl-sm bg-muted text-foreground"
                : "self-end rounded-br-sm bg-primary text-primary-foreground",
            )}
          >
            {msg.text}
          </div>
        ))}
        {isTyping && (
          <div className="flex items-center gap-1.5 self-start rounded-2xl rounded-bl-sm bg-muted px-3.5 py-2.5">
            <span className="size-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
            <span className="size-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
            <span className="size-2 animate-bounce rounded-full bg-muted-foreground" />
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 border-t p-3">
        <Input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="הקלד/י הודעה…"
          className="rounded-full"
        />
        <Button
          size="icon"
          onClick={sendMessage}
          disabled={!input.trim()}
          className="shrink-0 rounded-full"
          aria-label="שלח הודעה"
        >
          <Send className="size-4" />
        </Button>
      </div>
    </div>
  );
}

export default AIChat;
