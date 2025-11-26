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

// Rate limiting por player (prevenir spam)
const playerUpdateRate = {} // { socketId: { lastUpdate: timestamp, updateCount: number } }

// Configurações (otimizadas baseadas em three-arena e projetos modernos)
const CONFIG = {
  MAX_UPDATE_RATE: 30, // Aumentado para 30 updates/s (mais responsivo)
  MIN_UPDATE_INTERVAL: 33, // Reduzido para 33ms (~30fps de rede, mais fluido)
  MAX_POSITION_DISTANCE: 150, // Distância máxima do centro
  MAX_VELOCITY: 20, // Aumentado para 20 u/s (mais permissivo para movimento rápido)
  HEARTBEAT_TIMEOUT: 10000, // Timeout para considerar player inativo
  POSITION_THRESHOLD: 0.005 // Threshold reduzido para detectar mudanças menores
}

const STATE_SYNC_INTERVAL = 150 // ~6-7 snapshots por segundo

// Porta do servidor
const PORT = process.env.PORT || 3001

app.get('/health', (req, res) => {
  res.json({ status: 'ok', players: Object.keys(players).length })
})

// Socket.IO - Gerenciamento de conexões
io.on('connection', (socket) => {

  // Evento: Player entra na sala
  socket.on('join', (data) => {
    const { nickname, characterType } = data
    
    if (!nickname || nickname.trim().length === 0) {
      socket.emit('error', { message: 'Nickname inválido' })
      return
    }

    if (characterType === undefined || characterType < 0 || characterType > 2) {
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
      y: 1.0, // Altura padrão do ecctrl Controller (alinhado com altura do player local)
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
      rotation: spawnRotation,
      lastUpdate: Date.now() // Timestamp para heartbeat
    }
    
    playerUpdateRate[socket.id] = {
      lastUpdate: Date.now(),
      updateCount: 0
    }

    socket.emit('currentPlayers', players)
    socket.broadcast.emit('newPlayer', players[socket.id])
  })

  socket.on('playerMove', (data) => {
    if (!data || typeof data !== 'object') {
      return
    }

    // Rate limiting otimizado (baseado em three-arena)
    const now = Date.now()
    const rateLimit = playerUpdateRate[socket.id]
    
    if (rateLimit) {
      const timeSinceLastUpdate = now - rateLimit.lastUpdate
      
      // Verificar intervalo mínimo (mais permissivo)
      if (timeSinceLastUpdate < CONFIG.MIN_UPDATE_INTERVAL) {
        return
      }
      
      // Resetar contador se passou 1 segundo
      if (timeSinceLastUpdate > 1000) {
        rateLimit.updateCount = 0
      }
      
      // Verificar limite de updates por segundo
      if (rateLimit.updateCount >= CONFIG.MAX_UPDATE_RATE) {
        return
      }
      
      rateLimit.updateCount++
      rateLimit.lastUpdate = now
    } else {
      playerUpdateRate[socket.id] = { lastUpdate: now, updateCount: 1 }
    }

    // FASE 1: Receber payload enxuto { x, y, z, ry }
    const { x, y, z, ry } = data

    // Validar tipos de valores
    let validatedX = typeof x === 'number' ? x : 0
    let validatedY = typeof y === 'number' ? (y === 0 ? 1.0 : y) : 1.0
    let validatedZ = typeof z === 'number' ? z : 0
    const validatedRy = typeof ry === 'number' ? ry : 0

    // MELHORIA 2: Validação de limites de posição (prevenir players fora do mapa)
    const distanceFromCenter = Math.sqrt(validatedX ** 2 + validatedZ ** 2)
    if (distanceFromCenter > CONFIG.MAX_POSITION_DISTANCE) {
      // Teleportar player de volta para o centro se sair do mapa
      const angle = Math.atan2(validatedZ, validatedX)
      validatedX = Math.cos(angle) * CONFIG.MAX_POSITION_DISTANCE
      validatedZ = Math.sin(angle) * CONFIG.MAX_POSITION_DISTANCE
    }

    // MELHORIA 3: Validação de velocidade (prevenir teleporte/cheating)
    if (players[socket.id]) {
      const oldPos = players[socket.id].position
      const dx = validatedX - oldPos.x
      const dy = validatedY - oldPos.y
      const dz = validatedZ - oldPos.z
      const distance = Math.sqrt(dx ** 2 + dy ** 2 + dz ** 2)
      
      // Calcular velocidade baseada no intervalo real entre updates
      const timeDelta = now - (rateLimit?.lastUpdate || now - CONFIG.MIN_UPDATE_INTERVAL)
      if (timeDelta > 0) {
        const velocity = distance / (timeDelta / 1000) // unidades por segundo
        
        // Se velocidade muito alta, pode ser teleporte legítimo ou cheating
        if (velocity > CONFIG.MAX_VELOCITY && distance > 5) {
          // Permitir apenas se for teleporte legítimo (muito longe = lag ou teleporte)
          if (distance < 20) {
            // Teleporte suspeito, manter posição antiga
            validatedX = oldPos.x
            validatedY = oldPos.y
            validatedZ = oldPos.z
          }
        }
      }
    }

    // Reconstruir estrutura completa para armazenamento interno
    const validatedPosition = {
      x: validatedX,
      y: validatedY,
      z: validatedZ
    }

    const validatedRotation = {
      x: 0, // Não usado, mas mantém estrutura
      y: validatedRy,
      z: 0  // Não usado, mas mantém estrutura
    }

    // Atualizar posição do player
    if (players[socket.id]) {
      players[socket.id].position = validatedPosition
      players[socket.id].rotation = validatedRotation
      players[socket.id].lastUpdate = now

      // CORREÇÃO CRÍTICA: Usar io.emit para TODOS os clientes
      // IMPORTANTE: Enviar para TODOS, não apenas broadcast
      // Isso garante sincronização completa entre todos os clientes
      const updateData = {
        id: socket.id,
        position: validatedPosition,
        rotation: validatedRotation
      }
      
      io.emit('playerMoved', updateData)
    }
  })

  socket.on('disconnect', () => {
    if (players[socket.id]) {
      delete players[socket.id]
      delete playerUpdateRate[socket.id]
      io.emit('playerDisconnected', socket.id)
    }
  })
})

