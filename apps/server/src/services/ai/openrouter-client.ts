import { logger } from "../../logger";
import { env } from "../../env";

export type OpenRouterChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type OpenRouterGenerateOptions = {
  model: string;
  messages: OpenRouterChatMessage[];
};

export type OpenRouterGenerateResult = {
  text: string;
  model: string;
};

export interface IOpenRouterClient {
  generateChat(options: OpenRouterGenerateOptions): Promise<OpenRouterGenerateResult>;
}

class OpenRouterClient implements IOpenRouterClient {
  private apiKey = env.OPENROUTER_API_KEY;
  private baseUrl = "https://openrouter.ai/api/v1/chat/completions";

  async generateChat(options: OpenRouterGenerateOptions): Promise<OpenRouterGenerateResult> {
    if (!this.apiKey) {
      throw new Error("OPENROUTER_API_KEY is not configured on the server");
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };

    if (env.OPENROUTER_SITE_URL) {
      headers["HTTP-Referer"] = env.OPENROUTER_SITE_URL;
    }
    if (env.OPENROUTER_SITE_NAME) {
      headers["X-Title"] = env.OPENROUTER_SITE_NAME;
    }

    const body = {
      model: options.model,
      messages: options.messages,
    };

    try {
      const response = await fetch(this.baseUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        logger.error({
          status: response.status,
          body: errorText,
          model: options.model,
        }, "OpenRouter API call failed");
        throw new Error(`OpenRouter responded with status ${response.status}`);
      }

      const json = (await response.json()) as any;
      const choice = json.choices?.[0];
      const text: string = choice?.message?.content ?? "";
      const modelUsed: string = json.model ?? options.model;

      logger.info({ model: modelUsed }, "OpenRouter API call succeeded");
      return { text, model: modelUsed };
    } catch (error) {
      logger.warn({ error, model: options.model }, "OpenRouter request failed");
      throw error instanceof Error ? error : new Error("OpenRouter request failed");
    }
  }
}

export const openRouterClient = new OpenRouterClient();
