import { createServer, IncomingMessage, Server } from "http";
import { EventEmitter } from "events";
import { Mudux, HandlerFunc } from "./handler";
import { Server as SocketServer, WebSocket, RawData } from "ws";
import { parse } from "url";

interface SocketServerOptions {
    addSocketServer: boolean;
    isSocketServer?: boolean;
}

interface SocketHandler {
    (
        socket: WebSocket,
        request: IncomingMessage,
        data: RawData
    ): SocketHandler | void;
}

export class MuduxServer extends EventEmitter {
    readonly connection: Server;
    readonly port: Number;
    readonly name: String;

    private mux: Mudux;
    private wss?: SocketServer;
    private socketPaths?: Map<string, SocketHandler>;

    constructor(name: String, port: Number, options?: SocketServerOptions) {
        super();
        this.name = name;
        this.port = port;
        this.mux = new Mudux();
        this.connection = createServer(this.mux.handler);
        this.connection.on("error", (err) => this.emit("error", err));
        if (options?.addSocketServer) this.connectSocketServer(options);
    }

    private connectSocketServer(options: SocketServerOptions) {
        this.socketPaths = new Map<string, SocketHandler>();
        const ssOptions = { 
            server: options.isSocketServer ? this.connection : undefined,
            noServer: !options.isSocketServer
        }
        this.wss = new SocketServer(ssOptions);
        this.wss.on('connection', (ws, request) => {
            const url = new URL(request.url ?? "/", `http://${request.headers.host}`);            
            ws.on('message', (data) => {
                this.socketPaths?.get(url.pathname)?.apply(this, [ws, request, data]);
            });
        });

        this.connection.on("upgrade", (request, socket, head) => {
            const url = new URL(request.url ?? "/", `http://${request.headers.host}`);
            if (this.socketPaths?.has(url.pathname)) 
                this.wss?.handleUpgrade(request, socket, head, (ws) => {
                    ws.emit("connection", ws, request)
                });
        });
    }

    connect(cb?: () => void) {
        this.connection.listen(this.port, cb);
    }

    handle(path: string, handler: HandlerFunc) {
        this.mux.handle(path, handler);
        return this;
    }

    socketHandle(path: string, handler: SocketHandler) {
        this.socketPaths?.set(path, handler);
        return this;
    }

    close(cb?: (err?: Error) => void) {
        this.connection.close(cb);
    }
}