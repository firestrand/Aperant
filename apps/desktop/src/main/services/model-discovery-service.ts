import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { ensureValidOAuthToken } from '../ai/providers/oauth-fetch';
import { debugLog } from '../../shared/utils/debug-logger';
import type { BuiltinProvider } from '@shared/types/provider-account';

export interface DiscoveredModel {
  id: string;
  display_name: string;
}

interface ModelDiscoveryConfig {
  apiKey?: string;
  authType?: 'oauth' | 'api-key';
  oauthTokenFilePath?: string;
  baseUrl?: string;
}

interface OpenAIModelResponse {
  data?: Array<{
    id?: string;
  }>;
}

interface GoogleModelResponse {
  models?: Array<{
    name?: string;
    displayName?: string;
    supportedGenerationMethods?: string[];
  }>;
}

interface OllamaModelResponse {
  models?: Array<{
    name?: string;
  }>;
}

interface CodexModelCache {
  models?: Array<{
    slug?: string;
    display_name?: string;
    visibility?: string;
  }>;
}

function getCodexTokenFilePath(explicitPath?: string): string | undefined {
  if (explicitPath) return explicitPath;

  const userDataPath = app.getPath('userData');
  const legacyPath = path.join(userDataPath, 'codex-auth.json');
  if (fs.existsSync(legacyPath)) return legacyPath;

  const nestedPath = path.join(userDataPath, 'codex-auth', 'token.json');
  if (fs.existsSync(nestedPath)) return nestedPath;

  return undefined;
}

function getCodexModelCachePath(): string {
  return path.join(app.getPath('home'), '.codex', 'models_cache.json');
}

/**
 * Service to discover available models for various providers.
 */
export class ModelDiscoveryService {
  /**
   * List models for a specific provider and configuration.
   */
  async listModels(
    provider: BuiltinProvider,
    config: ModelDiscoveryConfig
  ): Promise<DiscoveredModel[]> {
    switch (provider) {
      case 'google':
        return this.listGoogleModels(config.apiKey);
      case 'openai':
        if (config.authType === 'oauth') {
          const codexTokenPath = getCodexTokenFilePath(config.oauthTokenFilePath);
          return codexTokenPath ? this.listCodexModels(codexTokenPath) : [];
        }

        return this.listOpenAIModels(config.apiKey);
      case 'ollama':
        return this.listOllamaModels(config.baseUrl);
      case 'anthropic':
        return this.listAnthropicModels(config.apiKey, config.baseUrl);
      case 'openai-compatible':
        return this.listOpenAICompatibleModels(config.apiKey, config.baseUrl);
      default:
        return [];
    }
  }

