// Preconfigured storage helpers for Manus WebDev templates
// Uses the Biz-provided storage proxy (Authorization: Bearer <token>)

import { ENV } from './_core/env';
import { ResilienceService } from './services/resilienceService';
import { logger } from './infrastructure/logger';

type StorageConfig = { baseUrl: string; apiKey: string };

function getStorageConfig(): StorageConfig {
  const baseUrl = ENV.openaiApiUrl;
  const apiKey = ENV.openaiApiKey;

  if (!apiKey) {
    throw new Error(
      "Storage credentials missing: set OPENAI_API_KEY in environment variables"
    );
  }
  // ✅ CORRIGÉ: Utilisation de l'API officielle OpenAI si pas de baseUrl spécifique
  const resolvedBaseUrl = baseUrl || "https://api.openai.com/v1";

  return { baseUrl: resolvedBaseUrl.replace(/\/+$/, ""), apiKey };
}

function buildUploadUrl(baseUrl: string, relKey: string): URL {
  const url = new URL("v1/storage/upload", ensureTrailingSlash(baseUrl));
  url.searchParams.set("path", normalizeKey(relKey));
  return url;
}

async function buildDownloadUrl(
  baseUrl: string,
  relKey: string,
  apiKey: string
): Promise<string> {
  const downloadApiUrl = new URL(
    "v1/storage/downloadUrl",
    ensureTrailingSlash(baseUrl)
  );
  downloadApiUrl.searchParams.set("path", normalizeKey(relKey));
  
  return ResilienceService.execute(
    async () => {
      const response = await fetch(downloadApiUrl, {
        method: "GET",
        headers: buildAuthHeaders(apiKey),
      });
      if (!response.ok) throw new Error(`Download URL fetch failed: ${response.status}`);
      const data = await response.json();
      return data.url;
    },
    {
      name: "STORAGE_GET_URL",
      module: "SYSTEM"
    }
  );
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function toFormData(
  data: Buffer | Uint8Array | string,
  contentType: string,
  fileName: string
): FormData {
  const blob =
    typeof data === "string"
      ? new Blob([data], { type: contentType })
      : new Blob([data as BlobPart], { type: contentType });
  const form = new FormData();
  form.append("file", blob, fileName ?? "file");
  return form;
}

function buildAuthHeaders(apiKey: string): HeadersInit {
  return { Authorization: `Bearer ${apiKey}` };
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const { baseUrl, apiKey } = getStorageConfig();
  const key = normalizeKey(relKey);
  const uploadUrl = buildUploadUrl(baseUrl, key);
  const formData = toFormData(data, contentType, key.split("/").pop() ?? key);

  return ResilienceService.execute(
    async () => {
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: buildAuthHeaders(apiKey),
        body: formData,
      });

      if (!response.ok) {
        const message = await response.text().catch(() => response.statusText);
        const error = new Error(`Storage upload failed (${response.status} ${response.statusText}): ${message}`);
        (error as { status?: number }).status = response.status;
        throw error;
      }
      const result = await response.json();
      
      logger.info("[Storage] File uploaded successfully", { 
        module: "SYSTEM",
        key,
        size: data.length
      });

      return { key, url: result.url };
    },
    {
      name: "STORAGE_UPLOAD",
      module: "SYSTEM",
      timeoutMs: 30000 // Les uploads peuvent être longs
    }
  );
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string; }> {
  const { baseUrl, apiKey } = getStorageConfig();
  const key = normalizeKey(relKey);
  return {
    key,
    url: await buildDownloadUrl(baseUrl, key, apiKey),
  };
}
