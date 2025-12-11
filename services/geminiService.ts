
import { GoogleGenAI } from "@google/genai";
import { AnalysisResult, GroundingMetadata, MedicineSummary } from "../types";

// Initialize the API client
// TO ENABLE SCENARIO B (Vertex AI/Paid Tier) explicitly:
// Change the config to: new GoogleGenAI({ apiKey: process.env.API_KEY, vertexAI: true, project: 'your-project-id', location: 'us-central1' });
// For now, we use the standard initialization which works for both AI Studio and Billed Projects via API Key.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const createChatSession = () => {
  return ai.chats.create({
    model: 'gemini-2.5-flash',
    config: {
      tools: [{ googleSearch: {} }],
      systemInstruction: "You are RxBOT, an intelligent pharmaceutical assistant for Zuellig Pharma. Your goal is to help data analysts and pharmacy professionals identify medicines, ATC codes, pack sizes, and dosages accurately. Always use Google Search to verify information. Be helpful, professional, and concise.",
    }
  });
};

export const analyzeMedicine = async (medicineName: string): Promise<AnalysisResult> => {
  try {
    // We cannot use JSON schema with Google Search, so we force a specific text format
    // that we can easily parse manually.
    const prompt = `
      I need detailed product information for the medicine/drug: "${medicineName}".

      STRATEGY FOR ACCURACY:
      1. First, identify the ACTIVE INGREDIENT(S) of this medicine.
      2. Identify the PHARMACEUTICAL COMPANY (Marketing Authorization Holder). Check if the license has been transferred (e.g. divestment from one major pharma to another).
      3. If the user included a location (e.g. "in Taiwan"), use it to find specific Pack Sizes and Forms, but look for the ATC Code globally using the active ingredient if the local product page is missing it.
      4. ATC Code Rule: If the specific brand ATC code is not found, provide the WHO ATC code for the active ingredient/therapeutic class.

      You must start your response with a structured summary block exactly like this:
      
      ===SUMMARY_START===
      Name: [Official Medicine Name]
      Manufacturer: [Current Company Name. If license transferred, add: "(Transferred from [Old Co] in [Year])"]
      ATC Code: [The WHO ATC code. If exact match not found, use code for Active Ingredient]
      Pack Size: [Common pack sizes, e.g., Box of 30, 10x10 strips]
      Form: [Physical form, e.g., Tablet, Capsule, Injection]
      Dosage: [Standard dosage frequency, e.g., Twice daily, Every 4-6 hours]
      ===SUMMARY_END===
      
      After the summary block, provide a SUPPORTING INFORMATION report designed to verify the summary data for a data analyst. 
      Do NOT provide general patient information, side effects, or medical advice unless relevant to identifying the drug. 
      
      Structure the rest of the response strictly as follows to support the summary fields:
      
      ## Manufacturer & Licensing
      Verify the current Marketing Authorization Holder. If there is a history of divestment or license transfer (e.g., from Big Pharma A to Specialty Pharma B), provide the date and details of the transfer.

      ## ATC Verification
      Identify the active ingredient and explicitly explain why the specific ATC code was selected.
      
      ## Packaging Specifications
      Detail the specific packaging configurations found in search results (e.g., blister material, number of blisters per box, unit counts) to validate the Pack Size summary.
      
      ## Formulation Details
      Provide specific details on the pharmaceutical form (e.g., film-coated vs. dispersible, color/shape if known) to validate the Form summary.
      
      ## Dosage Context
      Briefly explain the standard dosing regimen to support the Dosage summary.
      
      IMPORTANT: You MUST use Google Search to find this information to ensure it is accurate and up-to-date.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const candidate = response.candidates?.[0];
    if (!candidate) {
      throw new Error("No response generated. The model might be overloaded or the query was filtered.");
    }

    const fullText = candidate.content?.parts?.map(p => p.text).join('') || "";
    const groundingMetadata = candidate.groundingMetadata as GroundingMetadata | undefined;

    // Parse the summary block
    const summary: MedicineSummary = {
      name: medicineName,
      manufacturer: "N/A",
      atcCode: "N/A",
      packSize: "N/A",
      form: "N/A",
      dosage: "N/A"
    };

    let details = fullText;

    // Regex to extract the block
    const match = fullText.match(/===SUMMARY_START===([\s\S]*?)===SUMMARY_END===/);
    
    if (match && match[1]) {
      const summaryText = match[1];
      
      // Helper to extract line value
      const getValue = (key: string) => {
        const lineRegex = new RegExp(`${key}:\\s*(.*)`);
        const lineMatch = summaryText.match(lineRegex);
        return lineMatch ? lineMatch[1].trim() : "N/A";
      };

      summary.name = getValue("Name") !== "N/A" ? getValue("Name") : medicineName;
      summary.manufacturer = getValue("Manufacturer");
      summary.atcCode = getValue("ATC Code");
      summary.packSize = getValue("Pack Size");
      summary.form = getValue("Form");
      summary.dosage = getValue("Dosage");

      // Remove the summary block from the details text
      details = fullText.replace(match[0], '').trim();
      
      // Adjust grounding supports indices because we removed the summary block.
      // The grounding supports are based on the original fullText.
      // We need to shift the indices of supports that come after the summary block.
      if (groundingMetadata?.groundingSupports) {
         const offset = match[0].length;
         
         const startIndexOfSummary = match.index || 0;
         const endIndexOfSummary = startIndexOfSummary + match[0].length;
         
         const adjustedSupports = groundingMetadata.groundingSupports.map(support => {
            const oldStart = support.segment.startIndex;
            const oldEnd = support.segment.endIndex;
            
            // If the support is entirely after the removed block
            if (oldStart >= endIndexOfSummary) {
                return {
                    ...support,
                    segment: {
                        ...support.segment,
                        startIndex: oldStart - match[0].length,
                        endIndex: oldEnd - match[0].length
                    }
                };
            }
            // If support is before or inside (we don't render it in details panel)
            return null;
         }).filter(Boolean);
         
         groundingMetadata.groundingSupports = adjustedSupports;
      }
    }

    return {
      summary,
      details,
      groundingMetadata,
    };

  } catch (error: any) {
    console.error("Gemini API Error:", error);
    
    // Improved error messages for common billing/quota issues
    if (error.message?.includes('429') || error.status === 429) {
      throw new Error("Rate limit exceeded. If you are on the free tier, please wait a moment. For higher limits, upgrade to a paid billing account.");
    }
    if (error.message?.includes('403') || error.status === 403) {
      throw new Error("Access denied. Please check if your API Key is valid and has the correct permissions (Generative Language API or Vertex AI API enabled).");
    }
    
    throw error;
  }
};
