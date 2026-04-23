declare module 'nodemailer' {
  export interface TransportOptions {
    host?: string;
    port?: number;
    secure?: boolean;
    auth?: { user?: string; pass?: string };
    service?: string;
    [key: string]: any;
  }

  export interface MailOptions {
    from?: string;
    to?: string | string[];
    cc?: string | string[];
    bcc?: string | string[];
    subject?: string;
    text?: string;
    html?: string;
    attachments?: Array<{ filename?: string; content?: Buffer | string; path?: string }>;
    [key: string]: any;
  }

  export interface SentMessageInfo {
    messageId?: string;
    accepted?: string[];
    rejected?: string[];
    response?: string;
    [key: string]: any;
  }

  export interface Transporter {
    sendMail(options: MailOptions): Promise<SentMessageInfo>;
    verify(): Promise<boolean>;
  }

  export function createTransport(options: TransportOptions | string): Transporter;
}
