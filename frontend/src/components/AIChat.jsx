import { useState } from "react";
import axios from "axios";

function AIChat({ onActionCompleted }) {
  const [input, setInput] = useState("");
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState([
    {
      text: "Hi! I'm your AI agent. I'll help you add properties!",
      sender: "ai",
    },
  ]);
  const [chatHistory, setChatHistory] = useState([]);
  const [isTyping, setIsTyping] = useState(false);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = { text: input, sender: "user" };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);

    try {
      const response = await axios.post("http://localhost:5000/api/chat", {
        message: userMessage.text,
        history: chatHistory,
      });
      console.log("omri", response.data);
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
          text: "Oops, there was an error communicating with the server.",
          sender: "ai",
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  if (isMinimized) {
    return (
      <button
        className="chat-minimize-btn"
        onClick={() => setIsMinimized(false)}
      >
        💬
      </button>
    );
  }

  return (
    <div className="chat-container">
      <div className="chat-header">
        <span>AI Assistant</span>
        <button onClick={() => setIsMinimized(true)}>▼</button>
      </div>

      <div className="chat-messages">
        {messages.map((msg, index) => (
          <div
            key={index}
            style={{
              alignSelf: msg.sender === "ai" ? "flex-start" : "flex-end",
              background: msg.sender === "ai" ? "#e0f7fa" : "#c8e6c9",
              padding: "10px 14px",
              borderRadius: "15px",
              maxWidth: "80%",
              wordWrap: "break-word",
            }}
          >
            {msg.text}
          </div>
        ))}
        {isTyping && (
          <div
            style={{
              alignSelf: "flex-start",
              background: "#f0f0f0",
              padding: "10px 14px",
              borderRadius: "15px",
            }}
          >
            Typing... ⏳
          </div>
        )}
      </div>
      <div className="chat-input-area">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Type here...."
        />
        <button onClick={sendMessage}>Send</button>
      </div>
    </div>
  );
}

export default AIChat;
