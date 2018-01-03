'use strict'

// const sinon = require("sinon")
const chai = require('chai')
chai.use(require('sinon-chai'))
chai.should()
const expect = chai.expect
const assert = require('assert')

const Query = require('..')
const mod = require('../pull')
const pull = require('pull-stream')
const FakeServer = require('./fake-ts3')

describe('query', () => {
  describe('connection', () => {
    it('should connect and login', next => {
      let fake = new FakeServer({
        login: ['serveradmin', 'pw123']
      })
      const q = new Query()
      q.connectPullStream(fake.createStream(next))
      q.login('serveradmin', 'pw123', err => err ? next(err) : true)
      q.disconnect()
    })

    it('should login, set the nickname and get the clientlist', next => {
      let fake = new FakeServer({
        login: ['serveradmin', 'pw123']
      })
      let cllist = [{
        args: {
          clid: 1,
          cid: 1,
          client_database_id: 1,
          client_nickname: 'Some Guy'
        }
      },
        {
          args: {
            clid: 2,
            cid: 2,
            client_database_id: 2,
            client_nickname: 'Another Guy'
          }
        }
      ]
      fake.addTarget('clientupdate')
      fake.addTarget('use')
      fake.addTarget('clientlist', cllist)
      fake.addTarget('clientlist', cllist)
      const q = new Query()
      q.connectPullStream(fake.createStream(next))
      q.login('serveradmin', 'pw123', err => err ? next(err) : true)
      q.cmd('clientupdate', {
        client_nickname: 'test'
      }, err => err ? next(err) : true)
      q.cmd('use', 1, err => err ? next(err) : true)
      q.cmd('clientlist', (err, res) => err ? next(err) : assert.deepEqual(cllist.map(c => c.args), res, 'list differs'))
      q.list('clientlist', ['-uid'], (err, res) => err ? next(err) : assert.deepEqual(cllist.map(c => c.args), res, 'list differs'))
      q.disconnect()
    })

    it('should handle notify events', next => {
      let fake = new FakeServer({})
      let testdata = {
        bools: ['notifyclientleftview'],
        args: {
          client_nickname: 'Another guy'
        }
      }
      fake.addTarget('servernotifyregister', testdata)
      const q = new Query()
      q.connectPullStream(fake.createStream(next))
      q.on('clientleftview', res => {
        assert.deepEqual(res, testdata.args, 'event data does not match')
        return q.disconnect()
      })
      q.cmd('servernotifyregister', {
        event: 'server'
      }, err => err ? next(err) : true)
    })

    it('should ignore responses without requests', next => {
      let fake = new FakeServer({})
      let testdata = {
        bools: ['error'],
        args: {
          id: 0,
          msg: 'ok'
        }
      }
      fake.addTarget('servernotifyregister', testdata)
      const q = new Query()
      q.connectPullStream(fake.createStream(next))
      q.cmd('servernotifyregister', {
        event: 'server'
      }, err => err ? next(err) : q.disconnect())
    })

    it('should handle errors', next => {
      let fake = new FakeServer({})
      let testdata = {
        bools: ['error'],
        args: {
          id: 2,
          msg: 'fatal'
        }
      }
      fake.addTarget('servernotifyregister', testdata)
      const q = new Query()
      q.connectPullStream(fake.createStream(next))
      q.cmd('servernotifyregister', {
        event: 'server'
      }, err => expect(() => {
        throw err
      }).to.throw('ServerError: fatal') && q.disconnect())
    })

    it('should handle flood ban', next => {
      const stream = {
        sink: pull.drain(() => {}),
        source: pull.values(['error id=3329 msg=connection\\sfailed,\\syou\\sare\\sbanned extra_msg=you\\smay\\sretry\\sin\\s600\\sseconds'])
      }
      const q = new Query()
      q.once('connect:done', err => expect(() => {
        throw err
      }).to.throw('FloodError: connection failed, you are banned') && next())
      q.connectPullStream(stream)
    })
  })
})

describe('pull', () => {
  describe('packer', () => {
    it('should pack the login command right', () => {
      pull(
        pull.values([{
          cmd: 'login',
          args: {
            bools: ['user', 'pw']
          }
        }]),
        mod.packer(),
        pull.drain(res => expect(res).to.equal('login user pw'))
      )
    })
    it('should pack an array', () => {
      pull(
        pull.values([{
          cmd: 'test',
          args: [{
            bools: ['t1'],
            args: {
              test: '1'
            }
          }, {
            bools: ['t2'],
            args: {
              test: '2'
            }
          }]
        }]),
        mod.packer(),
        pull.drain(res => expect(res).to.equal('test t1 test=1|t2 test=2'))
      )
    })
  })

  describe('parser', () => {
    it('should ignore the first messages and only parse the last one', next => {
      pull(
        pull.values(['TS3', 'Welcome', 'test']),
        mod.parser(),
        pull.drain(res => assert.deepEqual(res, [{
          test: true
        }]) || next())
      )
    })
    it('should parse arrays', next => {
      pull(
        pull.values(['TS3', 'Welcome', 'hello|world']),
        mod.parser(),
        pull.drain(res => assert.deepEqual(res, [{
          hello: true
        }, {
          world: true
        }]) || next())
      )
    })
  })
})
