const udp = require('dgram')

const sock = udp.createSocket('udp4')

const gameState = {
  users: []
}

function identifyClient(client) {
  return client.address + ':' + client.port
}

function onHeartbeat(sender) {
  const id = identifyClient(sender)
  const isUserExist = !!gameState.users.find(x => x.id === id)
  if (!isUserExist)
    gameState.users.push({
      id,
      heartbeat: Date.now(),
      client: sender,
      createMs: Date.now(),
      geo: [0, 0],
      score: 0,
    })
  const userIndex = gameState.users.findIndex(x => x.id === id)
  const user = gameState.users[userIndex]
  user.heartbeat = Math.max(user.heartbeat, Date.now())
}

function onPing(sender) {
  send({ pong: true }, sender)
}

function removeOldUsers() {
  const maxNoHeartbeatMs = 10 * 1000
  const usersToRemove = gameState.users
    .filter(x => Date.now() - x.heartbeat > maxNoHeartbeatMs)
  gameState.users = gameState.users
    .filter(x => !usersToRemove.includes(x))
}

function onGeo(sender, geo) {
  const id = identifyClient(sender)
  const user = gameState.users.find(x => x.id === id)
  if (!user) return
  if (!geo || geo.length !== 2) return
  if (geo.join() !== user.geo.join())
    user.score += 1
  user.geo = geo
}

function onMsg(raw, sender) {
  const data = JSON.parse(raw.toString())
  console.log('onMsg', sender, data)
  if (data.ping) onPing(sender)
  if (data.heartbeat) onHeartbeat(sender)
  if (data.setGeo) onGeo(sender, data.geo)
}

function send(obj, receiver) {
  console.log('send', receiver, obj)
  return sock.send(
    Buffer.from(JSON.stringify(obj)),
    receiver.port,
    receiver.address,
  )
}

function getUserState(id) {
  const user = gameState.users.find(x => x.id === id)
  const otherUsers = gameState.users.filter(x => x !== user)
  if (!user) throw new Error('user does not exist')
  return {
    user,
    otherUsers,
  }
}

function syncAllUsers() {
  const users = gameState.users
  for (let i = 0; i < users.length; i++) {
    const user = users[i]
    const state = { setState: true, state: getUserState(user.id) }
    send(state, user.client)
  }
}

sock.on('message', onMsg)
sock.bind(8000)

setInterval(removeOldUsers, 1000)
setInterval(syncAllUsers, 100)
