import { Command, Flags } from "@oclif/core";
import { ServerController } from "@services/server/controller";

export class Server extends Command {
    static description = "opens up a TUI for server commands";

    static examples = [];

    public async run() {
        await (await ServerController.getInstance()).renderServerSelection();
    }
}