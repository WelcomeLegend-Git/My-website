import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../../env";
import { logger } from "../../logger";

export type GenerateOptions = {
  prompt: string;
  imageBase64?: string;
  mimeType?: string;
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
    const models = [this.primaryModel, ...this.fallbackModels];

    for (const model of models) {
      for (let attempt = 0; attempt < this.apiKeys.length; attempt++) {
        try {
          const client = this.client;
          const genModel = client.getGenerativeModel({ model });

          const result = await genModel.generateContent({
            contents: [
              {
                role: "user",
                parts: [
                  { text: options.prompt },
                  ...(options.imageBase64 && options.mimeType
                    ? [
                        {
                          inlineData: {
                            data: options.imageBase64,
                            mimeType: options.mimeType,
                          },
                        },
                      ]
                    : []),
                ],
              },
            ],
          });

          const text = result.response.text();
          return { text, model, apiKeyIndex: this.keyIndex };
        } catch (error) {
          logger.warn({ error, model, keyIndex: this.keyIndex }, "Gemini API call failed, rotating key");
          this.rotateKey();
        }
      }
    }

    throw new Error("All Gemini API keys exhausted");
  }
}

export const geminiClient = new GeminiClient();