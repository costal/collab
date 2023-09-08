import { MuduxServer } from "@models/server";
import { basename, resolve } from "path";
import fs, { access, readFile, createReadStream } from "fs";

type FileServerAction = 
    | "uploadFile"
    | "uploadDirectory"
;
interface FileServerActionData {
    filename?: string;
    directory?: string;
}

interface ServerIncomingMessage {
    action: string;
    data: any;
}
interface IncomingMessage extends ServerIncomingMessage {
    action: FileServerAction;
    data: FileServerActionData;
}
export class FileServer extends MuduxServer implements RemoteInterface {
    constructor(port: number) {
        super("file", port, { addSocketServer: true });
    }

    remoteHandler(msg: IncomingMessage): void {
        const { action, data } = msg;
        switch (action) {
            case "uploadFile": {
                const { filename } = data;
                this.uploadFile(filename);
                break;
            }
            case "uploadDirectory":
                break;
        }
    }

    private uploadFile(filename: string | undefined) {
        if (!filename) throw "no filename input";
        const filebase = basename(filename ?? "");
        const filepath = resolve(filebase);
        access(filepath, fs.constants.W_OK | fs.constants.R_OK, (err) => {
            if (err) throw err;
            const pathname = `/${filebase}`;
            this
                .handle(pathname, (context) => {
                    readFile(filepath, "utf8", (err, data) => {
                        if (err) {
                            context.res.statusCode = 404;
                            context.res.end();
                        } else context.res.end(data);
                    });
                })
                .socketHandle(pathname, (socket, request, data) => {});
        });
    }
}

export class ChatServer extends MuduxServer implements RemoteInterface {
    constructor(port: number) {
        super("chat", port);
    }

    remoteHandler(msg: IncomingMessage): void {
        throw new Error("Method not implemented.");
    }
}

export interface RemoteInterface {
    remoteHandler(msg: ServerIncomingMessage): void
}

export type CollabServer = ChatServer | FileServer;