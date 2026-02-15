
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function analyzePresence(base64Image: string): Promise<{
  isPersonPresent: boolean;
  count: number;
  description: string;
}> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: base64Image,
              },
            },
            {
              text: "Analyze this webcam frame for proctoring. Is there exactly one person clearly visible and facing the camera? Return a JSON object with 'isPersonPresent' (boolean), 'count' (number of people), and 'description' (short explanation).",
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isPersonPresent: { type: Type.BOOLEAN },
            count: { type: Type.INTEGER },
            description: { type: Type.STRING },
          },
          required: ["isPersonPresent", "count", "description"],
        },
      },
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Gemini analysis failed:", error);
    return {
      isPersonPresent: true, // Default to true on error to avoid false positives during network issues
      count: 1,
      description: "Analysis failed, assuming safe.",
    };
  }
}
