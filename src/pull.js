'use strict'

/* eslint-env mocha */

const Pushable = require('pull-pushable')

const pull = require('pull-stream')
const _pull = module.exports

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
  re.forEach(r => (s = s.replace(r[0], r[1])))
  return s
}

let decodeRegex = [
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
let encodeRegex = [
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
  decodeRegex.push([new RegExp(map[decoded].replace(/\\/g,"\\\\"), "g"), decoded]) // /encoded/g -> decoded
  encodeRegex.push([new RegExp(decoded.replace(/\\/g,"\\\\"), "g"), map[decoded]]) // /decoded/g -> encoded
} */

_pull.splitCRLF = () => {
  let data = ''
  let source = Pushable()

  return {
    source,
    sink: pull.drain(chunk => {
      data += chunk || ''
      let lines = data.split('\n\r')
      data = lines.pop()
      lines.forEach(l => source.push(l))
    }, err => {
      if (data) source.push(data)
      data = null
      source.end(err)
    })
  }
}

_pull.parser = function Parser () {
  let loc = -2
  let source = Pushable()

  return {
    source,
    sink: pull.drain(line => {
      if (loc) {
        loc++
        if (!line.startsWith('error')) return
      }
      let res = line.split('|').map(line => {
        line = line.split(' ')
        let res = {}
        line.forEach(line => {
          const eqPos = line.indexOf('=')
          if (eqPos !== -1) {
            const key = escaper(line.substr(0, eqPos), decodeRegex)
            let val = escaper(line.substr(eqPos + 1), decodeRegex)
            if (parseInt(val, 10) == val) val = parseInt(val, 10)
            res[key] = val
          } else {
            res[line] = true
          }
        })
        return res
      })
      source.push(res)
    }, e => source.end(e))
  }
}

_pull.parserServer = function Parser () {
  return pull.map(line => {
    let cmd = line.split(' ').shift()
    let res = line.split(' ').slice(1).join(' ').split('|').map(line => {
      line = line.split(' ')
      let res = {}
      line.forEach(line => {
        const eqPos = line.indexOf('=')
        if (eqPos !== -1) {
          const key = escaper(line.substr(0, eqPos), decodeRegex)
          let val = escaper(line.substr(eqPos + 1), decodeRegex)
          if (parseInt(val, 10) == val) val = parseInt(val, 10)
          res[key] = val
        } else {
          res[line] = true
        }
      })
      return res
    })
    return {
      cmd,
      data: res
    }
  })
}

_pull.packer = () => pull.map(data => {
  if (!Array.isArray(data.args)) data.args = [data.args]
  return data.cmd + ' ' + data.args.map(data => [(data.bools || []).map(d => escaper(d, encodeRegex)).join(' '),
    Object.keys(data.args || {}).map(k => escaper(k, encodeRegex) + '=' + escaper(data.args[k], encodeRegex)).join(' ')
  ].filter(e => e.length).join(' ')).join('|')
})

_pull.packerServer = () => pull.map(data => {
  if (!Array.isArray(data)) data = [data]
  return data.map(data => [(data.bools || []).map(d => escaper(d, encodeRegex)).join(' '),
    Object.keys(data.args || {}).map(k => escaper(k, encodeRegex) + '=' + escaper(data.args[k], encodeRegex)).join(' ')
  ].filter(e => e.length).join(' ')).join('|')
})

_pull.addCRLF = () => pull.map(d => d + '\n\r')
