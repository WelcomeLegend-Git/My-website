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
  forceKeyIndex?: number; // Optional: Force usage of a specific key index (useful for parallel pooling)
};

export type GenerateResult = {
  text: string;
  model: string;
  apiKeyIndex: number;
};

export interface IGeminiClient {
  generate(options: GenerateOptions): Promise<GenerateResult>;
  get keyCount(): number;
}

class GeminiClient implements IGeminiClient {
  private apiKeys = env.GEMINI_API_KEYS;
  private primaryModel = env.GEMINI_MODEL_PRIMARY;
  private fallbackModels = env.GEMINI_FALLBACK_MODELS;

  private keyIndex = 0;

  get keyCount() {
    return this.apiKeys.length;
  }

  private getClient(index: number) {
    const key = this.apiKeys[index % this.apiKeys.length];
    return new GoogleGenerativeAI(key);
  }

  async generate(options: GenerateOptions): Promise<GenerateResult> {
    const explicitModel = options.model && !options.usePremiumOnly ? options.model : undefined;
    const models = options.usePremiumOnly
      ? ["gemini-2.5-pro"]
      : explicitModel
        ? [explicitModel]
        : [this.primaryModel, ...this.fallbackModels];

    // Determine starting key index
    let currentKeyIndex =
      options.forceKeyIndex !== undefined
        ? options.forceKeyIndex % this.apiKeys.length
        : this.keyIndex;

    for (const model of models) {
      // Try all keys, starting from currentKeyIndex
      for (let attempt = 0; attempt < this.apiKeys.length; attempt++) {
        // Calculate actual key index for this attempt (round-robin from start)
        const tryKeyIndex = (currentKeyIndex + attempt) % this.apiKeys.length;

        try {
          const client = this.getClient(tryKeyIndex);
          const genModel = client.getGenerativeModel({ model });

          // Build parts array - support both single image (legacy) and multiple images (new)
          const parts: any[] = [{ text: options.prompt }];

          // Multiple images (new way) - takes priority
          if (options.images && options.images.length > 0) {
            for (const img of options.images) {
              // Remove data URL prefix if present (data:image/...;base64,)
              const cleanData = img.data.includes(",") ? img.data.split(",")[1] : img.data;
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
          logger.info(
            {
              model,
              keyIndex: tryKeyIndex,
              premium: options.usePremiumOnly,
              imageCount: options.images?.length || (options.imageBase64 ? 1 : 0),
            },
            "Gemini API call succeeded",
          );

          // Update global key index if we weren't forcing a specific one
          // If we forced a key, keep the global rotation unchanged
          if (options.forceKeyIndex === undefined) {
            this.keyIndex = (tryKeyIndex + 1) % this.apiKeys.length;
          }

          return { text, model, apiKeyIndex: tryKeyIndex };
        } catch (error) {
          logger.warn(
            { error, model, keyIndex: tryKeyIndex, premium: options.usePremiumOnly },
            "Gemini API call failed, trying next key",
          );
          // Continue to next key in the loop
        }
      }
    }

    throw new Error(
      options.usePremiumOnly
        ? "All Gemini 2.5 Pro API keys exhausted"
        : "All Gemini API keys exhausted",
    );
  }
}

export const geminiClient = new GeminiClient();
