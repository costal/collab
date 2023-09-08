import React, { useState, Suspense } from "react";
import { Box, Text } from "ink";
import SelectInput from "ink-select-input/build";
import { Item } from "ink-select-input/build/SelectInput";
import Spinner from "ink-spinner";
import ErrorBoundary from "@utils/errorboundary";

const serverOptions = [
    { label: "Collaborate", value: "collab" },
    { label: "Host File", value: "host" }
];

const serverDesc = {
    "collab": "Connect to a collaboration server and start synchronizing!",
    "host": "Host text files for collaboration"
};

const isServerType = (value?: string): value is keyof typeof serverDesc => {
    if (!value) return false;
    return value in serverDesc
};

const RemoteViewer = React.lazy(() => import("./RemoteView"));

export const ServerSelection = () => {
    const [itemDesc, setItemDesc] = useState<string>();
    const handleSelect = (item: Item<string>) => {
        setItemDesc(serverDesc[isServerType(item.value) ? item.value : "collab"])
    };
    return (
        <ErrorBoundary>
            <Box flexDirection="column" height="100%" width="60%">
                <Box borderStyle="single" height="25%" justifyContent="center">
                    <Text>Server Selection Test</Text>
                </Box>
                <Box marginTop={1} flexGrow={1} flexDirection="row" justifyContent="space-between">
                    <SelectInput items={serverOptions} onSelect={handleSelect} />
                    <Box alignItems="center" flexDirection="column">
                        <Suspense fallback={<Text color="green"><Spinner /></Text>}>
                            <RemoteViewer />
                        </Suspense>
                        <Text>{itemDesc}</Text>
                    </Box>
                </Box>
            </Box>
        </ErrorBoundary>
    );
}