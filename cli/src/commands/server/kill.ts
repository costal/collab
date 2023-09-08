import {Command, Flags} from '@oclif/core'
import { ServerController } from "@services/server/controller"

export default class ServerKill extends Command {
  static description = 'describe the command here'

  static examples = [
    '<%= config.bin %> <%= command.id %>',
  ]

  public async run(): Promise<void> {
    try {
      (await ServerController.getInstance())
        .shutdown()
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
