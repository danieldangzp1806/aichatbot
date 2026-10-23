import { GoogleGenAI } from "@google/genai";
import { AnalysisResult, GroundingMetadata, MedicineSummary } from "../types";

// Determine API key safely across build environments
const getApiKey = (): string => {
  if (typeof process !== "undefined" && process.env) {
    if (process.env.API_KEY) return process.env.API_KEY;
    if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  }
  if (typeof import.meta !== "undefined" && (import.meta as any).env) {
    if ((import.meta as any).env.VITE_GEMINI_API_KEY) return (import.meta as any).env.VITE_GEMINI_API_KEY;
    if ((import.meta as any).env.VITE_API_KEY) return (import.meta as any).env.VITE_API_KEY;
  }
  if (typeof window !== "undefined" && (window as any).__GEMINI_API_KEY__) {
    return (window as any).__GEMINI_API_KEY__;
  }
  return "";
};

// Lazy initialization of the Gemini API client so module evaluation never throws in browser
let aiClientInstance: GoogleGenAI | null = null;

export const getAiClient = (): GoogleGenAI => {
  if (aiClientInstance) {
    return aiClientInstance;
  }
  const key = getApiKey();
  if (!key) {
    throw new Error(
      "Gemini API key is not configured. Please ensure GEMINI_API_KEY or API_KEY is set in your Cloud Run or hosting environment."
    );
  }
  aiClientInstance = new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
  return aiClientInstance;
};

// In-memory cache to guarantee deterministic results for identical searches in the same session
const resultCache = new Map<string, AnalysisResult>();

export const getCacheKey = (medicineName: string, marketContext?: string): string => {
  return `${medicineName.trim().toLowerCase()}::${(marketContext || "global").trim().toLowerCase()}`;
};

export const clearSearchCache = () => {
  resultCache.clear();
};

export const createChatSession = () => {
  const ai = getAiClient();
  return ai.chats.create({
    model: "gemini-3.8-flash",
    config: {
      temperature: 0.1,
      tools: [{ googleSearch: {} }],
      systemInstruction:
        "You are RxBOT, a dedicated pharmaceutical master data intelligence assistant for Zuellig Pharma.\n\n" +
        "STRICT DOMAIN SCOPE:\n" +
        "You are exclusively configured to assist with pharmaceutical master data, medicine brand names, active pharmaceutical ingredients (INN), " +
        "WHO 5-level ATC classification codes, authorized commercial pack sizes, dosage forms, clinical dosage regimens, " +
        "Marketing Authorization Holders (MAH), pharmaceutical manufacturers, regulatory approvals, and healthcare distribution logistics.\n\n" +
        "STRICT IRRELEVANCE GUARDRAIL (CRITICAL MANDATE):\n" +
        "You MUST NOT answer any inquiry, question, prompt, or task that is irrelevant to pharmaceutical products, medicines, drugs, or healthcare master data. " +
        "This strictly includes, but is not limited to: general chit-chat, creative writing, poetry, programming/coding outside this setup, math riddles, entertainment, " +
        "sports, politics, weather, recipes, trivia, lifestyle advice, or general open-domain knowledge unrelated to pharmaceutical products.\n\n" +
        "If a user asks anything outside or irrelevant to pharmaceutical and medicine data, you MUST immediately decline politely and redirect them. " +
        "Use this standard refusal response: " +
        "\"I am RxBOT, dedicated strictly to pharmaceutical master data, medicine identification, WHO ATC codes, pack sizes, and regulatory licensing for Zuellig Pharma. I cannot assist with inquiries outside of pharmaceutical and medicine data. Please ask a question related to a medicine or pharmaceutical product.\"\n\n" +
        "GROUNDING:\n" +
        "For all relevant pharmaceutical questions, always use Google Search grounding to retrieve real-time, verified factual information from official regulatory bodies and compendia (WHO CC, FDA, EMA, MIMS, national health authorities).",
    },
  });
};

