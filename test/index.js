"use strict"

const sinon = require("sinon")
const chai = require("chai")
chai.use(require("sinon-chai"))
chai.should()
const expect = chai.expect
const assert = require("assert")

const Query = require("..")
const mod = require("../pull")
const pull = require("pull-stream")
const FakeServer = require("./fake-ts3")

describe("query", () => {
  describe("connection", () => {
    it("should connect and login", next => {
      let fake = new FakeServer({
        login: ["serveradmin", "pw123"]
      })
      const q = new Query()
      q.connectPullStream(fake.createStream(next))
      q.login("serveradmin", "pw123", err => err ? next(err) : true)
      q.disconnect()
    })
  })
})

describe("pull", () => {
  describe("packer", () => {
    it("should pack the login command right", () => {
      pull(
        pull.values([{
          cmd: "login",
          args: {
            bools: ["user", "pw"]
          }
        }]),
        mod.packer(),
        pull.drain(res => expect(res).to.equal("login user pw"))
      )
    })
    it("should pack an array", () => {
      pull(
        pull.values([{
          cmd: "test",
          args: [{
            bools: ["t1"],
            args: {
              test: "1"
            }
          }, {
            bools: ["t2"],
            args: {
              test: "2"
            }
          }]
        }]),
        mod.packer(),
        pull.drain(res => expect(res).to.equal("test t1 test=1|t2 test=2"))
      )
    })
  })

  describe("parser", () => {
    it("should ignore the first messages and only parse the last one", next => {
      pull(
        pull.values(["TS3", "Welcome", "test"]),
        mod.parser(),
        pull.drain(res => assert.deepEqual(res, [{
          test: true
        }]) || next())
      )
    })
    it("should parse arrays", next => {
      pull(
        pull.values(["TS3", "Welcome", "hello|world"]),
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
