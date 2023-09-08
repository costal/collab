import React, { useCallback, useEffect, useRef, useState } from "react";
import { Box, Text } from "ink";
import { ServerController } from "@services/server/controller";
import { Suspender, suspendPromise, useIntervalAsync } from "@utils/index";
import { ServerInfo } from "@services/server/types";

const fetchTestServerInfo = () => {
    return ServerController.getInstance()
        .then((controller) => controller.remoteView())
        .then((suspender) => suspender);
};

const fetchTest = () => {
    return {
        serversInfo: suspendPromise(fetchTestServerInfo())
    };
};

const resource = fetchTest();
const message = () => resource.serversInfo.settle();

////
// This code requires testing - potential memory leak involved

const RemoteView = () => {
    const counter = useRef(0);
    const [suspendedState, setSuspend] = useState<Suspender<Function>>();
    const updateState = useCallback(async () => {
        const suspended = await ServerController.getInstance()
            .then((controller) => controller.remoteView())
            .then((suspender) => suspendPromise(Promise.resolve(() => 
                    suspender.settle() as ServerInfo[])
                ));
        setSuspend(suspended);
    }, []);

    const serversInfo: ServerInfo[] = suspendedState?.settle()() ?? [];

    useIntervalAsync(updateState, 1000);
    
    return (
        <Box>
            {serversInfo.map((serverInfo, index) =>
                <Box key={index} flexDirection="row" justifyContent="space-between">
                    <Text>{serverInfo.id}</Text>
                    <Text>{serverInfo.status}</Text>
                </Box>
            )}
        </Box>
    );
};

export default RemoteView;