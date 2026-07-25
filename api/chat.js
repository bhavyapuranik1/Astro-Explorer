import { GoogleGenAI } from "@google/genai";

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // Preflight OPTIONS request
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Only POST allowed
  if (req.method !== "POST") {
    return res.status(405).json({
      error: { message: "Method not allowed", code: 405 }
    });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const requestedModel = body.model || "google/gemini-3.6-flash";
    const provider = (body.provider || "").toLowerCase();

    const geminiApiKey =
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_AI_STUDIO_API_KEY ||
      process.env.GOOGLE_GENAI_API_KEY;
    const groqApiKey = process.env.GROQ_API_KEY;
    const openRouterApiKey = process.env.OPENROUTER_API_KEY;

    // Check if Groq provider
    const isGroqModel = requestedModel.toLowerCase().includes("llama-3") || requestedModel.toLowerCase().includes("groq");
    const useGroq = provider === "groq" || isGroqModel;

    // Check if Gemini model
    const isGeminiModel = requestedModel.toLowerCase().includes("gemini");
    const useGemini = !useGroq && (provider === "gemini" || provider === "google" || provider === "google_ai_studio" || isGeminiModel);

    if (useGroq) {
      if (!groqApiKey) {
        return res.status(401).json({
          error: {
            message: "Groq API key is not configured.",
            code: 401
          }
        });
      }
      return await handleGroqRequest(body, groqApiKey, res);
    } else if (useGemini) {
      if (!geminiApiKey) {
        return res.status(401).json({
          error: {
            message: "Google AI Studio API Key is missing. Please configure the GEMINI_API_KEY environment variable.",
            code: 401
          }
        });
      }

      return await handleGeminiRequest(body, geminiApiKey, res);
    } else {
      return await handleOpenRouterRequest(body, openRouterApiKey, res);
    }
  } catch (err) {
    console.error("Handler error:", err);
    return res.status(500).json({
      error: {
        message: err.message || "Internal server error",
        code: 500
      }
    });
  }
}

/**
 * Handle requests via Groq API (OpenAI-compatible)
 */
async function handleGroqRequest(body, apiKey, res) {
  try {
    const rawModel = body.model || "llama-3.3-70b-versatile";
    const modelName = rawModel.replace(/^groq\//, "");

    const groqPayload = {
      model: modelName,
      messages: body.messages || [],
      temperature: typeof body.temperature === "number" ? body.temperature : 0.7
    };

    if (typeof body.max_tokens === "number") {
      groqPayload.max_tokens = body.max_tokens;
    }

    console.log("⚡ [Groq API] Calling chat/completions with model:", modelName);

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey || ""}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(groqPayload)
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err) {
    console.error("Groq API Error:", err);
    return res.status(500).json({
      error: {
        message: err.message || "Failed to reach Groq API",
        code: 500
      }
    });
  }
}

/**
 * Handle requests via Google AI Studio (@google/genai SDK)
 */
async function handleGeminiRequest(body, apiKey, res) {
  try {
    const ai = new GoogleGenAI({ apiKey });

    const rawModel = body.model || "gemini-3.6-flash";
    const modelName = rawModel.replace(/^google\//, "");

    const messages = Array.isArray(body.messages) ? body.messages : [];
    let systemInstruction = "";
    const contents = [];

    for (const msg of messages) {
      if (msg.role === "system") {
        systemInstruction += (systemInstruction ? "\n\n" : "") +
          (typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content));
      } else {
        const role = msg.role === "assistant" ? "model" : "user";
        const parts = [];

        if (typeof msg.content === "string") {
          parts.push({ text: msg.content });
        } else if (Array.isArray(msg.content)) {
          for (const part of msg.content) {
            if (part.type === "text") {
              parts.push({ text: part.text || "" });
            } else if (part.type === "image_url" && part.image_url && part.image_url.url) {
              const url = part.image_url.url;
              const match = url.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
              if (match) {
                parts.push({
                  inlineData: {
                    mimeType: match[1],
                    data: match[2]
                  }
                });
              }
            }
          }
        }

        if (parts.length > 0) {
          contents.push({ role, parts });
        }
      }
    }

    if (contents.length === 0) {
      contents.push({ role: "user", parts: [{ text: "Hello" }] });
    }

    const config = {};
    if (systemInstruction) {
      config.systemInstruction = systemInstruction;
    }
    if (typeof body.temperature === "number") {
      config.temperature = body.temperature;
    }
    if (typeof body.max_tokens === "number") {
      config.maxOutputTokens = body.max_tokens;
    }

    console.log("🤖 [Google AI Studio] Calling generateContent with model:", modelName);

    const result = await ai.models.generateContent({
      model: modelName,
      contents,
      config
    });

    const responseText = result.text || "";

    return res.status(200).json({
      id: "gemini-" + Date.now(),
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: modelName,
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: responseText
          },
          finish_reason: "stop"
        }
      ]
    });
  } catch (err) {
    // Log complete Google AI Studio error object
    console.error("===== GOOGLE AI STUDIO ERROR START =====");
    console.error("Status Code:", err?.status || err?.statusCode || err?.code || err?.response?.status);
    console.error("Message:", err?.message);
    console.error("Details:", err?.details || err?.errorDetails || err?.statusDetails);
    console.error("Error Body:", err?.response ? (err.response.data || err.response.body) : err?.error);
    console.error("Stack:", err?.stack);
    try {
      console.error("Full Raw Error Object:", JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
    } catch (_) {}
    console.error("===== GOOGLE AI STUDIO ERROR END =====");

    const rawStatus = err?.status || err?.statusCode || (err?.response && err?.response.status);
    const numericStatus = typeof rawStatus === "number" ? rawStatus : (parseInt(rawStatus, 10) || 500);
    const rawMessage = err?.message || (typeof err === "string" ? err : "Google AI Studio API Error");

    if (isGenuineQuotaOrRateLimitError(err)) {
      return res.status(429).json({
        error: {
          message: rawMessage,
          code: 429,
          type: "rate_limit_exceeded"
        }
      });
    }

    // Forward original Google API error message and status directly to frontend
    return res.status(numericStatus).json({
      error: {
        message: rawMessage,
        code: numericStatus,
        type: "api_error"
      }
    });
  }
}

/**
 * Strict helper to identify genuine rate-limit or quota exceeded errors from Google AI Studio
 */
function isGenuineQuotaOrRateLimitError(err) {
  if (!err) return false;
  const status = err.status || err.statusCode || err.code || (err.response && err.response.status);
  if (status === 429 || status === "429" || status === "RESOURCE_EXHAUSTED") return true;

  const reason = err.reason || (err.details && err.details[0] && err.details[0].reason);
  if (reason === "RATE_LIMIT_EXCEEDED" || reason === "QUOTA_EXCEEDED" || reason === "RESOURCE_EXHAUSTED") return true;

  const msg = (err.message || "").toLowerCase();
  return (
    msg.includes("resource_exhausted") ||
    msg.includes("quota_exceeded") ||
    msg.includes("rate_limit_exceeded")
  );
}

/**
 * Handle requests via OpenRouter API (Fallback / Non-Gemini provider)
 */
async function handleOpenRouterRequest(body, apiKey, res) {
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey || ""}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err) {
    console.error("OpenRouter API Error:", err);
    return res.status(500).json({
      error: {
        message: err.message || "Failed to reach OpenRouter API",
        code: 500
      }
    });
  }
}