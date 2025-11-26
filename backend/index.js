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
  console.log(`🔌 Cliente conectado: ${socket.id}`)
  console.log(`📊 Total de conexões: ${io.sockets.sockets.size}`)

  // Evento: Player entra na sala
  socket.on('join', (data) => {
    console.log(`📥 Recebido 'join' de ${socket.id}:`, data)
    const { nickname, characterType } = data
    
    // Validar dados
    if (!nickname || nickname.trim().length === 0) {
      console.log(`❌ Nickname inválido de ${socket.id}`)
      socket.emit('error', { message: 'Nickname inválido' })
      return
    }

    if (characterType === undefined || characterType < 0 || characterType > 2) {
      console.log(`❌ CharacterType inválido de ${socket.id}:`, characterType)
      socket.emit('error', { message: 'Tipo de personagem inválido' })
      return
    }

    // Gerar posição aleatória no mapa (área segura)
    // Mapa tem 100x100, então vamos spawnar em uma área de 80x80 centralizada
    const spawnRadius = 40 // Raio de spawn (metade de 80)
    const angle = Math.random() * Math.PI * 2 // Ângulo aleatório
    const distance = Math.random() * spawnRadius // Distância aleatória do centro
    
    const spawnPosition = {
      x: Math.cos(angle) * distance,
      y: 0, // No chão
      z: Math.sin(angle) * distance
    }
    
    // Rotação aleatória inicial
    const spawnRotation = {
      x: 0,
      y: Math.random() * Math.PI * 2, // Rotação aleatória em Y (horizontal)
      z: 0
    }

    // Criar player
    players[socket.id] = {
      id: socket.id,
      nickname: nickname.trim().slice(0, 12), // Máximo 12 caracteres
      characterType: characterType,
      position: spawnPosition,
      rotation: spawnRotation
    }

    console.log(`✅ Player ${nickname} (${socket.id}) entrou na sala`)
    console.log(`📊 Total de players agora: ${Object.keys(players).length}`)
    console.log(`👥 Players atuais:`, Object.keys(players).map(id => players[id].nickname))

    // Enviar estado atual de todos os players para o novo cliente
    console.log(`📤 Enviando 'currentPlayers' para ${socket.id}:`, players)
    socket.emit('currentPlayers', players)

    // Informar aos outros clientes que um novo player entrou
    if (Object.keys(players).length > 1) {
      console.log(`📢 Broadcast 'newPlayer' para outros clientes:`, players[socket.id])
      socket.broadcast.emit('newPlayer', players[socket.id])
    } else {
      console.log(`ℹ️  Primeiro player, sem broadcast necessário`)
    }
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

