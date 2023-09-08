export type ReturnData = { event: string; server?: ServerType, payload?: any };
export type ServerInfo = { id: string, status: string };
export type ResponseState = "success" | "failure";
export type RemoteResponse = { state: ResponseState, data: ReturnData };

const ServerType = ["chat", "file"] as const;
export type ServerType = typeof ServerType[number];
export const isServerType = (str?: string): str is ServerType => 
    ServerType.indexOf(str as any) !== -1;