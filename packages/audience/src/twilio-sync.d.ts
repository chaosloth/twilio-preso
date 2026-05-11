declare module 'twilio-sync' {
  export interface SyncClientOptions {
    logLevel?: string;
  }

  export interface SyncStream {
    on(event: 'messagePublished', callback: (event: { message: { data: any } }) => void): void;
    publishMessage(message: { data: any }): Promise<void>;
  }

  export interface SyncDocument {
    data: any;
    on(event: 'updated', callback: (event: { data: any }) => void): void;
    update(data: any): Promise<void>;
  }

  export class SyncClient {
    constructor(token: string, options?: SyncClientOptions);
    stream(uniqueName: string): Promise<SyncStream>;
    document(uniqueName: string): Promise<SyncDocument>;
  }
}
