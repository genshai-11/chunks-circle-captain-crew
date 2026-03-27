import { GoogleGenAI, Type } from '@google/genai';
import { db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const evaluateMeaningTransfer = async (
  captainTranscript: string,
  crewTranscript: string
): Promise<{ score: number; feedback: string }> => {
  try {
    let modelName = "gemini-3.1-pro-preview";
    let temperature = 0.7;
    let systemInstruction = undefined;
    let apiUrl = undefined;
    let apiKey = undefined;

    try {
      const settingsDoc = await getDoc(doc(db, 'settings', 'llm'));
      if (settingsDoc.exists()) {
        const data = settingsDoc.data();
        if (data.model) modelName = data.model;
        if (data.temperature !== undefined) temperature = data.temperature;
        if (data.systemInstruction) systemInstruction = data.systemInstruction;
        if (data.apiUrl) apiUrl = data.apiUrl;
        if (data.apiKey) apiKey = data.apiKey;
      }
    } catch (e) {
      console.warn("Could not fetch LLM settings, using defaults.", e);
    }

    if (apiUrl && apiKey) {
      // Use custom OpenAI-compatible endpoint
      const baseUrl = apiUrl.replace(/\/$/, '');
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            {
              role: 'system',
              content: systemInstruction || 'You are an evaluator of meaning transfer from Vietnamese to English. Focus on meaning preservation, not literal translation. Did the core idea survive? Return a JSON object with "score" (number 0-100) and "feedback" (1-2 sentences).'
            },
            {
              role: 'user',
              content: `Evaluate how well the Crew transferred the meaning of the Captain's statement from Vietnamese to English.\n\nCaptain (Vietnamese): "${captainTranscript}"\nCrew (English): "${crewTranscript}"\n\nReturn a JSON object with:\n- score: A number from 0 to 100 representing meaning preservation.\n- feedback: A short, encouraging 1-2 sentence feedback on what was captured well and what was missed.`
            }
          ],
          temperature: temperature,
          response_format: { type: "json_object" }
        })
      });

      if (!response.ok) {
        throw new Error(`Custom API error: ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content || '{}';
      const result = JSON.parse(content);
      return {
        score: result.score || 0,
        feedback: result.feedback || "Could not evaluate.",
      };
    }

    // Fallback to default Gemini API
    const response = await ai.models.generateContent({
      model: modelName,
      contents: `Evaluate how well the Crew transferred the meaning of the Captain's statement from Vietnamese to English.
      
      Captain (Vietnamese): "${captainTranscript}"
      Crew (English): "${crewTranscript}"
      
      Focus on meaning preservation, not literal translation. Did the core idea survive?
      Return a JSON object with:
      - score: A number from 0 to 100 representing meaning preservation.
      - feedback: A short, encouraging 1-2 sentence feedback on what was captured well and what was missed.`,
      config: {
        temperature: temperature,
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: {
              type: Type.NUMBER,
              description: "Meaning preservation score from 0 to 100",
            },
            feedback: {
              type: Type.STRING,
              description: "Short feedback on meaning transfer",
            },
          },
          required: ["score", "feedback"],
        },
      },
    });

    const result = JSON.parse(response.text || '{}');
    return {
      score: result.score || 0,
      feedback: result.feedback || "Could not evaluate.",
    };
  } catch (error) {
    console.error("Error evaluating meaning transfer:", error);
    return { score: 0, feedback: "Error during evaluation." };
  }
};
