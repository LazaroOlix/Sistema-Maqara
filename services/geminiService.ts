import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export const getPrinterDiagnosis = async (printerModel: string, problem: string): Promise<string> => {
  if (!apiKey) return "Erro: API Key não configurada.";

  try {
    const prompt = `
      Você é um técnico especialista sênior em manutenção de impressoras (Laser, Jato de Tinta, Térmica, etc.).
      
      Analise o seguinte caso:
      Modelo da Impressora: ${printerModel}
      Problema Relatado: ${problem}

      Forneça um diagnótico técnico preliminar contendo:
      1. Causas prováveis (liste as 3 principais).
      2. Peças que geralmente precisam ser trocadas.
      3. Passos sugeridos para o técnico verificar.
      
      Mantenha a resposta concisa, técnica e profissional, formatada em Markdown simples.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text || "Não foi possível gerar o diagnóstico.";
  } catch (error) {
    console.error("Erro ao chamar Gemini:", error);
    return "Erro ao consultar a IA. Tente novamente mais tarde.";
  }
};

export const generateClientMessage = async (
  clientName: string,
  printerModel: string,
  status: string,
  details: string
): Promise<string> => {
  if (!apiKey) return "Erro: API Key não configurada.";

  try {
    const prompt = `
      Escreva uma mensagem de WhatsApp curta, cordial e profissional para um cliente de uma assistência técnica.
      
      Cliente: ${clientName}
      Equipamento: ${printerModel}
      Status Atual: ${status}
      Detalhes Adicionais: ${details}

      A mensagem deve informar a atualização e orientar o próximo passo (ex: aguardar, vir buscar, aprovar orçamento). Não use hashtags.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text || "Não foi possível gerar a mensagem.";
  } catch (error) {
    console.error("Erro ao chamar Gemini:", error);
    return "Erro ao gerar mensagem.";
  }
};