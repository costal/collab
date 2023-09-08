import {Command, Flags} from '@oclif/core'

export default class CollabJoin extends Command {
  static description = 'describe the command here'

  static examples = [
    '<%= config.bin %> <%= command.id %>',
  ]

  static flags = {
    port: Flags.integer({char: "p", description: "port for server address"})
  }

  static args = [{name: 'address', description: "server host", required: true}]

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(CollabJoin)

    const name = flags.name ?? 'the world'
    this.log(`hello ${name} from C:\\Users\\Asthe\\dev\\nodejs\\collab-cli\\src\\commands\\collab\\join.ts`)
    if (args.address && flags.force) {
      this.log(`you input --force and --file: ${args.address}`)
    }
  }
}
