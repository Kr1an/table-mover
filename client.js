const conn = {
  sock: null,
  gameState: null,
  config() {
    const udp = require('dgram')
    this.sock = udp.createSocket('udp4')
    this.sock.on('message', this.onMsg.bind(this))
    setInterval(() => this.send({ heartbeat: true }), 1000)
  },
  onMsg(raw, sender) {
    console.log('onMsg', sender, raw)
    const data = JSON.parse(raw.toString())
    if (data.setState)
      this.gameState = data.state
  },
  send(obj) {
    console.log('send', obj)
    this.sock.send(
      Buffer.from(JSON.stringify(obj)),
      8000,
      'localhost',
    )
  },
}

const ui = {
  config() {
    setInterval(this.render.bind(this), 100)
  },
  render() {
    if (!conn.gameState) return
    const {
      user,
      otherUsers,
    } = conn.gameState
    const allUsers = [user, ...otherUsers || []]
    if (!user || !otherUsers) return
    const map = new Array(10).fill([]).map(x => new Array(10).fill(' '))
    otherUsers
      .filter(x => x.geo && x.geo.length === 2)
      .forEach(x => map[x.geo[0]][x.geo[1]] = '○')
    if (!user.geo) return
    map[user.geo[0]][user.geo[1]] = '⬤'
    console.clear()
    console.table(map, map.map((_, idx) => idx))
    console.log('\n'.repeat(3))
    console.log('You:', user.id)
    console.log('Scores:')
    console.table(allUsers
      .filter(u => u.createMs)
      .sort((a, b) => a.createMs > b.createMs)
      .map(x => ({
        id: x.id,
        score: x.score || 0,
        'live(sec)': Math.round((Date.now() - x.createMs) / 1000)
      }))
    )
  },
}

const input = {
  onKeyPress(name) {
    const gameState = conn.gameState
    if (!gameState) return
    const geo = gameState.user.geo
    if (name === 'up') 
      geo[0] = Math.max(0, geo[0] - 1)
    if (name === 'down')
      geo[0] = Math.min(9, geo[0] + 1)
    if (name === 'right')
      geo[1] = Math.min(9, geo[1] + 1)
    if (name === 'left')
      geo[1] = Math.max(0, geo[1] - 1)
    conn.send({ setGeo: true, geo })
  },
  config() {
    const readline = require('readline');
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.on('keypress', (_, key) => {
      if (key.ctrl && key.name === 'c')
        process.exit()
      else
        this.onKeyPress(key.name)
    });
  }
}

conn.config()
ui.config()
input.config()
