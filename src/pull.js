'use strict'

/* eslint-env mocha */
/* eslint-disable */

const queue = require('pull-queue')

const pull = module.exports
const _pull = require('pull-stream')

/* const map = {
  "\\s": " ",
  "\\p": "|",
  "\\n": "\n",
  "\\f": "\f",
  "\\r": "\r",
  "\\t": "\t",
  "\\v": "\v",
  "\\\/": "\/",
  "\\\\": "\\"
} */

function escaper (s, re) {
  s = String(s)
  re.forEach(r => s = s.replace(r[0], r[1]))
  return s
}

let decode_re = [
  [/\\s/g, ' '],
  [/\\p/g, '|'],
  [/\\n/g, '\n'],
  [/\\f/g, '\f'],
  [/\\r/g, '\r'],
  [/\\t/g, '\t'],
  [/\\v/g, '\v'],
  [/\\\//g, '\/'],
  [/\\\\/g, '\\']
]
let encode_re = [
  [/\\/g, '\\\\'],
  [/\//g, '\\/'],
  [/\|/g, '\\p'],
  [/\n/g, '\\n'],
  [/\r/g, '\\r'],
  [/\t/g, '\\t'],
  [/\v/g, '\\v'],
  [/\f/g, '\\f'],
  [/ /g, '\\s']
]
/* for (var decoded in map) {
  decode_re.push([new RegExp(map[decoded].replace(/\\/g,"\\\\"), "g"), decoded]) // /encoded/g -> decoded
  encode_re.push([new RegExp(decoded.replace(/\\/g,"\\\\"), "g"), map[decoded]]) // /decoded/g -> encoded
} */

pull.byLine = function LineByLine () {
  let data = ''
  let ended
  return queue(function (end, chunk, cb) {
    if (ended) return cb(end)
    data += chunk ? chunk : ''
    if (end) {
      if (data) ended = end
      else return cb(end)
    }
    let lines = data.split('\n\r')
    data = ended ? '' : lines.pop()
    return cb(null, lines)
  }, {
    sendMany: true
  })
}

pull.parser = function Parser () {
  let loc = -2
  return queue(function (end, line, cb) {
    if (end) return cb(end)
    if (loc) {
      loc++
      if (!line.startsWith('error')) return cb(null, null)
    }
    let res = line.split('|').map(line => {
      line = line.split(' ')
      let res = {}
      line.forEach(line => {
        const eqPos = line.indexOf('=')
        if (eqPos != -1) {
          const key = escaper(line.substr(0, eqPos), decode_re)
          let val = escaper(line.substr(eqPos + 1), decode_re)
          if (parseInt(val, 10) == val) val = parseInt(val, 10)
          res[key] = val
        } else {
          res[line] = true
        }
      })
      return res
    })
    return cb(null, res)
  })
}

pull.parserServer = function Parser () {
  return queue(function (end, line, cb) {
    if (end) return cb(end)
    let cmd = line.split(' ').shift()
    let res = line.split(' ').slice(1).join(' ').split('|').map(line => {
      line = line.split(' ')
      let res = {}
      line.forEach(line => {
        const eqPos = line.indexOf('=')
        if (eqPos != -1) {
          const key = escaper(line.substr(0, eqPos), decode_re)
          let val = escaper(line.substr(eqPos + 1), decode_re)
          if (parseInt(val, 10) == val) val = parseInt(val, 10)
          res[key] = val
        } else {
          res[line] = true
        }
      })
      return res
    })
    return cb(null, {
      cmd,
      data: res
    })
  })
}

pull.packer = function Packer () {
  return queue(function (end, data, cb) {
    if (end) return cb(end)
    if (!Array.isArray(data.args)) data.args = [data.args]
    return cb(null, data.cmd + ' ' + data.args.map(data => [(data.bools || []).map(d => escaper(d, encode_re)).join(' '),
      Object.keys(data.args || {}).map(k => escaper(k, encode_re) + '=' + escaper(data.args[k], encode_re)).join(' ')
    ].filter(e => e.length).join(' ')).join('|'))
  })
}

pull.packerServer = function Packer () {
  return queue(function (end, data, cb) {
    if (end) return cb(end)
    if (!Array.isArray(data)) data = [data]
    return cb(null, data.map(data => [(data.bools || []).map(d => escaper(d, encode_re)).join(' '),
      Object.keys(data.args || {}).map(k => escaper(k, encode_re) + '=' + escaper(data.args[k], encode_re)).join(' ')
    ].filter(e => e.length).join(' ')).join('|'))
  })
}

pull.joinLine = function JoinLines () {
  return _pull.map(d => d + '\n\r')
}