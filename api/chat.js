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
    const requestedModel = body.model || "google/gemini-2.5-flash";
    const provider = (body.provider || "").toLowerCase();

    const geminiApiKey =
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_AI_STUDIO_API_KEY ||
      process.env.GOOGLE_GENAI_API_KEY;
    const openRouterApiKey = process.env.OPENROUTER_API_KEY;

    // Determine provider routing: All Gemini models are handled EXCLUSIVELY through Google AI Studio
    const isGeminiModel = requestedModel.toLowerCase().includes("gemini");
    const useGemini = provider === "gemini" || provider === "google" || isGeminiModel;

    if (useGemini) {
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
 * Handle requests via Google AI Studio (@google/genai SDK)
 */
async function handleGeminiRequest(body, apiKey, res) {
  try {
    const ai = new GoogleGenAI({ apiKey });

    const rawModel = body.model || "gemini-2.5-flash";
    let modelName = rawModel.replace(/^google\//, "");

    // Map common aliases to valid Google AI Studio model IDs
    if (modelName === "gemini-3.6-flash" || modelName === "gemini-3.5-flash") {
      modelName = "gemini-2.5-flash";
    }

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
    console.error("Google AI Studio Gemini API Error:", err);

    // Rate Limit / Quota Exceeded handling
    if (isQuotaOrRateLimitError(err)) {
      return res.status(429).json({
        error: {
          message: "Google AI Studio free-tier rate limit or quota exceeded. Please wait a moment before trying again or select another model.",
          code: 429,
          type: "rate_limit_exceeded"
        }
      });
    }

    return res.status(err.status || 500).json({
      error: {
        message: err.message || "Failed to generate response from Google AI Studio",
        code: err.status || 500,
        type: "api_error"
      }
    });
  }
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

/**
 * Helper to identify rate-limit or quota exceeded errors from Google AI Studio
 */
function isQuotaOrRateLimitError(err) {
  if (!err) return false;
  const status = err.status || err.statusCode || (err.response && err.response.status);
  const msg = (err.message || String(err)).toLowerCase();

  return (
    status === 429 ||
    msg.includes("429") ||
    msg.includes("resource_exhausted") ||
    msg.includes("quota") ||
    msg.includes("rate limit") ||
    msg.includes("rate_limit") ||
    msg.includes("too many requests")
  );
}