export const analyzeMedicine = async (
  medicineName: string,
  marketContext?: string,
  forceRefresh: boolean = false
): Promise<AnalysisResult> => {
  const cacheKey = getCacheKey(medicineName, marketContext);

  // If not forcing refresh, return cached result immediately for 100% consistent data analyst reviews
  if (!forceRefresh && resultCache.has(cacheKey)) {
    const cached = resultCache.get(cacheKey)!;
    return {
      ...cached,
      fromCache: true,
    };
  }

  try {
    const marketInstruction = marketContext && marketContext !== "Global"
      ? `Target Market / Jurisdiction: "${marketContext}". Prioritize the Marketing Authorization Holder (MAH), registered packaging configurations, and commercial pack sizes authorized in ${marketContext} (e.g. from local health authority or MIMS). Cross-reference the WHO ATC code globally.`
      : `Target Market / Jurisdiction: Global Reference. Provide the primary international reference standard for packaging and state recognized regional presentations in the SKU matrix.`;

    const prompt = `
      You are an expert pharmaceutical master data analyst verifying drug information for Zuellig Pharma distribution.
      Analyze the pharmaceutical product: "${medicineName}".
      ${marketInstruction}

      GROUNDING & CONSISTENCY PROTOCOL (CRITICAL FOR DETERMINISM):
      To ensure exact data consistency and eliminate discrepancies between searches for the same brand:
      1. INN & ACTIVE INGREDIENT:
         Identify the exact International Nonproprietary Name (INN) / active pharmaceutical ingredient(s) and salt (e.g., cabozantinib (S)-malate).
      2. 5-LEVEL WHO ATC CLASSIFICATION:
         Identify the official 7-character WHO ATC code from the WHO Collaborating Centre for Drug Statistics Methodology.
         Provide the complete 5-level breakdown:
         - Level 1: Anatomical main group
         - Level 2: Therapeutic subgroup
         - Level 3: Pharmacological subgroup
         - Level 4: Chemical subgroup
         - Level 5: Chemical substance (code + INN)
      3. MANUFACTURER & LICENSING LINEAGE:
         Disambiguate:
         - Originator / Patent Holder (e.g., Exelixis)
         - Current global Marketing Authorization Holder (MAH) / Brand Owner (e.g., Ipsen, Takeda, or local licensee)
         - Explicitly note any license transfers, divestments, or M&A with years.
      4. PACK SIZE & SKU MATRIX:
         Brand names often have multiple commercial pack sizes (e.g., Box of 14, 28, 30, 60, or 100).
         - In the SUMMARY block, output the primary/standard reference pack size (or the exact SKU if specified in query).
         - In the "Packaging Specifications & SKU Matrix" section, list ALL recognized authorized pack sizes and packaging types (blisters, bottles) so data analysts can map and reconcile different internal item codes without confusion.
      5. FORMULATION & DOSAGE:
         - Identify physical dosage form (e.g., Film-coated tablet, capsule, vial).
         - State standard adult clinical dosing regimen.

      OUTPUT FORMAT:
      Start your output strictly with the following summary block:

      ===SUMMARY_START===
      Name: [Standardized Brand Name and reference strength if applicable]
      Generic Name: [INN Active Pharmaceutical Ingredient(s)]
      Manufacturer: [Current MAH Company Name. If transferred, add: "(Transferred from [Old Co] in [Year])"]
      ATC Code: [Official 7-character WHO ATC code]
      Pack Size: [Primary standard pack size, e.g., Box of 30 tablets (3x10 blisters)]
      Form: [Physical form, e.g., Film-coated tablet]
      Dosage: [Standard dosing regimen, e.g., 60 mg once daily]
      Market: [${marketContext || "Global Reference"}]
      ===SUMMARY_END===

      Follow the summary block with a rigorous Supporting Information report structured in this EXACT order:

      ## WHO ATC Code Verification & 5-Level Hierarchy
      Present the official 7-character WHO ATC code and the full 5-level WHO classification hierarchy:
      - **Level 1 (Anatomical):** [Code] - [Description]
      - **Level 2 (Therapeutic):** [Code] - [Description]
      - **Level 3 (Pharmacological):** [Code] - [Description]
      - **Level 4 (Chemical):** [Code] - [Description]
      - **Level 5 (Substance):** [Code] - [Description]
      Explain why this code applies to this molecule.

      ## Packaging Specifications & Commercial SKU Catalog
      Catalog all officially authorized commercial packaging presentations (e.g., blister materials, blisters per carton, unit counts, bottle sizes, hospital packs) and registered commercial strengths to enable data analysts to reconcile all variants.

      ## Standard Dosage & Administration Regimen
      Detail the standard clinical dosage regimen, indication-specific administration context, and dosing frequency.

      ## Manufacturer, Licensing & Distribution Rights
      Document the developer/originator, current Marketing Authorization Holder, regional distribution partners (such as Zuellig Pharma in Asia-Pacific where applicable), and historical divestment/transfer dates.

      Use Google Search grounding to retrieve real-time data from official pharmaceutical compendia and regulatory bodies.
    `;

    // temperature: 0 and seed: 42 guarantee deterministic, reproducible outputs
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        temperature: 0,
        seed: 42,
        tools: [{ googleSearch: {} }],
      },
    });

    const candidate = response.candidates?.[0];
    if (!candidate) {
      throw new Error("No response generated. The model might be overloaded or the query was filtered.");
    }

    const fullText = candidate.content?.parts?.map((p) => p.text).join("") || "";
    const groundingMetadata = candidate.groundingMetadata as GroundingMetadata | undefined;

    // Parse the summary block
    const summary: MedicineSummary = {
      name: medicineName,
      genericName: "N/A",
      manufacturer: "N/A",
      atcCode: "N/A",
      packSize: "N/A",
      form: "N/A",
      dosage: "N/A",
      market: marketContext || "Global Reference",
    };

    let details = fullText;

    // Regex to extract the block
    const match = fullText.match(/===SUMMARY_START===([\s\S]*?)===SUMMARY_END===/);

    if (match && match[1]) {
      const summaryText = match[1];

      // Helper to extract line value
      const getValue = (key: string) => {
        const lineRegex = new RegExp(`^${key}:\\s*(.*)$`, "m");
        const lineMatch = summaryText.match(lineRegex);
        return lineMatch && lineMatch[1] && lineMatch[1].trim() !== "" ? lineMatch[1].trim() : "N/A";
      };

      summary.name = getValue("Name") !== "N/A" ? getValue("Name") : medicineName;
      summary.genericName = getValue("Generic Name");
      summary.manufacturer = getValue("Manufacturer");
      summary.atcCode = getValue("ATC Code");
      summary.packSize = getValue("Pack Size");
      summary.form = getValue("Form");
      summary.dosage = getValue("Dosage");
      summary.market = getValue("Market") !== "N/A" ? getValue("Market") : (marketContext || "Global Reference");

      // Remove the summary block from the details text
      details = fullText.replace(match[0], "").trim();

      // Adjust grounding supports indices
      if (groundingMetadata?.groundingSupports) {
        const startIndexOfSummary = match.index || 0;
        const endIndexOfSummary = startIndexOfSummary + match[0].length;

        const adjustedSupports = groundingMetadata.groundingSupports
          .map((support) => {
            const oldStart = support.segment?.startIndex ?? 0;
            const oldEnd = support.segment?.endIndex ?? 0;

            if (oldStart >= endIndexOfSummary) {
              return {
                ...support,
                segment: {
                  ...support.segment,
                  startIndex: oldStart - match[0].length,
                  endIndex: oldEnd - match[0].length,
                },
              };
            }
            return null;
          })
          .filter(Boolean);

        groundingMetadata.groundingSupports = adjustedSupports;
      }
    }

    const result: AnalysisResult = {
      summary,
      details,
      groundingMetadata,
      fromCache: false,
    };

    // Save to cache
    resultCache.set(cacheKey, result);

    return result;
  } catch (error: any) {
    console.error("Gemini API Error:", error);

    if (error.message?.includes("429") || error.status === 429) {
      throw new Error(
        "Rate limit exceeded. If you are on the free tier, please wait a moment before searching again."
      );
    }
    if (error.message?.includes("403") || error.status === 403) {
      throw new Error(
        "Access denied. Please check if your API Key is valid and has Generative Language API permissions enabled."
      );
    }

    throw error;
  }
};
