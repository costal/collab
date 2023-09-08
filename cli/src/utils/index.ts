import React, { useCallback, useEffect, useRef } from "react";

type Status = "pending" | "success" | "error";
export type Suspender<T> = { settle(): T }

export const isSuspender = <T>(val: any): val is Suspender<T> => (val as Suspender<T>).settle !== undefined;

const resolveSuspensionCycle = <T>(suspender: Suspender<T>, extResolve?: Function): Promise<T> => {
    return new Promise((resolve, reject) => {
        Promise.resolve(suspender.settle())
            .then((r) => {
                    if (isSuspender(r)) return resolveSuspensionCycle(r, resolve);
                    resolve(r);
                })
            .then((r) => extResolve && extResolve(r))
            .catch((e) => resolve(e));
    });
}

export function suspendPromise<T>(promise: Promise<T>): Suspender<T> {
    let status: Status = "pending";
    let result: T | Error;
    const suspender = promise
        .then((r) => {
                if (isSuspender<T>(r)) return resolveSuspensionCycle<T>(r);
                return r;
            })
        .then(
            (r) => {
                status = "success";
                result = r;
            },
            (e) => {
                status = "error";
                result = e;
            }
        );
    return {
        settle(): T {
            switch (status) {
                case "pending":
                    throw suspender;
                case "error":
                    throw result;
                case "success":
                    return result as T;
            }
        }
    };
}

export function useIntervalAsync<R = unknown>(fn: () => Promise<R>, ms: number) {
    const runningCount = useRef(0);
    const timeout = useRef<number>();
    const mountedState = useRef(false);

    const next = useCallback((handler: TimerHandler) => {
        if (mountedState.current && runningCount.current === 0) {
            timeout.current = setTimeout(handler, ms);
        }
    }, [ms]);

    const run = useCallback(async () => {
        runningCount.current++;
        await fn();
        runningCount.current--;
        next(run);
    }, [fn, next]);

    useEffect(() => {
        mountedState.current = true;
        run();

        return () => {
            mountedState.current = false;
            clearTimeout(timeout.current);
        };
    }, [run]);

    const flush = useCallback(() => {
        clearTimeout(timeout.current);
        return run();
    }, [run]);

    return flush;
}