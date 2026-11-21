declare module '@volter/twin-mongodb' {
  export interface TwinServerOptions {
    root?: string;
    port?: number;
    readOnly?: boolean;
  }

  export interface TwinServerInstance {
    port: number;
    url: string;
    stop: () => Promise<void>;
  }

  export function createMongodbTwinServer(options?: TwinServerOptions): Promise<TwinServerInstance>;
}

