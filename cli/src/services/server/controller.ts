import { EventEmitter } from "stream";
import { join, resolve } from "path";
import { fork, Serializable } from "child_process";
import NodeIPC from "node-ipc";
import { render } from "ink";
import { ServerSelection } from "@views/server"
import React from "react";
import { suspendPromise } from "@utils/index";
import { RemoteResponse, ReturnData, ServerType } from "./types";

const workerFile = join(__dirname, "workers", "remoteController");

export class ServerController extends EventEmitter {
    static readonly remoteServerMsgId = "rsc.msg";
    private static singleton: ServerController;

    private ipc?: InstanceType<typeof NodeIPC.IPC>;

    private constructor() {
        super();
    }

    static getInstance(): Promise<ServerController> {
        return new Promise((resolve, reject) => { 
            if (!this.singleton) {
                this.singleton = new ServerController();
                this.attemptRemoteInstanceConnection((err) => {
                    if (err) return this.createRemoteInstance((err) => {
                        if (err) return reject(err);
                        resolve(this.singleton);
                    });
                    resolve(this.singleton);
                });
            } else {
                resolve(this.singleton);
            }
        });
    }

    private static attemptRemoteInstanceConnection(cb: (err?: Error) => void) {
        if (!this.singleton.ipc) this.singleton.ipc = new NodeIPC.IPC();
        let maxRetries = 1;
        let creationAttempted = false;
        this.singleton.ipc.config = { 
            ...this.singleton.ipc.config,
            id: "serverController",
            appspace: "collab.",
            retry: maxRetries,
            maxRetries,
            silent: true
        };
        let proxyCb: typeof cb | undefined = cb;
        this.singleton.ipc.connectTo("remoteServerController", () => {
            this.singleton.ipc?.of.remoteServerController.on("serverController", (event, data) => {
                if (event === "error") {
                    console.log(event, data.error);
                }
            })
            this.singleton.ipc?.of.remoteServerController.on("connect", () => {
                console.log("Server Controller and Remote Controller are now connected!")
                if (proxyCb) {
                    proxyCb();
                    proxyCb = undefined;
                }
            });
            this.singleton.ipc?.of.remoteServerController.on("error", (err) => {
                if (--maxRetries === 0 && proxyCb) { 
                    proxyCb(err);
                    proxyCb = undefined;
                }
            });
        });
    }

    private static createRemoteInstance(cb: (err?: Error) => void) {
        const worker = fork(workerFile, { stdio: "ignore", detached: true });
        const onWorkerMessage = (msg: Serializable) => {
            if (msg === "processReady") worker.send("run");
            if (msg === "remoteReady") { 
                this.attemptRemoteInstanceConnection((err) => {
                    if (err) return cb(err);
                    worker.off("message", onWorkerMessage);
                    worker.off("error", onWorkerError);
                    worker.unref();
                    worker.disconnect();
                    cb();
                });
            }
        }
        const onWorkerError = (err: Error) => {};
        worker
            .on("message", onWorkerMessage)
            .on("error", onWorkerError);
    }

    private testing = 0;
    private etest = 0;
    private commandEmitter(id: string, args?: any) {
        return new Promise((resolve, reject) => { 
            console.log("Emitting", this.etest++);
            const commandId = ServerController.remoteServerMsgId;
            this.ipc?.of.remoteServerController.emit(commandId, {
                event: id,
                data: { ...args }
            });
            const returnId = commandId + `-${id}:${args?.name ?? "all"}`;
            this.ipc?.of.remoteServerController.on(returnId, (resp: RemoteResponse) => {
                const { state, data } = resp;
                switch (state) {
                    case "success":
                        console.log("Success", data, this.testing++);
                        return resolve(data?.payload);
                    case "failure":
                        return reject(new Error("failure"));
                }
            });
        });
    }
    
    static async completeSession() {
        await ServerController.getInstance()
            .then((controller) => controller.ipc?.disconnect("remoteServerController"));
    }

    //////
    // TODO: CREATE COMMAND ACTION OBJECT FOR GENERIC INPUT OF ACTIONS

    createServer(server: ServerType, port: number) {
        return suspendPromise(this.commandEmitter("runRemote", { server, port }));
    }

    uploadFile(filename: string) {
        return suspendPromise(this.commandEmitter("uploadFile", { input: filename }));
    }

    shutdown(server?: ServerType) {
        return suspendPromise(this.commandEmitter("shutdown", { server }));
    }

    remoteView() {
        return suspendPromise(this.commandEmitter("remoteView"));            
    }

    renderServerSelection() {
        render(React.createElement(ServerSelection));
    }
}