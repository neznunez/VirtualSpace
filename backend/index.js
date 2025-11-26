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

// Configurações
const CONFIG = {
  MAX_UPDATE_RATE: 20, // Máximo 20 updates por segundo por player
  MIN_UPDATE_INTERVAL: 50, // Intervalo mínimo entre updates (ms)
  MAX_POSITION_DISTANCE: 150, // Distância máxima do centro (prevenir players fora do mapa)
  MAX_VELOCITY: 15, // Velocidade máxima permitida (unidades/segundo)
  HEARTBEAT_TIMEOUT: 10000, // Timeout para considerar player inativo (10 segundos)
  POSITION_THRESHOLD: 0.01 // Threshold mínimo para considerar mudança de posição
}

// Porta do servidor
const PORT = process.env.PORT || 3001

// Rota de health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', players: Object.keys(players).length })
})

// Socket.IO - Gerenciamento de conexões
io.on('connection', (socket) => {
  console.log(`🔌 Cliente conectado: ${socket.id}`)
  // Socket.IO 4.x: usar io.sockets.sockets.size para contar conexões
  const totalConnections = io.sockets.sockets.size
  console.log(`📊 Total de conexões: ${totalConnections}`)

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
    
    // Inicializar rate limiting
    playerUpdateRate[socket.id] = {
      lastUpdate: Date.now(),
      updateCount: 0
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
  // FASE 1: Recebe payload enxuto { x, y, z, ry } e reconstrói estrutura completa
  socket.on('playerMove', (data) => {
    // Validação rigorosa de dados recebidos
    if (!data || typeof data !== 'object') {
      console.warn(`⚠️ [Backend] Dados inválidos de ${socket.id}:`, data)
      return
    }

    // MELHORIA 1: Rate limiting - prevenir spam de updates
    const now = Date.now()
    const rateLimit = playerUpdateRate[socket.id]
    
    if (rateLimit) {
      const timeSinceLastUpdate = now - rateLimit.lastUpdate
      
      // Verificar intervalo mínimo
      if (timeSinceLastUpdate < CONFIG.MIN_UPDATE_INTERVAL) {
        return // Ignorar update muito frequente
      }
      
      // Resetar contador se passou 1 segundo
      if (timeSinceLastUpdate > 1000) {
        rateLimit.updateCount = 0
      }
      
      // Verificar limite de updates por segundo
      if (rateLimit.updateCount >= CONFIG.MAX_UPDATE_RATE) {
        console.warn(`⚠️ [Backend] Rate limit excedido para ${socket.id}`)
        return
      }
      
      rateLimit.updateCount++
    } else {
      playerUpdateRate[socket.id] = { lastUpdate: now, updateCount: 1 }
    }
    
    playerUpdateRate[socket.id].lastUpdate = now

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
      console.warn(`⚠️ [Backend] Player ${socket.id} fora dos limites, reposicionando`)
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
            console.warn(`⚠️ [Backend] Velocidade suspeita para ${socket.id}: ${velocity.toFixed(2)} u/s (distância: ${distance.toFixed(2)})`)
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
      const oldPos = players[socket.id].position
      
      // MELHORIA 4: Só broadcastar se mudança significativa (otimização de rede)
      const hasSignificantChange = 
        !oldPos ||
        Math.abs(validatedX - oldPos.x) > CONFIG.POSITION_THRESHOLD ||
        Math.abs(validatedY - oldPos.y) > CONFIG.POSITION_THRESHOLD ||
        Math.abs(validatedZ - oldPos.z) > CONFIG.POSITION_THRESHOLD ||
        Math.abs(validatedRy - players[socket.id].rotation.y) > 0.01
      
      players[socket.id].position = validatedPosition
      players[socket.id].rotation = validatedRotation
      players[socket.id].lastUpdate = now // Atualizar timestamp para heartbeat

      // Informar aos outros clientes sobre o movimento (apenas se mudança significativa)
      if (hasSignificantChange) {
        socket.broadcast.emit('playerMoved', {
          id: socket.id,
          position: validatedPosition,
          rotation: validatedRotation
        })
      }
    } else {
      console.warn(`⚠️ [Backend] Player ${socket.id} não encontrado ao receber playerMove`)
    }
  })

  // Evento: Player desconecta
  socket.on('disconnect', () => {
    if (players[socket.id]) {
      const playerNickname = players[socket.id].nickname
      console.log(`👋 [Backend] Player ${playerNickname} (${socket.id}) desconectou`)
      
      // Remover player
      delete players[socket.id]
      delete playerUpdateRate[socket.id]

      // Informar aos outros clientes sobre a desconexão
      console.log(`📤 [Backend] Broadcast playerDisconnected para outros clientes: ${socket.id}`)
      socket.broadcast.emit('playerDisconnected', socket.id)
      
      console.log(`📊 [Backend] Total de players agora: ${Object.keys(players).length}`)
    } else {
      console.log(`ℹ️ [Backend] Socket ${socket.id} desconectou, mas não estava na lista de players`)
    }
  })
})

// MELHORIA 5: Sistema de heartbeat global (cleanup de players inativos)
// Inicializar APÓS o servidor estar pronto
let heartbeatIntervalId = null

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
          console.log(`⏰ [Backend] Removendo player inativo: ${player.nickname} (${playerId})`)
          delete players[playerId]
          delete playerUpdateRate[playerId]
          
          // Notificar outros clientes usando io (Socket.IO 4.x)
          // io.emit() envia para todos os clientes conectados
          io.emit('playerDisconnected', playerId)
        }
      })
    }
  }, 5000) // Verificar a cada 5 segundos
}

server.listen(PORT, () => {
  console.log(`🚀 Servidor Socket.IO rodando na porta ${PORT}`)
  console.log(`📡 Aguardando conexões...`)
  
  // Iniciar heartbeat após servidor estar pronto
  startHeartbeat()
})

