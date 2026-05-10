declare module 'twilio-sync' {
  export interface SyncClientOptions {
    logLevel?: string;
  }

  export interface SyncStream {
    on(event: 'messagePublished', callback: (event: { message: { data: any } }) => void): void;
    publishMessage(message: { data: any }): Promise<void>;
  }

  export class SyncClient {
    constructor(token: string, options?: SyncClientOptions);
    stream(uniqueName: string): Promise<SyncStream>;
  }
}
