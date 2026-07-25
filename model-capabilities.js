/**
 * Centralized ModelCapabilities Registry
 * Defines multi-modal capabilities, file support, audio, reasoning, and fallback vision models.
 */

export const MODEL_CAPABILITIES = {
  "google/gemini-3.6-flash": {
    image: true,
    files: true,
    audio: true,
    reasoning: false,
    name: "Gemini 3.6 Flash"
  },
  "google/gemini-3.5-flash": {
    image: true,
    files: true,
    audio: false,
    reasoning: false,
    name: "Gemini 3.5 Flash"
  },
  "llama-3.3-70b-versatile": {
    image: false,
    files: false,
    audio: false,
    reasoning: false,
    fallbackModel: "google/gemini-3.6-flash",
    name: "Llama 3.3 70B"
  },
  "llama-3.1-8b-instant": {
    image: false,
    files: false,
    audio: false,
    reasoning: false,
    fallbackModel: "google/gemini-3.6-flash",
    name: "Llama 3.1 8B Instant"
  },
  "openai/gpt-oss-120b": {
    image: false,
    files: false,
    audio: false,
    reasoning: true,
    fallbackModel: "google/gemini-3.6-flash",
    name: "GPT OSS 120B"
  },
  "qwen/qwen3.6-27b": {
    image: false,
    files: false,
    audio: false,
    reasoning: false,
    fallbackModel: "google/gemini-3.6-flash",
    name: "Qwen 3.6 27B"
  },
  "openai/gpt-4o-mini": {
    image: true,
    files: true,
    audio: false,
    reasoning: false,
    name: "GPT-4o Mini"
  },
  "deepseek/deepseek-v4-flash": {
    image: false,
    files: false,
    audio: false,
    reasoning: false,
    fallbackModel: "google/gemini-3.6-flash",
    name: "DeepSeek V4 Flash"
  },
  "deepseek/deepseek-r1": {
    image: false,
    files: false,
    audio: false,
    reasoning: true,
    fallbackModel: "google/gemini-3.6-flash",
    name: "DeepSeek R1"
  },
  "deepseek/deepseek-chat-v3.1": {
    image: false,
    files: false,
    audio: false,
    reasoning: false,
    fallbackModel: "google/gemini-3.6-flash",
    name: "DeepSeek V3.1"
  },
  "deepseek/deepseek-chat": {
    image: false,
    files: false,
    audio: false,
    reasoning: false,
    fallbackModel: "google/gemini-3.6-flash",
    name: "DeepSeek V3"
  }
};

/**
 * Get capabilities object for a specific model ID with safe defaults
 */
export function getModelCapability(modelId) {
  if (!modelId) return MODEL_CAPABILITIES["google/gemini-3.6-flash"];
  if (MODEL_CAPABILITIES[modelId]) return MODEL_CAPABILITIES[modelId];

  const lower = String(modelId).toLowerCase();
  if (lower.includes("gemini")) {
    return { image: true, files: true, audio: true, reasoning: false, name: modelId };
  }
  if (lower.includes("gpt-4o") || lower.includes("vision") || lower.includes("claude-3")) {
    return { image: true, files: true, audio: false, reasoning: false, name: modelId };
  }
  if (lower.includes("deepseek-r1")) {
    return { image: false, files: false, audio: false, reasoning: true, fallbackModel: "google/gemini-3.6-flash", name: "DeepSeek R1" };
  }
  if (lower.includes("deepseek")) {
    return { image: false, files: false, audio: false, reasoning: false, fallbackModel: "google/gemini-3.6-flash", name: modelId };
  }

  // Default text-only model fallback
  return {
    image: false,
    files: false,
    audio: false,
    reasoning: false,
    fallbackModel: "google/gemini-3.6-flash",
    name: modelId
  };
}

/**
 * Sanitize objects/strings for logging to prevent Base64 flood in dev tools/console
 */
export function sanitizeLogObject(obj) {
  if (!obj) return obj;
  try {
    return JSON.parse(JSON.stringify(obj, (key, value) => {
      if (typeof value === "string") {
        if (value.startsWith("data:image/")) {
          const match = value.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
          const mime = match ? match[1] : "image";
          const sizeBytes = match ? Math.round((match[2].length * 3) / 4) : value.length;
          const sizeMb = (sizeBytes / (1024 * 1024)).toFixed(2);
          return `[Image attached: ${mime} (~${sizeMb} MB)]`;
        }
        if (key === "data" && value.length > 100) {
          const sizeMb = ((value.length * 3) / 4 / (1024 * 1024)).toFixed(2);
          return `[Base64 Data (~${sizeMb} MB)]`;
        }
      }
      return value;
    }));
  } catch (_) {
    return "[Unparseable Log Object]";
  }
}

// Window global binding for browser scripts
if (typeof window !== "undefined") {
  window.MODEL_CAPABILITIES = MODEL_CAPABILITIES;
  window.getModelCapability = getModelCapability;
  window.sanitizeLogObject = sanitizeLogObject;
}
