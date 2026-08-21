import { GoogleGenAI } from "@google/genai";
import { getModelCapability, sanitizeLogObject } from "../model-capabilities.js";

const ALLOWED_LOCAL_ORIGINS = [
  "http://127.0.0.1:5501",
  "http://localhost:5500",
  "http://localhost:5501",
  "http://127.0.0.1:5500"
];

function setCorsHeaders(req, res) {
  const origin = req.headers.origin;
  let allowOrigin = "*";

  if (origin) {
    const isLocalDev = ALLOWED_LOCAL_ORIGINS.includes(origin) ||
                       /^http:\/\/(localhost|127\.0\.0\.1):(5500|5501|3000|5173)$/.test(origin);
    const isVercelProd = origin.endsWith(".vercel.app") || origin.includes("astro-explorer");

    if (isLocalDev || isVercelProd) {
      allowOrigin = origin;
    }
  }

  res.setHeader("Access-Control-Allow-Origin", allowOrigin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
}

export default async function handler(req, res) {
  // CORS Headers
  setCorsHeaders(req, res);

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
    const isGroqModel = requestedModel.toLowerCase().includes("llama") ||
                        requestedModel.toLowerCase().includes("gpt-oss") ||
                        requestedModel.toLowerCase().includes("qwen3.6") ||
                        requestedModel.toLowerCase().includes("groq");
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
 * Format messages according to model capabilities.
 * For text-only models, enforces messages[].content to be a plain string.
 */
function sanitizeMessagesForModel(messages, modelId) {
  const cap = getModelCapability(modelId);
  if (!Array.isArray(messages)) return [];

  return messages.map(msg => {
    if (!msg || typeof msg !== "object") return msg;

    if (typeof msg.content === "string") return msg;

    if (Array.isArray(msg.content)) {
      if (cap.image) {
        return msg;
      } else {
        // Model is text-only: Flatten array content into a single plain string
        let textParts = [];
        let imageNotice = "";

        for (const part of msg.content) {
          if (part.type === "text") {
            if (part.text) textParts.push(part.text);
          } else if (part.type === "image_url") {
            imageNotice += " [Attached Image - text-only model]";
          }
        }

        const plainContent = textParts.join("\n\n") + imageNotice;
        return {
          ...msg,
          content: plainContent
        };
      }
    }

    return {
      ...msg,
      content: String(msg.content || "")
    };
  });
}

/**
 * Handle requests via Groq API (OpenAI-compatible)
 */
async function handleGroqRequest(body, apiKey, res) {
  try {
    const rawModel = body.model || "llama-3.3-70b-specdec";
    const modelName = rawModel.replace(/^groq\//, "");
    const sanitizedMessages = sanitizeMessagesForModel(body.messages, rawModel);

    const groqPayload = {
      model: modelName,
      messages: sanitizedMessages,
      temperature: typeof body.temperature === "number" ? body.temperature : 0.7
    };

    if (typeof body.max_tokens === "number") {
      groqPayload.max_tokens = body.max_tokens;
    }

    console.log("⚡ [Groq API] Calling chat/completions with model:", modelName, "Sanitized Payload:", sanitizeLogObject(groqPayload));

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

    const rawModel = body.model || "gemini-3.7-flash";
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

    console.log("🤖 [Google AI Studio] Calling generateContent with model:", modelName, "Sanitized Contents:", sanitizeLogObject(contents));

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
    const rawModel = body.model || "openai/gpt-4o-mini";
    const sanitizedMessages = sanitizeMessagesForModel(body.messages, rawModel);

    const openRouterPayload = {
      ...body,
      messages: sanitizedMessages
    };
    if (typeof openRouterPayload.provider !== "object" || openRouterPayload.provider === null) {
      delete openRouterPayload.provider;
    }

    console.log("⭐ [OpenRouter API Request] Final Model Slug:", rawModel);
    console.log("⭐ [OpenRouter API] Calling chat/completions with model:", rawModel, "Sanitized Payload:", sanitizeLogObject(openRouterPayload));

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey || ""}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://astro-explorer.vercel.app",
        "X-Title": "Astro AI"
      },
      body: JSON.stringify(openRouterPayload)
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