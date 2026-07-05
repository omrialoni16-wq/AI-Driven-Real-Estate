import OpenAI from "openai";
import {
  agentAddProperty,
  agentSearchPrices,
  agentSearchProperties,
} from "../service/AgentService.js";

const openai = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

const PROPERTY_TYPES = [
  "דירה",
  "בית פרטי/ קוטג'",
  "גג/ פנטהאוז",
  "דירת גן",
  "דופלקס",
  "סטודיו/ לופט",
];
const MAX_TOOL_ITERATIONS = 8;
const AGENT_MODEL = "llama-3.3-70b-versatile";

const CITY_MAP = {
  "tel aviv": "תל אביב",
  "tel-aviv": "תל אביב",
  telaviv: "תל אביב",
  jerusalem: "ירושלים",
  haifa: "חיפה",
  "beer sheva": "באר שבע",
  beersheba: "באר שבע",
  "be'er sheva": "באר שבע",
  netanya: "נתניה",
  "ramat gan": "רמת גן",
  "rishon lezion": "ראשון לציון",
  "rishon le-zion": "ראשון לציון",
  "petah tikva": "פתח תקווה",
  "petach tikva": "פתח תקווה",
  ashdod: "אשדוד",
  ashkelon: "אשקלון",
  holon: "חולון",
  "bnei brak": "בני ברק",
  "bat yam": "בת ים",
  herzliya: "הרצליה",
  "kfar saba": "כפר סבא",
  raanana: "רעננה",
  "ra'anana": "רעננה",
  modiin: "מודיעין",
  rehovot: "רחובות",
  nazareth: "נצרת",
  eilat: "אילת",
  tiberias: "טבריה",
  acre: "עכו",
  akko: "עכו",
  lod: "לוד",
  ramla: "רמלה",
};

