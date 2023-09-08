import {expect, test} from '@oclif/test'

describe('collab/join', () => {
  test
  .stdout()
  .command(['collab/join'])
  .it('runs hello', ctx => {
    expect(ctx.stdout).to.contain('hello world')
  })

  test
  .stdout()
  .command(['collab/join', '--name', 'jeff'])
  .it('runs hello --name jeff', ctx => {
    expect(ctx.stdout).to.contain('hello jeff')
  })
})
