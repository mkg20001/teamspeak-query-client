const queue = require("pull-queue")
const pull = require("pull-stream")
const mod = require("../pull")

const net = require("net")
const toPull = require("stream-to-pull-stream")
const assert = require("assert")

function FakeServer(opt) {
  const self = this

  self.assertOk = () => {
    //throw if something isn't like it should be
  }

  self.createStream = _cb => {
    let client = {}
    const socketToClient = toPull.duplex(new net.Socket())
    const socketToServer = toPull.duplex(new net.Socket())

    assert(_cb, "cb is undefined")

    pull(
      socketToServer.source,
      mod.byLine(),
      mod.parserServer(),
      queue(function (end, data, cb) {
        if (end) {
          try {
            self.assertOk()
          } catch (e) {
            return _cb(e)
          }
          _cb()
          return cb(true)
        }

        function assertError(err) {
          _cb(new Error("TestError: " + err))
          return cb(true)
        }

        if (opt.login && !client.auth) {
          if (data.cmd != "login") return assertError("Did not login")
        }
      }),
      mod.pack(),
      mod.joinLine(),
      socketToClient.sink
    )
    return {
      source: socketToClient.source,
      sink: socketToServer.sink
    }
  }
}

module.exports = FakeServer
