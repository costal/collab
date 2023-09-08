import { IncomingMessage, Server, ServerResponse } from "http";

interface HandlerPromise {
    (context: MuduxContext): Promise<HandlerFunc>
}

export interface HandlerFunc {
    (
        context: MuduxContext,
        callback?: (err: Error, data: any) => void | HandlerFunc,
    ): HandlerFunc | void
}

type MuduxMiddleware = { inbound?: HandlerFunc; outbound?: HandlerFunc }

export function createMiddleware(inb: HandlerFunc, out: HandlerFunc): MuduxMiddleware {
    return {
        inbound: inb,
        outbound: out
    }
}

export class MuduxContext {
    readonly req: IncomingMessage;
    readonly res: ServerResponse;

    private url: URL;
    private endFn?: () => Promise<Function>;

    constructor(request: IncomingMessage, response: ServerResponse) {
        const self = this;
        this.url = new URL(request.url ?? "/", `http://${request.headers.host}`)

        const getAux = (valGuard?: (prop: any) => any, ...args: any[]) => {
            const [ target, propKey, receiver ] = args;
            const prop = Reflect.get(target, propKey, receiver);
            if (typeof prop !== "function") {
                return valGuard && valGuard(prop);
            }
            return function(...args: any[]) {
                return prop.apply(receiver, args);
            }
        }

        this.req = new Proxy(request, {
            get(target, propKey, receiver) {
                return getAux(
                    (prop) => (propKey === "url" && self.url) || prop, 
                    propKey, receiver
                );
            }
        });

        this.res = new Proxy(response, {
            get(target, propKey, receiver) {
                const prop = getAux(undefined, target, propKey, receiver);
                if (propKey === "end") {
                    return (...args: any[]) => {
                        self.endFn = () => new Promise((resolve, reject) => { 
                            const end = prop.bind(target);
                            end.apply(receiver, args, (err: Error, data: any) => {
                                if (err) return reject(err);
                                resolve(data);
                            })
                        });
                    };
                }
                return prop;
            }
        });
    }
}

export class MuduxMiddlewareManager {
    private inboundMiddleware: HandlerFunc[];
    private outboundMiddleware: HandlerFunc[];

    constructor() {
        this.inboundMiddleware = [];
        this.outboundMiddleware = [];
    }

    async resolve(context: MuduxContext, handler: HandlerPromise) {
        try {
            for await (const middlewareFunc of this.inboundMiddleware) {
                await middlewareFunc(context)
            }
            await handler(context);
        } catch (err) {
            // face error
        }
    }

    async send(context: MuduxContext, handler: HandlerFunc) {
        try {
            for await (const middlewareFunc of this.outboundMiddleware) {
                await middlewareFunc(context)
            }
        } catch (err) {
            // face error
        }
    }

    use(middleware: MuduxMiddleware) {
        if (middleware.inbound) this.inboundMiddleware.push(middleware.inbound);
        if (middleware.outbound) this.outboundMiddleware.unshift(middleware.outbound);
        return this;
    }
}

export class Mudux {
    private handles: Map<String, HandlerPromise>;
    readonly middlewares: MuduxMiddlewareManager;

    constructor() {
        this.handles = new Map<String, HandlerPromise>();
        this.middlewares = new MuduxMiddlewareManager();
    }

    /**
     * Summary. Nexus for handling server requests via integrated manager
     * Description. Checks for url and maps with handle funcs
     * 
     * @param request 
     * @param response 
     */
    handler(request: IncomingMessage, response: ServerResponse) {
        const handlerFunc = this.handles.get(request.url!);
        if (handlerFunc) {
            const context = new MuduxContext(request, response);
            this.middlewares.resolve(context, handlerFunc);
        }
    }

    handle(path: String, handleFunc: HandlerFunc) {
        this.handles.set(path, (context: MuduxContext) => {
            return new Promise((resolve, reject) => {
                handleFunc(context, (err, data) => {
                    if (err) return reject(err);
                    resolve(data);
                });
            });
        });
        return this;
    }
}