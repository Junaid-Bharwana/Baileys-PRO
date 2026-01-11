
import { GoogleGenAI } from "@google/genai";

export const enhanceMessage = async (prompt: string): Promise<string> => {
  try {
    // Initializing with named parameter 'apiKey'
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
    
    // Using ai.models.generateContent directly with model name and content
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `You are a professional WhatsApp communications assistant. 
      Rewrite the following message to be more engaging, clear, and professional while maintaining the original intent. 
      Keep it concise for WhatsApp.
      
      Message: ${prompt}`,
    });

    // Accessing .text property directly (not a method)
    return response.text || prompt;
  } catch (error) {
    console.error("Gemini Enhancement Error:", error);
    return prompt;
  }
};
