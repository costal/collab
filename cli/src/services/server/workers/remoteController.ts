import { EventEmitter } from "events";
import { Socket } from "net";
import { TaskQueuePC, createTask } from "utils/ds/taskqueue";
import { ChildProcess, fork, spawn } from "child_process";
import { join } from "path";
import NodeIPC from "node-ipc";
import { ServerController } from "../controller";
import { RemoteResponse, ResponseState, ReturnData, ServerType } from "../types";

type RemoteServerEvent = 
    | "runRemote"
    | "shutdown"
    | "remoteView"
;

interface ServerMessage {
    event: RemoteServerEvent | {};
    data: { id: string };
}

interface MessagePacket {
    event: RemoteServerEvent | string;
    data: { server: ServerType, port: number, input: any };
}

const workerFile = join(__dirname, "remoteServer");

export class RemoteServerController {
    private static singleton: RemoteServerController;
    private eventsQueue: TaskQueuePC;
    private servers: Map<string, ChildProcess>;
    private serversStatus: Map<string, boolean>;
    private internalComm: EventEmitter;

    public static readonly MaxServers = 3;

    private constructor() {
        NodeIPC.config.id = "remoteServerController";
        NodeIPC.config.appspace = "collab.";
        NodeIPC.config.retry = 1500;
        this.servers = new Map<string, ChildProcess>();
        this.serversStatus = new Map<string, boolean>();
        this.eventsQueue = new TaskQueuePC();
        this.internalComm = new EventEmitter();
    }

    static getInstance() {
        if (!this.singleton) this.singleton = new RemoteServerController();
        return this.singleton;
    }

    start() {
        NodeIPC.serve(() => {
            NodeIPC.server
                .on("start", () => process.send?.apply(process, ["remoteReady"]))
                .on(ServerController.remoteServerMsgId, this.channelController.bind(this))
                .on("error", (err) => NodeIPC.server.emit("serverController", { event: "error", data: err }));
        });
        NodeIPC.server.start();
    }

    killThemAll(socket?: Socket) {
        this.servers.forEach((worker, key) => { 
            worker.send({ event: "serverShutdown" });
            worker.off("message", this.processServerEvent);
            worker.off("error", this.processServerError);
            worker.kill(9);
        });
        if (socket) {
            const data = { event: "shutdown" };
            this.emitState(this.createSuccessState(data), socket);
        }
        NodeIPC.server.stop();
    }

    private removeServerWorker(id: string) {
        this.servers.delete(id);
        this.serversStatus.set(id, false);
    }

    private channelController(packet: Buffer, socket: Socket) {
        const { event, data } = JSON.parse(JSON.stringify(packet)) as MessagePacket;
        switch ((event)) {
            case "shutdown":
                if (data.server) this.servers.get(data.server)?.send({ event: "serverShutdown" });
                else this.killThemAll(socket);
                break;
            case "runRemote": {
                const returnData: ReturnData = { event: "runRemote", server: data.server };
                if (!this.servers.has(data.server)) {
                    this.setSuccessState("running", returnData, socket);
                    const worker = spawn("node", [workerFile, data.server, ""+data.port], {
                        stdio: ["inherit", "inherit", "inherit", "ipc"],
                        windowsHide: true,
                    });
                    worker
                         .on("message", this.processServerEvent.bind(this))
                         .on("error", this.processServerError.bind(this));
                         this.servers.set(data.server, worker);
                } else {
                    this.emitFailureEvent(returnData, socket);
                }
                break;
            }
            case "uploadFile": {
                if (this.servers.has("file")) {
                    const { input: filename } = data;
                    const fileServer = this.servers.get("file");
                    fileServer!.send({ event: "serve", filename });
                }
                break;
            }
            case "remoteView": {
                const serverStatusList = Array.from(this.serversStatus.entries())
                    .map((entry) => ({ 
                        id: entry[0], 
                        status: (entry[1] ? "online" : "offline")
                    }));
                this.emitState(this.createSuccessState(
                    { 
                        event, 
                        payload: serverStatusList 
                    }),
                    socket
                );
                break;
            }
        }
    }

    private createSuccessState(data: ReturnData): RemoteResponse {
        return { state: "success", data };
    }

    private createFailureState(data: ReturnData): RemoteResponse {
        return { state: "failure", data };
    }

    private emitState(response: RemoteResponse, socket: Socket) {
        const { data } = response;
        const channel = ServerController.remoteServerMsgId + `-${data.event}:${data.server ?? "all"}`;
        NodeIPC.server.emit(
            socket,
            channel,
            response
        )
    }

    private setSuccessState(id: string, data: ReturnData, socket: Socket) {
        this.internalComm.prependOnceListener(id, () => {
            this.emitState(this.createSuccessState(data), socket);
        });
    }

    private emitFailureEvent(data: ReturnData, socket: Socket) {
        this.emitState(this.createFailureState(data), socket);
    }

    private processServerEvent(msg: ServerMessage) {
        const { event, data } = msg;
        switch (event) {
            case "ready":
                this.servers.get(data.id)?.send({ event: "runServer" });
                break;
            case "running":
                this.serversStatus.set(data.id, true);
                break;
            case "serverShutdown":
                this.removeServerWorker(data.id);
                break;
            case "error":
                NodeIPC.server.emit("serverController", { event, data });
                break;
        }
        this.internalComm.emit(event as string);
    }

    private processServerError(err: Error) {
        NodeIPC.server.emit("serverController", { event: "error", data: err });
    }
}

process.on("message", (msg) => {
    if (msg === "run") {
        RemoteServerController.getInstance().start();
    }
});

const cleanupFn = (clean: boolean) => {
    if (clean) RemoteServerController.getInstance().killThemAll();
    else process.exit(0);
};

process.on("exit", () => cleanupFn(true));
process.on("SIGHUP", () => cleanupFn(false));
process.on("SIGINT", () => cleanupFn(false));
process.on("SIGTERM", () => cleanupFn(false));

process.send?.apply(process, ["processReady"]);