declare module 'speakeasy' {
  export interface GeneratedSecret {
    ascii: string;
    hex: string;
    base32: string;
    otpauth_url?: string;
    qr_code_ascii?: string;
    qr_code_hex?: string;
    qr_code_base32?: string;
    google_auth_qr?: string;
  }

  export interface TOTPOptions {
    secret: string;
    encoding?: 'ascii' | 'hex' | 'base32';
    token?: string;
    window?: number;
    step?: number;
    algorithm?: string;
  }

  export function generateSecret(options?: { length?: number; name?: string; issuer?: string; otpauth_url?: boolean }): GeneratedSecret;
  export namespace totp {
    function generate(options: TOTPOptions): string;
    function verify(options: TOTPOptions & { token: string }): boolean;
  }
}
