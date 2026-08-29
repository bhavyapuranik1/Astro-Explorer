const ALLOWED_LOCAL_ORIGINS = [

  "http://127.0.0.1:5501",
  "http://localhost:5500",
  "http://localhost:5501",
  "http://127.0.0.1:5500",
  "http://127.0.0.1:5502",
  "http://localhost:5502"
];

function setCorsHeaders(req, res) {
  const origin = req.headers.origin;
  let allowOrigin = "*";

  if (origin) {
    const isLocalDev = ALLOWED_LOCAL_ORIGINS.includes(origin) ||
                       /^http:\/\/(localhost|127\.0\.0\.1):(5500|5501|5502|3000|5173)$/.test(origin);
    const isVercelProd = origin.endsWith(".vercel.app") || origin.includes("astro-explorer");

    if (isLocalDev || isVercelProd) {
      allowOrigin = origin;
    }
  }

  res.setHeader("Access-Control-Allow-Origin", allowOrigin);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
}

export default async function handler(req, res) {
  setCorsHeaders(req, res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const queryProvider = (req.query?.provider || "").toLowerCase();

  // CRITICAL REQUIREMENT 4: OPENROUTER — NO AUTOMATIC MODEL DISCOVERY
  if (queryProvider === "openrouter") {
    return res.status(400).json({
      error: {
        message: "Automatic model discovery is disabled for OpenRouter. OpenRouter uses configured models.",
        code: 400
      }
    });
  }

  const geminiApiKey =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_AI_STUDIO_API_KEY ||
    process.env.GOOGLE_GENAI_API_KEY;
  const groqApiKey = process.env.GROQ_API_KEY;


  try {
    if (queryProvider === "groq") {
      const groqModels = await discoverGroqModels(groqApiKey);
      return res.status(200).json({
        provider: "groq",
        models: groqModels
      });
    }

    // Default to Gemini discovery
    const geminiModels = await discoverGeminiModels(geminiApiKey);
    return res.status(200).json({
      provider: "google_ai_studio",
      models: geminiModels

    });
  } catch (err) {
    console.error("[ModelDiscoveryAPI] Error fetching models:", err.message);
    return res.status(500).json({
      error: {
        message: err.message || "Failed to discover models",
        code: 500
      }
    });
  }
}

/**
 * Dynamically discover and rank Gemini models (TOP 5 Rule)
 */
async function discoverGeminiModels(apiKey) {
  const fallbackModels = [
    { id: "google/gemini-3.6-flash", name: "Gemini 3.6 Flash", badge: "Default" },
    { id: "google/gemini-3.5-flash", name: "Gemini 3.5 Flash", badge: "Fast" }
  ];


  if (!apiKey) return fallbackModels;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const response = await fetch(url);
    if (!response.ok) {
      console.warn("[GeminiDiscovery] API returned status:", response.status);
      return fallbackModels;
    }

    const data = await response.json();
    if (!data || !Array.isArray(data.models)) return fallbackModels;

    // Filter eligible Gemini text/chat generation models
    const eligibleGemini = data.models.filter(m => {
      const rawName = String(m.name || "").toLowerCase();
      const displayName = String(m.displayName || "").toLowerCase();
      const methods = Array.isArray(m.supportedGenerationMethods) ? m.supportedGenerationMethods : [];

      // Must be Gemini family
      const isGemini = rawName.includes("gemini") || displayName.includes("gemini");
      if (!isGemini) return false;

      // Must support text/content generation
      const supportsGen = methods.includes("generateContent");
      if (!supportsGen) return false;

      // Exclude non-chat / specialized models
      const isExcluded = rawName.includes("embedding") ||
                         rawName.includes("embed") ||
                         rawName.includes("imagen") ||
                         rawName.includes("tts") ||
                         rawName.includes("audio-only") ||
                         rawName.includes("robotics") ||
                         rawName.includes("aqa") ||
                         rawName.includes("bison");
      return !isExcluded;
    });

    if (eligibleGemini.length === 0) return fallbackModels;

    // Rank Gemini models (prefer higher versions, flash/pro models)
    eligibleGemini.sort((a, b) => {
      const nameA = a.name.replace("models/", "");
      const nameB = b.name.replace("models/", "");

      const getScore = (id, obj) => {
        let score = 0;
        // Dynamically score any version number (e.g. 4.0 -> 400, 3.7 -> 370, 3.6 -> 360)
        const match = id.match(/gemini-(\d+\.\d+)/i);
        if (match) {
          score += Math.round(parseFloat(match[1]) * 100);
        }

        if (id.includes("flash")) score += 15;
        if (id.includes("pro")) score += 10;

        // Prefer stable over preview/experimental unless newer version
        if (id.includes("preview") || id.includes("exp")) score -= 5;
        return score;
      };

      return getScore(nameB, b) - getScore(nameA, a);

    });

    // TOP 5 RULE: Keep only the best/current TOP 5 eligible Gemini models
    const top5Gemini = eligibleGemini.slice(0, 5).map((m, index) => {
      const cleanId = m.name.replace(/^models\//, "");
      const fullId = cleanId.startsWith("google/") ? cleanId : `google/${cleanId}`;
      const displayName = m.displayName || cleanId;
      const isDefault = index === 0;

      return {
        id: fullId,
        name: displayName,
        badge: isDefault ? "Default" : (cleanId.includes("3.7") ? "New" : cleanId.includes("flash") ? "Fast" : "Pro"),
        desc: m.description ? m.description.slice(0, 60) : ""
      };
    });

    return top5Gemini.length > 0 ? top5Gemini : fallbackModels;
  } catch (err) {
    console.warn("[GeminiDiscovery] Exception during model discovery:", err.message);
    return fallbackModels;
  }
}

/**
 * Dynamically discover Groq models
 */
async function discoverGroqModels(apiKey) {
  const fallbackModels = [
    { id: "openai/gpt-oss-120b", name: "GPT OSS 120B", desc: "Flagship 500 T/s" },
    { id: "openai/gpt-oss-20b", name: "GPT OSS 20B", desc: "Ultra Fast 1000 T/s" },
    { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B Instant", desc: "Fast" },
    { id: "llama-3.3-70b-specdec", name: "Llama 3.3 70B SpecDec", desc: "High Performance" }
  ];




  if (!apiKey) return fallbackModels;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/models", {
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    });

    if (!response.ok) {
      console.warn("[GroqDiscovery] API returned status:", response.status);
      return fallbackModels;
    }

    const data = await response.json();
    if (!data || !Array.isArray(data.data)) return fallbackModels;

    // Filter active Groq text-chat models
    const activeGroq = data.data.filter(m => {
      const id = String(m.id || "").toLowerCase();
      if (m.active === false) return false;
      // Exclude whisper, tts, guardrail, embedding models
      if (id.includes("whisper") || id.includes("tts") || id.includes("guard") || id.includes("embed") || id.includes("vision-preview")) return false;
      return id.includes("llama") || id.includes("mixtral") || id.includes("gemma") || id.includes("qwen") || id.includes("deepseek") || id.includes("oss");
    });

    if (activeGroq.length === 0) return fallbackModels;

    // Rank Groq models (prefer flagship OSS, 3.3 70B, 3.1 8B, DeepSeek)
    activeGroq.sort((a, b) => {
      const getScore = (id) => {
        let score = 0;
        if (id.includes("gpt-oss-120b")) score += 100;
        else if (id.includes("gpt-oss-20b")) score += 90;
        else if (id.includes("llama-3.3-70b")) score += 80;
        else if (id.includes("llama-3.1-8b")) score += 70;
        else if (id.includes("deepseek-r1")) score += 60;
        else if (id.includes("llama-3")) score += 50;
        return score;
      };
      return getScore(String(b.id || "").toLowerCase()) - getScore(String(a.id || "").toLowerCase());
    });

    // TOP 5 RULE for Groq
    return activeGroq.slice(0, 5).map(m => {
      return {
        id: m.id,
        name: formatGroqDisplayName(m.id),
        desc: m.owned_by ? `By ${m.owned_by}` : "Groq Fast LLM"
      };
    });

  } catch (err) {
    console.warn("[GroqDiscovery] Exception during Groq discovery:", err.message);
    return fallbackModels;
  }
}

function formatGroqDisplayName(modelId) {
  if (modelId.includes("llama-3.3-70b")) return "Llama 3.3 70B";
  if (modelId.includes("llama-3.1-8b")) return "Llama 3.1 8B Instant";
  if (modelId.includes("llama-3.2")) return "Llama 3.2";
  if (modelId.includes("mixtral")) return "Mixtral 8x7B";
  if (modelId.includes("gemma-2")) return "Gemma 2 9B";
  if (modelId.includes("qwen")) return "Qwen 2.5 72B";
  if (modelId.includes("deepseek")) return "DeepSeek R1 Distill";
  return modelId;
}
