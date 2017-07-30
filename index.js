"use strict"

const pull = require("pull-stream")
const net = require("net")
const toPull = require("stream-to-pull-stream")
const mods = require("./pull")
const debug = require("debug")
const log = debug("teamspeak-query-client")
const uuid = require("uuid")

const EE = require("events").EventEmitter

function TeamSpeakQueryClient(opt) {
  const self = this

  EE.call(self)

  if (!opt) opt = {}
  opt.host = opt.host || "localhost"
  opt.port = opt.port || 10011

  function queue(cmd, args, cb) {
    /*
    data={
      bool: [] //will be sent as is (encoded)
      keys: {} //will be sent as encoded key=val
    }
    data can also be an array that will be encoded and joined with |
    */
    log("queued", cmd, cmd == "login" ? {
      bool: ["**", "**"]
    } : args)
    que.push({
      data: {
        cmd,
        args
      },
      cb,
      id: uuid()
    })
    self.emit("que:add")
  }

  let que = []

  let ended = false

  let cur = null

  function handler() {
    return {
      sink: function (read) {
        read(null, function next(end, res) {
          if (end) return (ended = end)
          if (ended) return read(ended = end)
          if (!cur) {
            log("got response with no request", res)
            return read(end, next)
          }
          log("got response", res)
          if (res.length == 1 && res[0].error) {
            //error response, done with request
            let err = res[0]
            if (!err.id) cur.err = null
            else {
              cur.err = new Error("ServerError: " + err.msg)
              cur.err.id = err.id
              self.emit("que:done")
            }
            cur.cb(cur.err, cur.resp)
          } else { //result for command
            cur.resp = res
          }
        })
      },
      source: function (end, cb) {
        if (end) {
          ended = true
          return cb(end)
        }

        function doSend() {
          cur = que.shift()
          self.emit("que:do", cur)
          return cb(null, cur.data)
        }

        function send() {
          if (!cur) {
            if (que.length) doSend()
            else self.once("que:add", doSend)
          } else self.once("que:done", send)
        }

        send()
      }
    }
  }

  self.connect = cb => {
    const conn = net.connect(opt.port, opt.host, err => {
      if (err) return cb(err)
      const stream = toPull.duplex(conn)
      self.connected = true
      self.stream = pull( //glue it together
        stream.source,
        mods.byLine(),
        mods.parser(),
        handler(),
        mods.pack(),
        mods.joinLine(),
        stream.sink
      )
      self.emit("connected")
      log("connected", opt)
      cb()
    })
  }

  self.login = (user, pw, cb) => {
    queue("login", {
      bool: [user, pw]
    }, cb)
  }
}

require("util").inherits(TeamSpeakQueryClient, EE)

module.exports = TeamSpeakQueryClient
