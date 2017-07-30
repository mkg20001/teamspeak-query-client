const queue = require("pull-queue")
const pull = require("pull-stream")
const mod = require("../pull")

const assert = require("assert")

function FakeServer(opt) {
  const self = this

  self.assertOk = () => {
    //throw if something isn't like it should be
  }

  self.createStream = _cb => {
    let client = {}
    const socketToClient = queue((end, data, cb) => cb(end, data))
    const socketToServer = queue((end, data, cb) => cb(end, data))

    assert(_cb, "cb is undefined")

    let first = true

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

        function ok(res) {
          if (res) {
            cb(null, [res, [{
              bools: ["error"],
              args: {
                id: 0,
                msg: "ok"
              }
            }]])
          } else {
            cb(null, [
              [{
                bools: ["error"],
                args: {
                  id: 0,
                  msg: "ok"
                }
              }]
            ])
          }
        }

        function err(id, msg) {
          return cb(null, [
            [{
              bools: ["error"],
              args: {
                id,
                msg
              }
            }]
          ])
        }

        if (opt.login && !client.auth) {
          if (data.cmd != "login") return assertError("Did not login")
          if (data.data[0][opt.login[0]] && data.data[0][opt.login[1]]) {
            client.auth = true
            ok()
          } else {
            client.auth = false
            err(512, "wrong username or password")
          }
        }
        switch (data.cmd) {
        case "quit":
          try {
            self.assertOk()
          } catch (e) {
            return _cb(e)
          }
          _cb()
          return cb(true)
          break;
        }
      }, {
        sendMany: true
      }),
      mod.packerServer(),
      queue(function (end, data, cb) {
        if (end) return cb(end)
        if (first)
          cb(null, ["TS3", "Welcome", data])
        else
          cb(null, [data])
      }, {
        sendMany: true
      }),
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