import OpenAI from "openai";
import DemoChat from "../models/DemoChat.js";
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
const DEMO_MAX_TOOL_ITERATIONS = 4;
const AGENT_MODEL = "openai/gpt-oss-20b";

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

// Appended for the demo admin. The visitor gets exactly one message, so a
// follow-up question could never be answered.
const DEMO_PROMPT_ADDENDUM = `

DEMO MODE: this user is a portfolio visitor trying a read-only demo, and this is the ONLY message they can send. Never ask a follow-up question or ask for more details, and do not end your reply with a question or an offer of further help ("איך אפשר לעזור?"): they cannot reply. Give the most complete, useful answer you can right now. If they ask to list/add a property, the addProperty tool will not save anything in demo mode: explain warmly that adding is disabled in the demo and show the numbered list of fields you would collect from a real admin.`;

// ─── Demo: one message per demo session ──────────────────────────────────────

// Inserting the demoId succeeds once; a second insert is a duplicate key.
async function claimDemoChat(demoId) {
  try {
    await DemoChat.create({ _id: demoId });
    return true;
  } catch (error) {
    if (error.code === 11000) return false;
    throw error;
  }
}

// ─── Tool dispatch ────────────────────────────────────────────────────────────

async function dispatchTool(name, args, isDemo) {
  if (args.city) args.city = normalizeCity(args.city);

  try {
    if (name === "addProperty") {
      if (isDemo) {
        return { status: "demo_blocked", error: "Demo mode is read-only; nothing was saved." };
      }
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

async function runAgentLoop(messages, isDemo) {
  let actionPerformed = false;
  let propertyId = null;
  const maxIterations = isDemo ? DEMO_MAX_TOOL_ITERATIONS : MAX_TOOL_ITERATIONS;

  for (let i = 0; i < maxIterations; i++) {
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
        const result = await dispatchTool(tc.function.name, args, isDemo);
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
  const isDemo = !!req.user?.isDemo;
  try {
    const { message, history = [] } = req.body;
    if (!message) {
      return res
        .status(400)
        .json({ error: "Missing 'message' in request body." });
    }

    if (isDemo && !(await claimDemoChat(req.user.demoId))) {
      return res.status(403).json({
        code: "DEMO_CHAT_USED",
        message: "The demo allows one chat message.",
      });
    }

    const messages = [
      {
        role: "system",
        content: isDemo ? SYSTEM_PROMPT + DEMO_PROMPT_ADDENDUM : SYSTEM_PROMPT,
      },
      // The demo is a single message, so any history the client sends is ignored.
      ...(isDemo ? [] : history), // spread as-is to preserve tool_calls in assistant messages
      { role: "user", content: message },
    ];

    const { reply, actionPerformed, propertyId } = await runAgentLoop(messages, isDemo);

    return res.status(200).json({
      reply,
      actionPerformed,
      ...(propertyId && { propertyId }),
      updatedHistory: messages.slice(1), 
    });
  } catch (error) {
    // The visitor got no answer, so give them their one message back.
    if (isDemo) await DemoChat.deleteOne({ _id: req.user.demoId }).catch(() => {});
    console.error("Fatal error in handleChat pipeline:", error);
    return res.status(500).json({
      error: "Internal Server Error",
      message: "The system encountered an error. Please try again later.",
    });
  }
};
