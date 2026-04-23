declare module 'resend' {
  export interface SendEmailOptions {
    from: string;
    to: string | string[];
    subject: string;
    html?: string;
    text?: string;
    cc?: string | string[];
    bcc?: string | string[];
    reply_to?: string;
    headers?: Record<string, string>;
    attachments?: Array<{ filename: string; content: string | Buffer }>;
    tags?: Array<{ name: string; value: string }>;
  }

  export interface SendEmailResponse {
    id?: string;
    error?: { message: string; name?: string };
  }

  export class Resend {
    constructor(apiKey: string);
    emails: {
      send(options: SendEmailOptions): Promise<SendEmailResponse>;
    };
  }
}
