# teamspeak-query-client
[![Build Status](https://travis-ci.org/mkg20001/teamspeak-query-client.svg?branch=master)](https://travis-ci.org/mkg20001/teamspeak-query-client)
[![codecov](https://codecov.io/gh/mkg20001/teamspeak-query-client/branch/master/graph/badge.svg)](https://codecov.io/gh/mkg20001/teamspeak-query-client)

A TeamSpeak Query Client that works.

# Example

```js
const query = new Query({ //you can also leave this blank, then it connects to localhost:10011
  host: "yourserver.de",
  port: 10011
})
query.connect(err => {
  if (err) throw err //Likely connection refused
  query.login("serveradmin", "mysecretpw", err => { //you can also skip login to opperate as guest query
    if (err.id === 520) throw new Error("Invalid Password")
    if (err) throw err //something weird happened
    query.cmd("use", 1, err => { //this is easy and works.
      if (err) throw err //likely no permissions
      query.list("clientlist", ["-uid"], (err, res) => { // "list" ensures res is an array at all time
        if (err) throw err //likely no permissions
        console.log(res)
      })
    })

    query.cmd("servernotifyregister", { event: "server" }, err => { //subscribe to "server" events
      if (err) {
        throw err
      } else {
        query.on("cliententerview", console.log) //user has joined
        query.on("clientleftview", console.log) //user has left
        query.on("notify", console.log) //all the events
      }
    })
  })
})
```

## There are hundreds of ts3 clients. Why write yet another one?

I've seen many ts3 querys for nodeJS. Every client had it's own flaws.

Some didn't even really work, some had trouble dealing with more than one server.

So I've written mine in the hope it works
