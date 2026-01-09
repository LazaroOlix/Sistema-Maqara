
import { GoogleGenAI } from "@google/genai";

// Lazy-initialization helper to avoid crashes if process.env.API_KEY is missing at runtime
let aiInstance: GoogleGenAI | null = null;

const getAI = () => {
  if (!aiInstance) {
    const apiKey = typeof process !== 'undefined' && process.env ? process.env.API_KEY : '';
    aiInstance = new GoogleGenAI({ apiKey: apiKey || '' });
  }
  return aiInstance;
};

export const getPrinterDiagnosis = async (printerModel: string, problem: string): Promise<string> => {
  try {
    const ai = getAI();
    const prompt = `
      Você é um técnico especialista sênior em manutenção de impressoras.
      Analise o seguinte caso:
      Modelo da Impressora: ${printerModel}
      Problema Relatado: ${problem}

      Forneça um diagnótico técnico preliminar contendo:
      1. Causas prováveis (3 principais).
      2. Peças que geralmente precisam ser trocadas.
      3. Passos sugeridos para verificação.
      Mantenha a resposta concisa em Markdown.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text || "Não foi possível gerar o diagnóstico.";
  } catch (error) {
    console.error("Erro Gemini:", error);
    return "Erro ao consultar a IA.";
  }
};

export const generateClientMessage = async (
  clientName: string,
  printerModel: string,
  status: string,
  details: string
): Promise<string> => {
  try {
    const ai = getAI();
    const prompt = `
      Escreva uma mensagem de WhatsApp curta e profissional para um cliente de assistência técnica.
      Cliente: ${clientName}
      Equipamento: ${printerModel}
      Status Atual: ${status}
      Detalhes Adicionais: ${details}
      Se o status for 'Pronto', diga que já pode retirar. Se for 'Entregue', agradeça a preferência.
      Não use hashtags.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text || "Mensagem não gerada.";
  } catch (error) {
    console.error("Erro Gemini:", error);
    return "Erro ao gerar mensagem.";
  }
};
