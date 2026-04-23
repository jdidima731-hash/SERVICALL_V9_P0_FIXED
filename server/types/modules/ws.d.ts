declare module 'ws' {
  import { EventEmitter } from 'events';
  import { IncomingMessage } from 'http';
  import { Duplex } from 'stream';

  class WebSocket extends EventEmitter {
    static CONNECTING: number;
    static OPEN: number;
    static CLOSING: number;
    static CLOSED: number;
    readyState: number;
    protocol: string;
    url: string;
    constructor(address: string | URL, options?: WebSocket.ClientOptions);
    send(data: string | Buffer | ArrayBuffer | Buffer[], cb?: (err?: Error) => void): void;
    close(code?: number, reason?: string | Buffer): void;
    ping(data?: any, mask?: boolean, cb?: (err: Error) => void): void;
    pong(data?: any, mask?: boolean, cb?: (err: Error) => void): void;
    terminate(): void;
    on(event: 'close', listener: (code: number, reason: Buffer) => void): this;
    on(event: 'error', listener: (err: Error) => void): this;
    on(event: 'message', listener: (data: Buffer | string) => void): this;
    on(event: 'open', listener: () => void): this;
    on(event: string, listener: (...args: any[]) => void): this;
  }

  namespace WebSocket {
    interface ClientOptions {
      headers?: Record<string, string>;
      [key: string]: any;
    }

    class WebSocketServer extends EventEmitter {
      constructor(options?: ServerOptions);
      on(event: 'connection', listener: (socket: WebSocket, request: IncomingMessage) => void): this;
      on(event: string, listener: (...args: any[]) => void): this;
    }

    class Server extends EventEmitter {
      constructor(options?: ServerOptions);
      on(event: 'connection', listener: (socket: WebSocket, request: IncomingMessage) => void): this;
      on(event: string, listener: (...args: any[]) => void): this;
    }

    interface ServerOptions {
      server?: any;
      port?: number;
      path?: string;
      [key: string]: any;
    }
  }

  export = WebSocket;
}
