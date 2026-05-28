import OpenAI from "openai";
import Property from "../models/Property.js";

// Initialize client outside handler to reuse TCP connections
const openai = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

// Enums and strict schemas
const PROPERTY_TYPES = ["Apartment", "House", "Villa"];
const DEFAULT_IMG =
  "https://images.pexels.com/photos/106399/pexels-photo-106399.jpeg";

const TOOLS = [
  {
    type: "function",
    function: {
      name: "addProperty",
      description:
        "Registers a new real estate property in the database. Use ONLY when all required parameters are provided by the user.",
      parameters: {
        type: "object",
        properties: {
          city: {
            type: "string",
            description:
              "The city where the property is located (e.g., תל אביב).",
          },
          street: { type: "string", description: "The street name. Required." },
          price: {
            type: "number",
            description: "The price of the property in ILS.",
          },
          rooms: { type: "number", description: "Number of rooms." },
          size: {
            type: "number",
            description: "Size of the property in square meters (מ''ר).",
          },
          floor: { type: "number", description: "Floor number." },
          type: {
            type: "string",
            enum: PROPERTY_TYPES,
            description: "Type of property.",
          },
          description: {
            type: "string",
            description:
              "A brief summary based ONLY on facts provided by the user.",
          },
        },
        // We make the LLM strictly collect the crucial metrics.
        // Image and marketing copy can be generated deterministically in backend code, not by the LLM.
        required: ["city", "street", "price", "rooms", "size", "floor", "type"],
      },
    },
  },
];

/**
 * Controller: Handles incoming chat requests for Real Estate
 */
export const handleChat = async (req, res) => {
  try {
    // 1. Destructure payload - support history for conversational UX
    const { message, history = [] } = req.body;
    if (!message) {
      return res
        .status(400)
        .json({ error: "Missing 'message' in request body." });
    }

    // 2. Build Message Context
    const systemPrompt = {
      role: "system",
      content: `You are an expert real estate intake agent. Your sole objective is to collect details to list a property.
  
CRITICAL INSTRUCTIONS:
- You must collect: City, Street, Price, Rooms, Size (sq meters), Floor, and Property Type (${PROPERTY_TYPES.join(", ")}).
- ABSOLUTE BLOCKERS: You cannot proceed, evaluate, or call the 'addProperty' tool under any circumstances if City, Price, or Floor are missing. Prioritize collecting these three fields above all else.
- If ANY required pieces of information are missing, DO NOT call the 'addProperty' tool. Instead, politely ask the user for the missing details in English.
- Do not make up or hallucinate missing data.
- Speak natively, professionally, and warmly in English.`,
    };

    const messages = [
      systemPrompt,
      ...history.map((msg) => ({ role: msg.role, content: msg.content })),
      { role: "user", content: message },
    ];

    // 3. First LLM Inference Pass
    const response = await openai.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages,
      tools: TOOLS,
      tool_choice: "auto",
      temperature: 0.1,
    });

    const responseMessage = response.choices[0].message;
    console.log(responseMessage);
    messages.push(responseMessage); // Maintain the state sequence

    // 4. Check for Agent Tool Call Intent
    if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
      const toolCall = responseMessage.tool_calls[0];
      if (toolCall.function.name === "addProperty") {
        try {
          const rawArgs = JSON.parse(toolCall.function.arguments);
          console.log("na");
          // Deterministic backend enrichment (Don't waste tokens making LLM guess this)
          const enrichedPropertyData = {
            ...rawArgs,
            img: DEFAULT_IMG,
            description:
              rawArgs.description ||
              `דירת ${rawArgs.rooms} חדרים ב${rawArgs.city}, ברחוב ${rawArgs.street}.`,
          };

          // Database Interaction
          const newProperty = await Property.create(enrichedPropertyData);

          // 5. Complete the LLM execution loop (Feed execution success back to LLM)
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            name: "addProperty",
            content: JSON.stringify({
              status: "success",
              propertyId: newProperty._id,
            }),
          });

          // Second Inference Pass so the LLM outputs a natural closing response based on success
          const finalResponse = await openai.chat.completions.create({
            model: "llama-3.1-8b-instant",
            messages,
          });

          return res.status(200).json({
            reply: finalResponse.choices[0].message.content,
            actionPerformed: true,
            propertyId: newProperty._id,
            updatedHistory: messages.slice(1), // Exclude system prompt when returning history to client
          });
        } catch (dbOrParseError) {
          console.error("Tool Execution Failed:", dbOrParseError);

          // Tell the LLM the DB save failed so it can report gracefully to user
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            name: "addProperty",
            content: JSON.stringify({
              status: "error",
              error: "Database save failure",
            }),
          });

          const errorResponse = await openai.chat.completions.create({
            model: "llama-3.1-8b-instant",
            messages,
          });

          return res.status(200).json({
            reply: errorResponse.choices[0].message.content,
            actionPerformed: false,
          });
        }
      }
    }

    // 6. Conversational Response (e.g., asking follow-up questions)
    return res.status(200).json({
      reply: responseMessage.content,
      actionPerformed: false,
      updatedHistory: messages.slice(1),
    });
  } catch (error) {
    // Production Grade Error Obfuscation & Logging
    console.error("Fatal Error in handleChat AI pipeline:", error);
    return res.status(500).json({
      error: "Internal Server Error",
      message:
        "The system encountered an error processing your request. Please try again later.",
    });
  }
};
