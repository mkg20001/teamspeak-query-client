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
  describe("pack", () => {
    it("should pack the login command right", () => {
      pull(
        pull.values([{
          cmd: "login",
          args: {
            bools: ["user", "pw"]
          }
        }]),
        mod.pack(),
        pull.drain(res => expect(res).to.equal("login user pw"))
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
