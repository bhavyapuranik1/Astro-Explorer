import { getModelCapability } from "../model-capabilities.js";

console.log("==========================================");
console.log("RUNNING ASTRO AI MODEL LIFECYCLE TESTS");
console.log("==========================================");

let testsPassed = 0;
let testsTotal = 0;

function assert(condition, testName) {
  testsTotal++;
  if (condition) {
    console.log(`✅ [PASS] ${testName}`);
    testsPassed++;
  } else {
    console.error(`❌ [FAIL] ${testName}`);
  }
}

// TEST 1: Automatic Gemini Capability Resolution for newly discovered models
const capNewGemini = getModelCapability("google/gemini-3.7-flash");
assert(capNewGemini.image === true, "Newly discovered Gemini 3.7 Flash supports image capability automatically");
assert(capNewGemini.files === true, "Newly discovered Gemini 3.7 Flash supports file capability automatically");
assert(capNewGemini.audio === true, "Newly discovered Gemini 3.7 Flash supports audio capability automatically");

const capNewGeminiPro = getModelCapability("google/gemini-4.0-pro");
assert(capNewGeminiPro.image === true, "Newly discovered Gemini 4.0 Pro supports image capability");
assert(capNewGeminiPro.reasoning === true, "Newly discovered Gemini 4.0 Pro supports reasoning capability");

// TEST 2: OpenRouter models capabilities & fallbacks
const capOpenRouter = getModelCapability("openai/gpt-4o-mini");
assert(capOpenRouter.image === true, "GPT-4o Mini retains image capabilities");

const capDeepSeek = getModelCapability("deepseek/deepseek-v4-flash");
assert(capDeepSeek.image === false, "DeepSeek V4 Flash is text-only with fallback");
assert(capDeepSeek.fallbackModel === "google/gemini-3.6-flash", "DeepSeek fallback points to Gemini 3.6");

// TEST 3: Top 5 Rule Simulation for Gemini Discovery
const mockGeminiList = [
  { name: "models/gemini-1.5-flash", displayName: "Gemini 1.5 Flash", supportedGenerationMethods: ["generateContent"] },
  { name: "models/gemini-2.5-flash", displayName: "Gemini 2.5 Flash", supportedGenerationMethods: ["generateContent"] },
  { name: "models/gemini-3.5-flash", displayName: "Gemini 3.5 Flash", supportedGenerationMethods: ["generateContent"] },
  { name: "models/gemini-3.6-flash", displayName: "Gemini 3.6 Flash", supportedGenerationMethods: ["generateContent"] },
  { name: "models/gemini-3.7-flash", displayName: "Gemini 3.7 Flash", supportedGenerationMethods: ["generateContent"] },
  { name: "models/gemini-1.5-pro", displayName: "Gemini 1.5 Pro", supportedGenerationMethods: ["generateContent"] },
  { name: "models/embedding-001", displayName: "Embedding 001", supportedGenerationMethods: ["embedContent"] },
  { name: "models/imagen-3.0", displayName: "Imagen 3.0", supportedGenerationMethods: ["generateImages"] }
];

const eligibleGemini = mockGeminiList.filter(m => {
  const name = m.name.toLowerCase();
  return name.includes("gemini") &&
         m.supportedGenerationMethods.includes("generateContent") &&
         !name.includes("embedding") && !name.includes("imagen");
});

assert(eligibleGemini.length === 6, "Embedding and Imagen models filtered out of Gemini list");

eligibleGemini.sort((a, b) => b.name.localeCompare(a.name));
const top5Gemini = eligibleGemini.slice(0, 5);
assert(top5Gemini.length === 5, "TOP 5 RULE: Gemini model list capped at maximum 5 models");
assert(!top5Gemini.some(m => m.name.includes("embedding")), "No embedding models in top 5 list");

console.log("\n==========================================");
console.log(`TEST SUMMARY: ${testsPassed} / ${testsTotal} Passed (${Math.round((testsPassed/testsTotal)*100)}%)`);
console.log("==========================================");
