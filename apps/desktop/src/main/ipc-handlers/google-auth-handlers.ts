import { ipcMain } from 'electron';
import { startGoogleOAuthFlow, getGoogleAuthState, clearGoogleAuth } from '../ai/auth/google-oauth';

export function registerGoogleAuthHandlers(): void {
  ipcMain.handle('google-auth-login', async () => {
    try {
      return await startGoogleOAuthFlow();
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('google-auth-status', async () => {
    try {
      const state = await getGoogleAuthState();
      return { success: true, data: state };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('google-auth-logout', async () => {
    try {
      await clearGoogleAuth();
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });
}
