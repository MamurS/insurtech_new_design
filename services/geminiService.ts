import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.API_KEY || '';
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

export const generateClause = async (prompt: string, type: string): Promise<string> => {
  if (!ai) {
    console.warn("Gemini API Key not found. Returning mock response.");
    return "This is a simulated clause generated because no API key was provided. Please configure your API key to use AI features.";
  }

  try {
    const model = 'gemini-3-flash-preview';
    const systemInstruction = `You are an expert insurance underwriter. 
    Your task is to draft a legally sound insurance clause based on the user's request.
    Keep it concise, professional, and standard for the insurance industry.
    Do not add conversational filler. Just output the clause text.`;

    const response = await ai.models.generateContent({
      model,
      contents: `Draft a ${type} clause for: ${prompt}`,
      config: {
        systemInstruction,
        temperature: 0.3, // Low temperature for more deterministic/legal output
      }
    });

    return response.text || "Failed to generate clause.";
  } catch (error) {
    console.error("Error generating clause:", error);
    return "Error communicating with AI service.";
  }
};
