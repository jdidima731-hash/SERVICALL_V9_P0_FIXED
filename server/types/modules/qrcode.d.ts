declare module 'qrcode' {
  export function toDataURL(text: string, options?: Record<string, unknown>): Promise<string>;
  export function toString(text: string, options?: Record<string, unknown>): Promise<string>;
  export function toBuffer(text: string, options?: Record<string, unknown>): Promise<Buffer>;
}
