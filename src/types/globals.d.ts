// Create a type for the roles
export type Roles = 'admin' | 'moderator';

declare global {
  interface CustomJwtSessionClaims {
    metadata: {
      role?: Roles;
      termsAccepted?: boolean;
    };
  }
}

declare global {
  interface Window {
    posthog?: {
      capture: (event: string, properties?: Record<string, any>) => void;
      identify: (userId: string, properties?: Record<string, any>) => void;
      [key: string]: any;
    };
  }
}