  private async listOpenAICompatibleModels(apiKey?: string, baseUrl?: string): Promise<DiscoveredModel[]> {
    if (!baseUrl) return [];
    debugLog(`[ModelDiscovery] Listing models for compatible endpoint: ${baseUrl}`);
    try {
      const url = `${baseUrl.replace(/\/+$/, '')}/models`;
      const headers: Record<string, string> = {};
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }
      const response = await fetch(url, { headers });
      if (!response.ok) {
        console.error(`[ModelDiscovery] Compatible API error: ${response.status} ${response.statusText}`);
        return [];
      }
      const data = await response.json() as OpenAIModelResponse;
      debugLog(`[ModelDiscovery] Found ${data.data?.length || 0} compatible models`);
      return (data.data ?? []).flatMap(m => m.id ? [{
        id: m.id,
        display_name: m.id,
      }] : []);
    } catch (error) {
      console.error('[ModelDiscovery] Failed to list compatible models:', error);
      return [];
    }
  }

  private async listGoogleModels(apiKey?: string): Promise<DiscoveredModel[]> {
    if (!apiKey) return [];
    debugLog('[ModelDiscovery] Listing Google models with API key...');
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
      const response = await fetch(url);
      if (!response.ok) {
        console.error(`[ModelDiscovery] Google API error: ${response.status} ${response.statusText}`);
        return [];
      }
      const data = await response.json() as GoogleModelResponse;
      debugLog(`[ModelDiscovery] Found ${data.models?.length || 0} Google models`);
      return (data.models ?? [])
        .flatMap(m => {
          if (!m.name || !m.supportedGenerationMethods?.includes('generateContent')) return [];
          const id = m.name.replace('models/', '');
          return [{
            id,
            display_name: m.displayName || id,
          }];
        });
    } catch (error) {
      console.error('[ModelDiscovery] Failed to list Google models:', error);
      return [];
    }
  }


  private async listOpenAIModels(apiKey?: string): Promise<DiscoveredModel[]> {
    if (!apiKey) return [];
    debugLog('[ModelDiscovery] Listing OpenAI models with API key...');
    try {
      const url = `https://api.openai.com/v1/models`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!response.ok) {
        console.error(`[ModelDiscovery] OpenAI API error: ${response.status} ${response.statusText}`);
        return [];
      }
      const data = await response.json() as OpenAIModelResponse;
      debugLog(`[ModelDiscovery] Found ${data.data?.length || 0} OpenAI models`);
      return (data.data ?? []).flatMap(m => m.id ? [{
        id: m.id,
        display_name: m.id,
      }] : []);
    } catch (error) {
      console.error('[ModelDiscovery] Failed to list OpenAI models:', error);
      return [];
    }
  }

  private async listCodexModels(oauthTokenFilePath: string): Promise<DiscoveredModel[]> {
    try {
      const cachedModels = this.listCodexCachedModels();
      if (cachedModels.length > 0) {
        debugLog(`[ModelDiscovery] Found ${cachedModels.length} Codex models from local cache`);
        return cachedModels;
      }

      const token = await ensureValidOAuthToken(oauthTokenFilePath, 'openai');
      if (!token) {
        console.error('[ModelDiscovery] Failed to get valid Codex OAuth token');
        return [];
      }

      debugLog('[ModelDiscovery] Listing Codex models with OAuth...');
      const url = `https://api.openai.com/v1/models`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        console.error(`[ModelDiscovery] Codex API error: ${response.status} ${response.statusText}`);
        return [];
      }
      const data = await response.json() as OpenAIModelResponse;
      debugLog(`[ModelDiscovery] Found ${data.data?.length || 0} OpenAI models via Codex OAuth`);
      return (data.data ?? []).flatMap(m => m.id ? [{
        id: m.id,
        display_name: m.id,
      }] : []);
    } catch (error) {
      console.error('[ModelDiscovery] Failed to list Codex models:', error);
      return [];
    }
  }

  private listCodexCachedModels(): DiscoveredModel[] {
    try {
      const cachePath = getCodexModelCachePath();
      if (!fs.existsSync(cachePath)) return [];

      const cache = JSON.parse(fs.readFileSync(cachePath, 'utf8')) as CodexModelCache;
      return (cache.models ?? []).flatMap(model => {
        if (!model.slug || model.visibility !== 'list') return [];
        return [{
          id: model.slug,
          display_name: model.display_name || model.slug,
        }];
      });
    } catch (error) {
      console.error('[ModelDiscovery] Failed to read Codex model cache:', error);
      return [];
    }
  }

  private async listOllamaModels(baseUrl?: string): Promise<DiscoveredModel[]> {
    const ollamaUrl = baseUrl || 'http://localhost:11434';
    try {
      const response = await fetch(`${ollamaUrl}/api/tags`);
      if (!response.ok) return [];
      const data = await response.json() as OllamaModelResponse;
      return (data.models ?? []).flatMap(m => m.name ? [{
        id: m.name,
        display_name: m.name,
      }] : []);
    } catch {
      return [];
    }
  }

  private async listAnthropicModels(apiKey?: string, baseUrl?: string): Promise<DiscoveredModel[]> {
    if (!apiKey) return [];
    const anthropicUrl = baseUrl || 'https://api.anthropic.com';
    try {
      const response = await fetch(`${anthropicUrl}/v1/models`, {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        }
      });
      if (!response.ok) return [];
      const data = await response.json() as {
        data?: Array<{ id?: string; display_name?: string }>;
      };
      return (data.data ?? []).flatMap(m => m.id ? [{
        id: m.id,
        display_name: m.display_name || m.id
      }] : []);
    } catch {
      return [];
    }
  }
}

export const modelDiscoveryService = new ModelDiscoveryService();
