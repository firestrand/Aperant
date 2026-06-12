/**
 * Google Gemini OAuth PKCE Authentication
 *
 * Handles the full OAuth 2.0 PKCE flow for Google Gemini subscriptions.
 * Works similarly to Codex OAuth but with Google endpoints and scopes.
 */

import { shell } from 'electron';
import crypto from 'node:crypto';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { urlToHttpOptions } from 'node:url';
import { app } from 'electron';

// =============================================================================
// Constants & Configuration
// =============================================================================

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const SCOPES = 'https://www.googleapis.com/auth/generative-language email profile';
const REDIRECT_PORT = 14551; // Unique port for Google
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}`;

// Client ID for the Aperant Desktop app
// Note: In a production app, these should be securely managed or injected.
const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID ?? '';
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? '';

const OAUTH_FLOW_TIMEOUT_MS = 30 * 60 * 1000;

export interface GoogleAuthResult {
  success: boolean;
  data?: {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    email?: string;
  };
  error?: string;
}

// =============================================================================
// Token Storage
// =============================================================================

async function getTokenFilePath(): Promise<string> {
  const userDataPath = app.getPath('userData');
  const tokenDir = path.join(userDataPath, 'google-auth');
  if (!fs.existsSync(tokenDir)) {
    fs.mkdirSync(tokenDir, { recursive: true });
  }
  return path.join(tokenDir, 'token.json');
}

// =============================================================================
// PKCE Helpers
// =============================================================================

function base64URLEncode(str: Buffer): string {
  return str.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function sha256(buffer: string): Buffer {
  return crypto.createHash('sha256').update(buffer).digest();
}

// =============================================================================
// OAuth Flow
// =============================================================================

export async function startGoogleOAuthFlow(): Promise<GoogleAuthResult> {
  if (!CLIENT_ID) {
    return {
      success: false,
      error: 'Google OAuth is not configured for this build. Use a Google API key account instead.',
    };
  }

  const codeVerifier = base64URLEncode(crypto.randomBytes(32));
  const codeChallenge = base64URLEncode(sha256(codeVerifier));
  const state = crypto.randomBytes(16).toString('hex');

  const authUrl = new URL(AUTH_ENDPOINT);
  authUrl.searchParams.append('client_id', CLIENT_ID);
  authUrl.searchParams.append('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.append('response_type', 'code');
  authUrl.searchParams.append('scope', SCOPES);
  authUrl.searchParams.append('state', state);
  authUrl.searchParams.append('code_challenge', codeChallenge);
  authUrl.searchParams.append('code_challenge_method', 'S256');
  authUrl.searchParams.append('access_type', 'offline');
  authUrl.searchParams.append('prompt', 'consent');

  return new Promise((resolve) => {
    const server = http.createServer(async (req, res) => {
      const requestUrl = new URL(req.url || '', `http://${req.headers.host}`);
      const code = requestUrl.searchParams.get('code');
      const returnedState = requestUrl.searchParams.get('state');

      if (returnedState !== state) {
        res.end('Authentication failed: State mismatch.');
        resolve({ success: false, error: 'State mismatch' });
        server.close();
        return;
      }

      if (!code) {
        res.end('Authentication failed: No code received.');
        resolve({ success: false, error: 'No code received' });
        server.close();
        return;
      }

      try {
        const tokenResult = await exchangeCodeForTokens(code, codeVerifier);

        // Fetch user info for email
        const userEmail = await fetchUserEmail(tokenResult.access_token);

        const data = {
          accessToken: tokenResult.access_token,
          refreshToken: tokenResult.refresh_token,
          expiresAt: Date.now() + (tokenResult.expires_in * 1000),
          email: userEmail
        };

        const filePath = await getTokenFilePath();
        fs.writeFileSync(filePath, JSON.stringify(data));

        res.end('Authentication successful! You can close this window.');
        resolve({ success: true, data });
      } catch (err) {
        res.end(`Authentication failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
        resolve({ success: false, error: err instanceof Error ? err.message : 'Token exchange failed' });
      } finally {
        server.close();
      }
    });

    server.listen(REDIRECT_PORT, () => {
      shell.openExternal(authUrl.toString());
    });

    setTimeout(() => {
      server.close();
      resolve({ success: false, error: 'OAuth flow timed out' });
    }, OAUTH_FLOW_TIMEOUT_MS);
  });
}

async function exchangeCodeForTokens(code: string, codeVerifier: string) {
  const body = new URLSearchParams();
  body.append('client_id', CLIENT_ID);
  body.append('client_secret', CLIENT_SECRET);
  body.append('code', code);
  body.append('code_verifier', codeVerifier);
  body.append('redirect_uri', REDIRECT_URI);
  body.append('grant_type', 'authorization_code');

  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token exchange failed: ${errorText}`);
  }

  return response.json();
}

async function fetchUserEmail(accessToken: string): Promise<string | undefined> {
  try {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (response.ok) {
      const data = await response.json();
      return data.email;
    }
  } catch (err) {
    console.error('Failed to fetch user email:', err);
  }
  return undefined;
}

export async function getGoogleAuthState(): Promise<{ isAuthenticated: boolean; email?: string; expiresAt?: number }> {
  try {
    const filePath = await getTokenFilePath();
    if (!fs.existsSync(filePath)) return { isAuthenticated: false };

    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return {
      isAuthenticated: !!data.accessToken,
      email: data.email,
      expiresAt: data.expiresAt
    };
  } catch {
    return { isAuthenticated: false };
  }
}

export async function clearGoogleAuth(): Promise<void> {
  try {
    const filePath = await getTokenFilePath();
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.error('Failed to clear Google auth:', err);
  }
}
