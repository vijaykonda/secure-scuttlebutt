var path = require('path')
var Flume = require('flumedb')
var OffsetLog = require('flumelog-offset')
//var LevelView = require('flumeview-level')
var codex = require('level-codec/lib/encodings')
var ViewLevel = require('flumeview-level')
module.exports = function (dir, keys) {
  var log = OffsetLog(path.join(dir, 'log.offset'), 1024*16, codex.json)

  var db = Flume(log, false) //false says the database is not ready yet!
    .use('last', require('./indexes/last')())
    .use('keys', ViewLevel(1, function (data) {
      return [data.key]
    }))
    .use('clock', require('./indexes/clock')())
    .use('feed', require('./indexes/feed')())
    .use('links', require('./indexes/links')(keys))
    .use('time', ViewLevel(1, function (data) {
      return [data.timestamp]
    }))

  db.progress = {}
  var prog = db.progress.indexes = {start: 0, current: 0, target: 0}
  var ts = Date.now()

  db.since(function () {
    prog.target = db.since.value
    if(Date.now() > ts + 100)
      update()
  })

  function update () {
    ts = Date.now()
    //iterate over the current views, so we capture plugins
    //as well as the built ins.
    var current = 0, n = 0
    for(var k in db)
      if(db[k] && 'function' === typeof db[k].since) {
        n++
        current += (db[k].since.value || 0)
      }
    prog.current = ~~(current / n)
    //if the progress bar is complete, move the starting point
    //up to the current position!
    if(prog.start <= 0)
      prog.start = prog.current
    else if(prog.current == prog.target)
      prog.start = prog.target

  }

  // unref is only available when running inside node
  var timer = setInterval(update, 200)
  timer.unref && timer.unref()

  return db
}

