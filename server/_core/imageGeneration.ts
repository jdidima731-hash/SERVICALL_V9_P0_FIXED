/**
 * Image generation helper using OpenAI DALL-E API (official)
 *
 * Example usage:
 *   const { url: imageUrl } = await generateImage({
 *     prompt: "A serene landscape with mountains"
 *   });
 */
import { getOpenAIClient } from "./openaiClient";
import { storagePut } from "../storage";
import { ENV } from "./env";

export type GenerateImageOptions = {
  prompt: string;
  originalImages?: Array<{
    url?: string;
    b64Json?: string;
    mimeType?: string;
  }>;
};

export type GenerateImageResponse = {
  url?: string;
};

export async function generateImage(
  options: GenerateImageOptions
): Promise<GenerateImageResponse> {
  if (!ENV.openaiApiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  // ✅ CORRIGÉ: Initialisation OpenAI avec l'API officielle
  const openai = getOpenAIClient();

  const response = await openai.images.generate({
    model: "dall-e-3",
    prompt: options.prompt,
    n: 1,
    size: "1024x1024",
    response_format: "b64_json",
  });

  const imageData = response.data?.[0];
  if (!imageData || !imageData.b64_json) {
    throw new Error("Image generation returned no data");
  }

  const buffer = Buffer.from(imageData.b64_json, "base64");

  // Save to S3
  const { url } = await storagePut(
    `generated/${Date.now()}.png`,
    buffer,
    "image/png"
  );
  return {
    url,
  };
}