// MELHORIA 5: Sistema de heartbeat global (cleanup de players inativos)
// Inicializar APÓS o servidor estar pronto
let heartbeatIntervalId = null
let stateSyncIntervalId = null

const startHeartbeat = () => {
  if (heartbeatIntervalId) return // Já está rodando
  
  heartbeatIntervalId = setInterval(() => {
    const now = Date.now()
    const inactivePlayers = []
    
    Object.keys(players).forEach(playerId => {
      const player = players[playerId]
      if (!player) return
      
      const timeSinceUpdate = now - (player.lastUpdate || 0)
      
      if (timeSinceUpdate > CONFIG.HEARTBEAT_TIMEOUT) {
        inactivePlayers.push(playerId)
      }
    })
    
    // Remover players inativos
    if (inactivePlayers.length > 0) {
      inactivePlayers.forEach(playerId => {
        const player = players[playerId]
        if (player) {
          delete players[playerId]
          delete playerUpdateRate[playerId]
          io.emit('playerDisconnected', playerId)
        }
      })
    }
  }, 5000) // Verificar a cada 5 segundos
}

const startStateSync = () => {
  if (stateSyncIntervalId) return

  stateSyncIntervalId = setInterval(() => {
    if (Object.keys(players).length === 0) return

    const snapshot = Object.values(players).map(player => ({
      id: player.id,
      nickname: player.nickname,
      characterType: player.characterType,
      position: player.position,
      rotation: player.rotation,
      lastUpdate: player.lastUpdate
    }))

    io.emit('stateSnapshot', snapshot)
  }, STATE_SYNC_INTERVAL)
}

server.listen(PORT, () => {
  startHeartbeat()
  startStateSync()
})

