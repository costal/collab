import { MuduxServer } from "@models/server";
import { isServerType } from "../types";
import { ChatServer, CollabServer, FileServer } from "./remoteTypes";

type ServerEvent =
    | "runServer"
    | "serverShutdown"
;

type RemoteServerEventData = { serverType: string, port: number };

export interface RemoteControllerMessage {
    event: ServerEvent;
    data: RemoteServerEventData;
}

export class RemoteServer<T extends CollabServer> {
    private server: T;
    private static singleton?: RemoteServer<CollabServer>;

    private constructor(server: T) {
        this.server = server;
    }

    getServer() { return this.server; }

    static getInstance() {
        return this.singleton;
    }

    static run(serverType: string, port: number) {
        if (!this.singleton && isServerType(serverType)) {
            let server: CollabServer | undefined = undefined;
            if (serverType === "chat") server = new ChatServer(port);
            if (serverType === "file") server = new FileServer(port);
            this.singleton = new RemoteServer(server!);
            server!
                .on("error", (err) => {
                    process.send?.apply(process, [{ event: "error", data: { id: serverType, error: err } }]);
                })
                .connect(() => {
                    process.on("message", server!.remoteHandler);
                    process.send?.apply(process, [{ event: "running", data: { id: serverType } }]);
                });
        }
    }
}


////////////
//WORKER
const serverType = process.argv[2];
const port = +process.argv[3];
process.on("message", (message: RemoteControllerMessage) => {
    const { event, data } = message;
    switch (event) {
        case "runServer":
            RemoteServer.run(serverType, port);
            break;
        case "serverShutdown":
            RemoteServer.getInstance()?.getServer().close((err) => {
                if (err) 
                    return process.send?.apply(process, [{ 
                        event: "error",
                        data: err 
                    }]);
                process.exit();
            });
            break; 
    }
});

process.send?.apply(process, [{ event: "ready", data: { id: serverType } }]);

process.on("exit", () => {
    process.send?.apply(process, [{ event: "serverShutdown", data: { id: serverType } }])
});