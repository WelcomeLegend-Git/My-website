import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../../env";
import { logger } from "../../logger";

export type ImageData = {
  data: string; // base64 data (with or without prefix)
  mimeType: string;
};

export type GenerateOptions = {
  prompt: string;
  imageBase64?: string; // Single image (legacy support)
  mimeType?: string; // Single image mime type (legacy support)
  images?: ImageData[]; // Multiple images (new way)
  usePremiumOnly?: boolean; // If true, only use gemini-2.5-pro with all API keys
  model?: string;
};

export type GenerateResult = {
  text: string;
  model: string;
  apiKeyIndex: number;
};

export interface IGeminiClient {
  generate(options: GenerateOptions): Promise<GenerateResult>;
}

class GeminiClient implements IGeminiClient {
  private apiKeys = env.GEMINI_API_KEYS;
  private primaryModel = env.GEMINI_MODEL_PRIMARY;
  private fallbackModels = env.GEMINI_FALLBACK_MODELS;

  private keyIndex = 0;

  private get client() {
    const key = this.apiKeys[this.keyIndex % this.apiKeys.length];
    return new GoogleGenerativeAI(key);
  }

  private rotateKey() {
    this.keyIndex = (this.keyIndex + 1) % this.apiKeys.length;
  }

  async generate(options: GenerateOptions) {
    const explicitModel = options.model && !options.usePremiumOnly ? options.model : undefined;
    const models = options.usePremiumOnly
      ? ["gemini-2.5-pro"]
      : explicitModel
      ? [explicitModel]
      : [this.primaryModel, ...this.fallbackModels];

    for (const model of models) {
      for (let attempt = 0; attempt < this.apiKeys.length; attempt++) {
        try {
          const client = this.client;
          const genModel = client.getGenerativeModel({ model });

          // Build parts array - support both single image (legacy) and multiple images (new)
          const parts: any[] = [{ text: options.prompt }];
          
          // Multiple images (new way) - takes priority
          if (options.images && options.images.length > 0) {
            for (const img of options.images) {
              // Remove data URL prefix if present (data:image/...;base64,)
              const cleanData = img.data.includes(',') ? img.data.split(',')[1] : img.data;
              parts.push({
                inlineData: {
                  data: cleanData,
                  mimeType: img.mimeType,
                },
              });
            }
          }
          // Single image (legacy support)
          else if (options.imageBase64 && options.mimeType) {
            parts.push({
              inlineData: {
                data: options.imageBase64,
                mimeType: options.mimeType,
              },
            });
          }

          const result = await genModel.generateContent({
            contents: [
              {
                role: "user",
                parts,
              },
            ],
          });

          const text = result.response.text();
          logger.info({ 
            model, 
            keyIndex: this.keyIndex, 
            premium: options.usePremiumOnly,
            imageCount: options.images?.length || (options.imageBase64 ? 1 : 0)
          }, "Gemini API call succeeded");
          return { text, model, apiKeyIndex: this.keyIndex };
        } catch (error) {
          logger.warn({ error, model, keyIndex: this.keyIndex, premium: options.usePremiumOnly }, "Gemini API call failed, rotating key");
          this.rotateKey();
        }
      }
    }

    throw new Error(options.usePremiumOnly 
      ? "All Gemini 2.5 Pro API keys exhausted" 
      : "All Gemini API keys exhausted");
  }
}

export const geminiClient = new GeminiClient();