function normalizeCity(city) {
  if (!city) return city;
  const key = city.toLowerCase().trim();
  return CITY_MAP[key] ?? city;
}
const TOOLS = [
  {
    type: "function",
    function: {
      name: "addProperty",
      description:
        "Register a new real estate property in the database. Call ONLY when ALL required fields have been provided by the user. Never fabricate values — ask for any missing field.",
      parameters: {
        type: "object",
        properties: {
          city: {
            type: "string",
            description: "City in Hebrew (e.g. תל אביב, חיפה, ירושלים).",
          },
          street: {
            type: "string",
            description: "Street name in Hebrew.",
          },
          price: { type: "number", description: "Price in ILS." },
          rooms: { type: "number", description: "Number of rooms." },
          size: { type: "number", description: "Size in square meters." },
          floor: { type: "number", description: "Floor number." },
          type: {
            type: "string",
            enum: PROPERTY_TYPES,
            description: "Property type, in Hebrew.",
          },
        },
        required: ["city", "street", "price", "rooms", "size", "floor", "type"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "searchPrices",
      description:
        "Query market price statistics from the database. Use when the user asks about prices, averages, market data, or price ranges.",
      parameters: {
        type: "object",
        properties: {
          city: {
            type: "string",
            description: "City filter in Hebrew. Omit to query all cities.",
          },
          type: {
            type: "string",
            enum: PROPERTY_TYPES,
            description: "Property type filter.",
          },
          rooms: {
            type: "number",
            description: "Room count filter (±1 range is applied).",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "searchProperties",
      description:
        "Search and filter property listings. Use when the user wants to browse, find, or look up specific properties.",
      parameters: {
        type: "object",
        properties: {
          city: { type: "string", description: "City filter in Hebrew." },
          type: { type: "string", enum: PROPERTY_TYPES },
          minPrice: { type: "number" },
          maxPrice: { type: "number" },
          rooms: { type: "number" },
          floor: { type: "number" },
          minSize: { type: "number" },
          maxSize: { type: "number" },
        },
        required: [],
      },
    },
  },
];

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a helpful real estate assistant with three capabilities:

1. LIST A PROPERTY — the moment the user expresses intent to add/register a property, immediately reply with ONE message listing ALL required fields as a numbered list, in Hebrew, before asking anything else: 1. עיר (בעברית, למשל: תל אביב, חיפה, ירושלים) 2. רחוב (בעברית) 3. מחיר 4. מספר חדרים 5. גודל הנכס (במ"ר) 6. מספר הקומה 7. סוג הנכס (למשל: דירה, בית פרטי/קוטג', גג/פנטהאוז, דירת גן, דופלקס, סטודיו/לופט). Do not ask for fields one at a time — always present the full list up front. Once the user replies, only ask again for whatever specific fields are still missing (also listed explicitly, not one-by-one if more than one is missing). Never assume or fabricate values. Only call addProperty once every field has been provided. City, street, and type must be in Hebrew.

2. MARKET PRICES — when the user asks about prices, averages, or market data, call searchPrices and present the results warmly and concisely.

3. SEARCH LISTINGS — when the user wants to browse or find properties, call searchProperties and summarize the results clearly.

Always translate city/street names to Hebrew before calling any tool. Always reply to the user in Hebrew, regardless of the language they write in. Be warm and professional.

Never reveal internal implementation details: do not mention tool/function names (such as addProperty, searchPrices, searchProperties), parameter names, JSON schemas, or any other technical detail about how you work. If the user asks what you can do or which tools/capabilities you have, answer conversationally in plain Hebrew describing the three capabilities above in natural language (e.g. "אני יכול לעזור לך לרשום נכס חדש", "לבדוק מחירי שוק בעיר מסוימת", "לחפש נכסים לפי קריטריונים כמו עיר, מחיר וחדרים") — never as a technical list of function names.`;

// ─── Tool dispatch ────────────────────────────────────────────────────────────

async function dispatchTool(name, args) {
  if (args.city) args.city = normalizeCity(args.city);

  try {
    if (name === "addProperty") {
      return await agentAddProperty(args);
    }
    if (name === "searchPrices") {
      const data = await agentSearchPrices(args);
      return { status: "success", data };
    }
    if (name === "searchProperties") {
      const result = await agentSearchProperties(args);
      return { status: "success", ...result };
    }
  } catch (err) {
    console.error(`[dispatchTool][${name}] error:`, err);
    return { status: "error", error: "Tool execution failed." };
  }

  return { status: "error", error: `Unknown tool: ${name}` };
}

// ─── Unified agentic loop ─────────────────────────────────────────────────────

async function runAgentLoop(messages) {
  let actionPerformed = false;
  let propertyId = null;

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const response = await openai.chat.completions.create({
      model: AGENT_MODEL,
      messages,
      tools: TOOLS,
      tool_choice: "auto",
      temperature: 0.1,
    });

    const assistantMsg = response.choices[0].message;
    messages.push(assistantMsg);

    if (!assistantMsg.tool_calls?.length) {
      return { reply: assistantMsg.content, actionPerformed, propertyId };
    }

    const toolResults = await Promise.all(
      assistantMsg.tool_calls.map(async (tc) => {
        const args = JSON.parse(tc.function.arguments);
        const result = await dispatchTool(tc.function.name, args);
        return { tc, result };
      }),
    );

    for (const { tc, result } of toolResults) {
      messages.push({
        role: "tool",
        tool_call_id: tc.id,
        name: tc.function.name,
        content: JSON.stringify(result),
      });
      if (tc.function.name === "addProperty" && result.status === "success") {
        actionPerformed = true;
        propertyId = result.propertyId;
      }
    }
    // Loop continues — agent sees tool result and produces its own final text
  }

  return {
    reply: "לא הצלחתי להשלים את הבקשה. נסה/י שוב.",
    actionPerformed,
    propertyId,
  };
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export const handleChat = async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    if (!message) {
      return res
        .status(400)
        .json({ error: "Missing 'message' in request body." });
    }

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history, // spread as-is to preserve tool_calls in assistant messages
      { role: "user", content: message },
    ];

    const { reply, actionPerformed, propertyId } = await runAgentLoop(messages);

    return res.status(200).json({
      reply,
      actionPerformed,
      ...(propertyId && { propertyId }),
      updatedHistory: messages.slice(1), 
    });
  } catch (error) {
    console.error("Fatal error in handleChat pipeline:", error);
    return res.status(500).json({
      error: "Internal Server Error",
      message: "The system encountered an error. Please try again later.",
    });
  }
};
