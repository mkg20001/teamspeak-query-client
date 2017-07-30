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
      args: {} //will be sent as encoded key=val
    }
    data can also be an array that will be encoded and joined with |
    */
    log("queued", cmd, cmd == "login" ? "*" : args)
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
          if (end) {
            self.connected = false
            self.emit("disconnect")
            return (ended = end)
          }
          if (ended) return read(ended = end)
          if (res.length == 1 && Object.keys(res[0])[0].startsWith("notify")) {
            //notify event (see "servernotifyregister" command)
            let ev = Object.keys(res[0])[0].substr("notify".length)
            delete res[0]["notify" + ev]
            log("notify", ev, res[0])
            self.emit(ev, res[0])
            self.emit("notify", ev, res[0])
            return read(null, next)
          }
          if (res.length == 1 && res[0].error && (res[0].id == 3352 || res[0].id == 3329)) { //you are flood-banned
            const e = new Error("FloodError: " + res[0].msg)
            e.id = res[0].id
            self.emit("connect:done", e)
            return
          }
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
            }
            cur.cb(cur.err, cur.resp)
            cur = null
            self.emit("que:done")
          } else { //result for command
            cur.resp = res
          }
          return read(null, next)
        })
      },
      source: function (end, cb) {
        if (end) {
          ended = true
          return cb(end)
        }

        function doSend() {
          cur = que.shift()
          log("sending", cur.data.cmd == "login" ? "*" : cur.data)
          self.emit("que:do")
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

  function streamConnect(stream) {
    self.connected = true
    let first = true
    self.stream = pull( //glue it together
      stream.source,
      mods.byLine(),
      pull.map(d => {
        if (first) {
          setTimeout(() => self.emit("connect:done"), 100)
          first = false
        }
        log("raw_in", d)
        return d
      }),
      mods.parser(),
      handler(),
      mods.packer(),
      pull.map(d => {
        log("raw_out", d.startsWith("login") ? "login *** ***" : d)
        return d
      }),
      mods.joinLine(),
      stream.sink
    )
    self.emit("connected")
  }

  self.connect = cb => {
    const conn = net.connect(opt.port, opt.host, err => {
      if (err) return cb(err)

      const stream = toPull.duplex(conn)
      streamConnect(stream)
      log("connected", opt)
      self.once("connect:done", cb)
    })
  }

  self.disconnect = cb => {
    if (!self.connected) return cb()
    queue("quit", {}, cb)
  }

  self.connectStream = stream => streamConnect(toPull.duplex(stream))
  self.connectPullStream = stream => streamConnect(stream)

  self.login = (user, pw, cb) => {
    queue("login", {
      bools: [user, pw]
    }, cb)
  }

  self.cmd = (cmd, args, bools, cb) => {
    if (typeof args == "function") {
      cb = args
      args = {}
      bools = []
    }
    if (typeof bools == "function") {
      cb = bools
      bools = null
    }
    if (Array.isArray(args) && !bools) {
      bools = args
      args = {}
    }
    if (!bools) bools = []
    if (!Array.isArray(bools)) bools = [bools]
    if (typeof args == "number" || typeof args == "string") {
      bools.push(args)
      args = {}
    }
    let res
    if (Array.isArray(args)) {
      res = args.map(a => {
        if (a.args) {
          return a
        } else {
          a = {
            args: a,
            bools: []
          }
        }
      })
    } else {
      res = {
        args,
        bools: bools
      }
    }
    queue(cmd, res, cb)
  }

  self.list = (cmd, args, bools, cb) => {
    self.cmd(cmd, args, bools, (err, res) => {
      if (err) return cb(err)
      if (!res) res = []
      if (!Array.isArray(res)) res = [res]
      cb(null, res)
    })
  }
}

require("util").inherits(TeamSpeakQueryClient, EE)

module.exports = TeamSpeakQueryClient
