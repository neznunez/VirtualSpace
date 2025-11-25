const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const cors = require('cors')

const app = express()
app.use(cors())

const server = http.createServer(app)
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || process.env.VERCEL_URL || "*",
    methods: ["GET", "POST"],
    credentials: true
  }
})

// Armazenar players conectados
const players = {}

// Porta do servidor
const PORT = process.env.PORT || 3001

// Rota de health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', players: Object.keys(players).length })
})

// Socket.IO - Gerenciamento de conexões
io.on('connection', (socket) => {
  console.log(`Cliente conectado: ${socket.id}`)

  // Evento: Player entra na sala
  socket.on('join', (data) => {
    const { nickname, characterType } = data
    
    // Validar dados
    if (!nickname || nickname.trim().length === 0) {
      socket.emit('error', { message: 'Nickname inválido' })
      return
    }

    if (characterType === undefined || characterType < 0 || characterType > 2) {
      socket.emit('error', { message: 'Tipo de personagem inválido' })
      return
    }

    // Criar player
    players[socket.id] = {
      id: socket.id,
      nickname: nickname.trim().slice(0, 12), // Máximo 12 caracteres
      characterType: characterType,
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 }
    }

    console.log(`Player ${nickname} (${socket.id}) entrou na sala`)

    // Enviar estado atual de todos os players para o novo cliente
    socket.emit('currentPlayers', players)

    // Informar aos outros clientes que um novo player entrou
    socket.broadcast.emit('newPlayer', players[socket.id])
  })

  // Evento: Player se move
  socket.on('playerMove', (data) => {
    const { position, rotation } = data

    // Atualizar posição do player
    if (players[socket.id]) {
      players[socket.id].position = position
      players[socket.id].rotation = rotation

      // Informar aos outros clientes sobre o movimento
      socket.broadcast.emit('playerMoved', {
        id: socket.id,
        position,
        rotation
      })
    }
  })

  // Evento: Player desconecta
  socket.on('disconnect', () => {
    if (players[socket.id]) {
      console.log(`Player ${players[socket.id].nickname} (${socket.id}) saiu da sala`)
      
      // Remover player
      delete players[socket.id]

      // Informar aos outros clientes
      socket.broadcast.emit('playerDisconnected', socket.id)
    }
  })
})

server.listen(PORT, () => {
  console.log(`🚀 Servidor Socket.IO rodando na porta ${PORT}`)
  console.log(`📡 Aguardando conexões...`)
})

