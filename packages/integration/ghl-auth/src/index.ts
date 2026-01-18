// GHL Auth Integration - Production OAuth Flow

export { GhlOAuthService } from './oauth';
export { OAuthCallbackHandler } from './callback';
export { TokenRefreshService } from './refresh';
export { OAuthStateManager } from './state';

// Factory function for creating the OAuth service stack
export function createGhlAuthServices(tokenVault: any) {
  const oauthService = new GhlOAuthService(tokenVault);
  const callbackHandler = new OAuthCallbackHandler(oauthService);
  const refreshService = new TokenRefreshService(tokenVault);
  const stateManager = new OAuthStateManager();

  return {
    oauthService,
    callbackHandler,
    refreshService,
    stateManager,
  };
}
