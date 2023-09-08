import {expect, test} from '@oclif/test'

describe('server/kill', () => {
  test
  .stdout()
  .command(['server/kill'])
  .it('runs hello', ctx => {
    expect(ctx.stdout).to.contain('hello world')
  })

  test
  .stdout()
  .command(['server/kill', '--name', 'jeff'])
  .it('runs hello --name jeff', ctx => {
    expect(ctx.stdout).to.contain('hello jeff')
  })
})
