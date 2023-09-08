import {Command, Flags} from '@oclif/core';
import { ServerController } from '@services/server/controller';
import { isServerType, ServerType } from '@services/server/types';

export default class ServerInit extends Command {
  static description = 'setup a collab server on a port'

  static examples = [
    '<%= config.bin %> <%= command.id %>',
  ]

  static flags = {
    port: Flags.integer({char: "p", description: "port for server"}),
    // flag with a value (-n, --name=VALUE)
    type: Flags.string({char: 't', description: 'server type'}),
    // flag with no value (-f, --force)
    force: Flags.boolean({char: 'f'}),
  }

  static args = []

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(ServerInit)

    const isType = isServerType(flags.type);
    const serverType: ServerType = isType ? flags.type as ServerType : "file";
    const force = !isType ? true : flags.force;
    const port = flags.port ?? 3001;

    // need to check if server type is running
    // kill running server type if -f is true
    
    try {
      (await ServerController.getInstance())
        .createServer(serverType, port)
        .settle();
    } catch (errOrPromise) {
      Promise.resolve(errOrPromise)
        .then((err) => {
          if (err) console.log(err);
        });
    } finally {
      await ServerController.completeSession();
    }
  }
}
