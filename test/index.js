"use strict"

const sinon = require("sinon")
const chai = require("chai")
chai.use(require("sinon-chai"))
chai.should()
const expect = chai.expect
const assert = require("assert")

const Query = require("..")
const FakeServer = require("./fake-ts3")

describe("query", () => {
  describe("connection", () => {
    it("should connect and login", next => {
      let fake = new FakeServer({
        login: ["serveradmin", "pw123"]
      })
      const q = new Query()
      q.connectPullStream(fake.createStream(next))
      q.login("serveradmin", "pw123")
    })
  })
})
