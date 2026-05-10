declare module 'twilio-sync' {
  export class SyncClient {
    constructor(token: string);
    stream(uniqueName: string): Promise<SyncStream>;
    document(uniqueName: string): Promise<SyncDocument>;
  }

  export interface SyncStream {
    on(event: 'messagePublished', handler: (event: { message: { data: any } }) => void): void;
    publishMessage(options: { data: any }): Promise<void>;
  }

  export interface SyncDocument {
    on(event: 'updated', handler: (event: { data: any }) => void): void;
  }
}
