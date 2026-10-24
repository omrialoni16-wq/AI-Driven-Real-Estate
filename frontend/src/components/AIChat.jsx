import { useState, useRef, useEffect } from "react";
import { Bot, Send, X, MessageCircle, Sparkles } from "lucide-react";

import api from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const WELCOME_MESSAGE =
  "היי! אני העוזר החכם שלך. אני יכול להוסיף מודעות חדשות, לחפש נכסים או לבדוק מחירי שוק — פשוט תשאל/י!";

// The demo allows one message (enforced by the server too), so the welcome
// says so up front and lists what the assistant can do.
const DEMO_WELCOME_MESSAGE = `היי! זה מצב דמו, ואפשר לשלוח לי הודעה אחת בלבד, אז כדאי לבחור שאלה טובה 🙂

הנה מה שאני יודע לעשות:
1. חיפוש נכסים: לפי עיר, סוג נכס, טווח מחירים, מספר חדרים, קומה וגודל.
2. מחירי שוק: מחיר ממוצע, מינימום, מקסימום ומחיר למ"ר, לפי עיר, סוג נכס ומספר חדרים.
3. רישום נכס חדש: אני אוסף את כל הפרטים בשיחה ושומר את המודעה (בדמו לא נשמר כלום).

אפשר לכתוב שאלה משלך או לבחור אחת מהדוגמאות למטה.`;

const DEMO_SUGGESTIONS = [
  "מה המחיר הממוצע לדירת 4 חדרים בתל אביב?",
  "תמצא לי דירה בחיפה עד 2 מיליון ש״ח",
  "אני רוצה לפרסם דירה חדשה, מה צריך?",
];

function AIChat({ isDemo = false, onActionCompleted }) {
  const [input, setInput] = useState("");
  const [isMinimized, setIsMinimized] = useState(!isDemo);
  const [messages, setMessages] = useState([
    {
      text: isDemo ? DEMO_WELCOME_MESSAGE : WELCOME_MESSAGE,
      sender: "ai",
    },
  ]);
  const [chatHistory, setChatHistory] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isDemoMessageUsed, setIsDemoMessageUsed] = useState(false);
  const isInputLocked = isDemo && isDemoMessageUsed;
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const sendMessage = async (text = input) => {
    if (!text.trim() || isTyping || isInputLocked) return;

    const userMessage = { text, sender: "user" };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);
    if (isDemo) setIsDemoMessageUsed(true);

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
      const code = error.response?.data?.code;
      let text = "אופס, אירעה שגיאה בתקשורת עם השרת.";
      if (code === "DEMO_CHAT_USED") {
        text = "הודעת הדמו כבר נוצלה בסשן הזה.";
      } else if (code === "DEMO_CHAT_LIMIT") {
        text = "נשלחו יותר מדי הודעות דמו מהרשת הזו. נסה/י שוב מאוחר יותר.";
      } else if (isDemo) {
        // The server gives the message back when it fails, so let them retry.
        setIsDemoMessageUsed(false);
      }
      setMessages((prev) => [...prev, { text, sender: "ai" }]);
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
              "whitespace-pre-line",
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
        {isDemo && !isDemoMessageUsed && (
          <div className="flex flex-col items-start gap-2">
            {DEMO_SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => sendMessage(suggestion)}
                className="rounded-full border border-primary/30 px-3 py-1.5 text-start text-xs font-medium text-primary transition-colors hover:bg-primary/10"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      {isInputLocked && !isTyping && (
        <p className="border-t bg-muted/50 px-4 py-2 text-center text-xs text-muted-foreground">
          הודעת הדמו נוצלה. בגרסה המלאה אפשר להמשיך לשוחח עם העוזר.
        </p>
      )}
      <div className="flex items-center gap-2 border-t p-3">
        <Input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder={isInputLocked ? "הודעת הדמו נוצלה" : "הקלד/י הודעה…"}
          disabled={isInputLocked}
          className="rounded-full"
        />
        <Button
          size="icon"
          onClick={() => sendMessage()}
          disabled={!input.trim() || isInputLocked}
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
