export type IntegrationId = 'google';

export interface GoogleIntegrationState {
  connected: boolean;
  email: string | null;
  displayName: string | null;
  scopes: string[];
}

export interface IntegrationsState {
  google: GoogleIntegrationState;
}

export const DEFAULT_INTEGRATIONS_STATE: IntegrationsState = {
  google: {
    connected: false,
    email: null,
    displayName: null,
    scopes: [],
  },
};
