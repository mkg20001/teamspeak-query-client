# teamspeak-query-client

A TeamSpeak Query Client that works.

I've seen many ts3 querys for nodeJS, every one with it's own flaws.

Some didn't even really work, some had trouble with more than one server.

This one works FOR SURE.

(Tests to be added... written like 1h ago)

# Example

```js
const query = new Query({ //you can also leave this blank, then it connects to localhost:10011
  host: "yourserver.de",
  port: 10011
})
query.connect(err => {
  if (err) throw err //Likely connection refused
  query.login("serveradmin", "mysecretpw", err => { //you can also skip login to opperate as guest query
    if (err.id === 520) throw new Error("Invalid Password") //obv
    if (err) throw err //something weird happened
    query.cmd("use", 1, err => { //this is easy and works.
      if (err) throw err //likely no permissions
      query.list("clientlist", ["-uid"], (err, res) => { // "list" ensures res is an array at all time
        if (err) throw err //likely no permissions
        console.log(res)
      })
    })
  })
})
```
