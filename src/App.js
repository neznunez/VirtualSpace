import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { Physics, RigidBody, useRapier } from '@react-three/rapier'
import { Gltf, useEnvironment, Fisheye, KeyboardControls, Text } from '@react-three/drei'
import React, { useEffect, useMemo, useState, useRef, memo } from 'react'
import * as THREE from 'three'
import Controller from 'ecctrl'
import CharacterSelection from './components/CharacterSelection'
import RemotePlayer from './components/RemotePlayer'
import JoinAnimation from './components/JoinAnimation'
import JoinNotification from './components/JoinNotification'
import ConnectionStatus from './components/ConnectionStatus'
import VideoScreen from './components/VideoScreen'
import { useSocket } from './hooks/useSocket'
import { usePlayers } from './hooks/usePlayers'
import { PlayerSync } from './hooks/usePlayerSync'

function SceneSetup() {
  const envMap = useEnvironment({ files: '/night.hdr' })
  const { scene } = useThree()
  
  useEffect(() => {
    scene.environment = envMap
    scene.background = null
  }, [envMap, scene])
  
  return null
}

// Memoizar NightSky para evitar recriação
const NightSky = memo(function NightSky() {
  const stars = useMemo(() => {
    const starsGeometry = new THREE.BufferGeometry()
    const starsMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.5,
      sizeAttenuation: true,
    })
    
    const starsVertices = []
    for (let i = 0; i < 5000; i++) {
      const x = (Math.random() - 0.5) * 2000
      const y = (Math.random() - 0.5) * 2000
      const z = (Math.random() - 0.5) * 2000
      starsVertices.push(x, y, z)
    }
    
    starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starsVertices, 3))
    return new THREE.Points(starsGeometry, starsMaterial)
  }, [])
  
  return <primitive object={stars} />
})

function PhysicsPauser({ isPaused }) {
  const { world } = useRapier()
  
  useEffect(() => {
    if (!world) return
    
    if (isPaused) {
      world.timestep = 0
    } else {
      world.timestep = 1/60
    }
  }, [world, isPaused])
  
  return null
}

// Memoizar FloatingCharacter para evitar re-renders desnecessários
const FloatingCharacter = React.memo(function FloatingCharacter({ children }) {
  const groupRef = useRef()
  const timeRef = useRef(0)
  
  useFrame((state, delta) => {
    if (groupRef.current) {
      timeRef.current += delta
      // Animação suave de flutuação usando seno
      const floatAmount = Math.sin(timeRef.current * 2) * 0.1
      groupRef.current.position.y = floatAmount
    }
  })
  
  return (
    <group ref={groupRef}>
      {children}
    </group>
  )
})

// Memoizar NPC para evitar re-renders desnecessários
const NPC = memo(function NPC({ position = [0, 0, 0] }) {
  const npcRef = useRef()
  const floatGroupRef = useRef()
  const stateRef = useRef('idle') // 'idle' ou 'walking'
  const timeRef = useRef(0)
  const floatTimeRef = useRef(0)
  const idleTimeRef = useRef(0)
  const walkTimeRef = useRef(0)
  const currentPosRef = useRef([position[0], position[1], position[2]])
  const targetPosRef = useRef([position[0], position[1], position[2]])
  const idleSwayRef = useRef(0)
  
  useFrame((state, delta) => {
    // Flutuação contínua igual ao personagem principal
    if (floatGroupRef.current) {
      floatTimeRef.current += delta
      const floatAmount = Math.sin(floatTimeRef.current * 2) * 0.1
      floatGroupRef.current.position.y = floatAmount
    }
    
    if (npcRef.current) {
      timeRef.current += delta
      
      if (stateRef.current === 'idle') {
        idleTimeRef.current += delta
        idleSwayRef.current += delta * 0.5
        
        // Pequenos movimentos sutis quando parado (como Mii do Wii)
        const swayX = Math.sin(idleSwayRef.current) * 0.05
        const swayZ = Math.cos(idleSwayRef.current * 0.7) * 0.05
        
        npcRef.current.position.set(
          currentPosRef.current[0] + swayX,
          currentPosRef.current[1],
          currentPosRef.current[2] + swayZ
        )
        
        // Pequena rotação sutil
        npcRef.current.rotation.y = Math.sin(idleSwayRef.current * 0.3) * 0.1
        
        // Após 3-5 segundos parado, decide caminhar
        if (idleTimeRef.current > 3 + Math.random() * 2) {
          stateRef.current = 'walking'
          walkTimeRef.current = 0
          idleTimeRef.current = 0
          
          // Define um destino aleatório próximo (2-4 unidades de distância)
          const angle = Math.random() * Math.PI * 2
          const distance = 2 + Math.random() * 2
          targetPosRef.current = [
            position[0] + Math.cos(angle) * distance,
            position[1],
            position[2] + Math.sin(angle) * distance
          ]
        }
      } else if (stateRef.current === 'walking') {
        walkTimeRef.current += delta
        
        // Move suavemente em direção ao alvo
        const dx = targetPosRef.current[0] - currentPosRef.current[0]
        const dz = targetPosRef.current[2] - currentPosRef.current[2]
        const distance = Math.sqrt(dx * dx + dz * dz)
        
        if (distance > 0.1) {
          // Caminha em direção ao alvo
          const speed = 1.5 * delta
          currentPosRef.current[0] += (dx / distance) * speed
          currentPosRef.current[2] += (dz / distance) * speed
          
          npcRef.current.position.set(
            currentPosRef.current[0],
            currentPosRef.current[1],
            currentPosRef.current[2]
          )
          
          // Olha na direção do movimento
          npcRef.current.lookAt(
            targetPosRef.current[0],
            currentPosRef.current[1],
            targetPosRef.current[2]
          )
        } else {
          // Chegou ao destino, volta para idle
          currentPosRef.current = [...targetPosRef.current]
          stateRef.current = 'idle'
          idleTimeRef.current = 0
          idleSwayRef.current = 0
        }
        
        // Limite de tempo de caminhada (máximo 4 segundos)
        if (walkTimeRef.current > 4) {
          currentPosRef.current = [...targetPosRef.current]
          stateRef.current = 'idle'
          idleTimeRef.current = 0
          idleSwayRef.current = 0
        }
      }
    }
  })
  
  return (
    <group ref={npcRef} position={position}>
      <group ref={floatGroupRef}>
        <Gltf 
          castShadow 
          receiveShadow 
          scale={1.15} 
          src="/NPCHead.glb" 
        />
      </group>
    </group>
  )
}, (prevProps, nextProps) => {
  // Comparação customizada para evitar re-renders desnecessários
  return prevProps.position[0] === nextProps.position[0] &&
         prevProps.position[1] === nextProps.position[1] &&
         prevProps.position[2] === nextProps.position[2]
})

function PauseMenu({ isPaused, onResume }) {
  if (!isPaused) return null
  
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      backgroundColor: '#000000',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
      fontFamily: '"Courier New", Courier, monospace',
    }}>
      <h1 style={{
        color: '#d3d3d3',
        fontSize: '2.5rem',
        fontWeight: 'normal',
        margin: '0 0 2rem 0',
        letterSpacing: '0.2rem',
        textTransform: 'uppercase',
      }}>
        Paused
      </h1>
      
      <div style={{
        color: '#d3d3d3',
        fontSize: '1.2rem',
        letterSpacing: '0.1rem',
      }}>
        ESC to Resume
      </div>
    </div>
  )
}

export default function App() {
  const [isPaused, setIsPaused] = useState(false)
  const [hasJoined, setHasJoined] = useState(false)
  const [playerData, setPlayerData] = useState(null) // { nickname, characterType }
  const [spawnPosition, setSpawnPosition] = useState([0, 0, 0]) // Posição inicial do player local
  
  // CORREÇÃO: Ref para o Controller (garantir referência única)
  const controllerRef = useRef()
  
  // Socket.IO e gerenciamento de players
  const { socket, isConnected } = useSocket()
  // FASE 2: Nova estrutura - playersList (estático) e getDynamic (dinâmico)
  const { playersList, getDynamic, addPlayer, updatePlayer, removePlayer, clearPlayers } = usePlayers()
  
  // Estado para animações e notificações de entrada
  const [joinAnimations, setJoinAnimations] = useState([]) // [{ id, position, timestamp }]
  const [notifications, setNotifications] = useState([]) // [{ id, nickname, timestamp }]
  
  const keyboardMap = [
    { name: 'forward', keys: ['ArrowUp', 'KeyW'] },
    { name: 'backward', keys: ['ArrowDown', 'KeyS'] },
    { name: 'leftward', keys: ['ArrowLeft', 'KeyA'] },
    { name: 'rightward', keys: ['ArrowRight', 'KeyD'] },
    { name: 'jump', keys: ['Space'] },
    { name: 'run', keys: ['Shift'] },
  ]
  
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsPaused(prev => !prev)
        // Libera o pointer lock quando pausar
        if (document.pointerLockElement) {
          document.exitPointerLock()
        }
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
  
  // Configurar eventos Socket.IO quando socket estiver disponível E conectado
  useEffect(() => {
    if (!socket || !socket.connected) return


    // Evento: Receber lista de players ao conectar
    socket.on('currentPlayers', (playersList) => {
      Object.values(playersList).forEach(player => {
        if (player.id !== socket.id) { // Não adicionar a si mesmo
          addPlayer(player)
        } else {
          // Se for o próprio player, usar a posição do servidor para spawn
          if (player.position) {
            // Ajustar Y se for 0 (altura padrão do ecctrl é 1.0)
            const spawnY = player.position.y === 0 ? 1.0 : player.position.y
            // Definir posição de spawn do player local
            setSpawnPosition([player.position.x, spawnY, player.position.z])
            
            // Atualizar animação do próprio player com posição correta
            setJoinAnimations(prev => {
              const existing = prev.find(a => a.playerId === 'self')
              if (existing) {
                return prev.map(a => 
                  a.playerId === 'self' 
                    ? { ...a, position: player.position }
                    : a
                )
              }
              return prev
            })
          }
        }
      })
    })

    // Evento: Novo player entrou
    socket.on('newPlayer', (player) => {
      if (player.id !== socket.id) {
        addPlayer(player)
        
        // Adicionar animação de entrada na posição do player
        const position = player.position || { x: 0, y: 0, z: 0 }
        setJoinAnimations(prev => [...prev, {
          id: `anim-${player.id}-${Date.now()}`,
          playerId: player.id,
          position: { x: position.x || 0, y: position.y || 0, z: position.z || 0 },
          timestamp: Date.now()
        }])
        
        // Adicionar notificação
        setNotifications(prev => [...prev, {
          id: `notif-${player.id}-${Date.now()}`,
          nickname: player.nickname,
          timestamp: Date.now()
        }])
      } else {
        console.log(`  ⏭️  Pulando a si mesmo`)
      }
    })

    // Evento: Player se moveu
    socket.on('playerMoved', ({ id, position, rotation }) => {
      updatePlayer(id, position, rotation)
    })

    // Evento: Player saiu
    socket.on('playerDisconnected', (playerId) => {
      if (playerId) {
        removePlayer(playerId)
      }
    })

    // Evento: Próprio usuário desconectou (limpar todos os players remotos)
    socket.on('disconnect', () => {
      clearPlayers()
    })

    // Evento: Erro
    socket.on('error', ({ message }) => {
    })

    return () => {
      socket.off('currentPlayers')
      socket.off('newPlayer')
      socket.off('playerMoved')
      socket.off('playerDisconnected')
      socket.off('disconnect')
      socket.off('error')
    }
  }, [socket, socket?.connected, addPlayer, updatePlayer, removePlayer, clearPlayers])
  
  const handleJoin = (nickname, characterType) => {
    setPlayerData({ nickname, characterType })
    setHasJoined(true)
    
    // Conectar ao servidor e enviar dados do player
    // Aguardar socket estar conectado antes de enviar
    if (socket) {
      if (socket.connected) {
        socket.emit('join', { nickname, characterType })
        
        // Adicionar animação de entrada para o próprio player
        // A posição será definida quando receber currentPlayers do servidor
        // Por enquanto, usar posição inicial (será atualizada)
        const initialPosition = { x: 0, y: 0, z: 0 }
        setJoinAnimations(prev => [...prev, {
          id: `anim-self-${Date.now()}`,
          playerId: 'self',
          position: initialPosition,
          timestamp: Date.now()
        }])
      } else {
        // Se ainda não conectou, aguardar conexão
        socket.once('connect', () => {
          socket.emit('join', { nickname, characterType })
          
          // Adicionar animação de entrada para o próprio player
          const initialPosition = { x: 0, y: 0, z: 0 }
          setJoinAnimations(prev => [...prev, {
            id: `anim-self-${Date.now()}`,
            playerId: 'self',
            position: initialPosition,
            timestamp: Date.now()
          }])
        })
      }
    } else {
      console.error('❌ Socket não disponível!')
    }
  }
  
  // Remover animações antigas após duração (2.5 segundos)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      setJoinAnimations(prev => prev.filter(anim => now - anim.timestamp < 2500))
    }, 1000)
    
    return () => clearInterval(interval)
  }, [])
  
  // Se ainda não entrou, mostrar tela de seleção
  if (!hasJoined) {
    return <CharacterSelection onJoin={handleJoin} />
  }
  
  // Determinar qual modelo usar baseado no characterType
  const getCharacterModel = (type) => {
    const models = ['/VirtualHead.glb', '/NPCHead.glb', '/ghost_w_tophat-transformed.glb']
    return models[type] || models[0]
  }
  
  return (
    <>
      <Canvas 
        shadows 
        onPointerDown={(e) => {
          if (!isPaused) {
            e.target.requestPointerLock()
          }
        }}
        gl={{ 
          clearColor: '#0a0a1a',
          powerPreference: 'high-performance',
          antialias: true,
          stencil: false,
          depth: true
        }}
        dpr={[1, 1.5]} // Limitar DPR para melhor performance
        performance={{ min: 0.5 }} // Reduzir qualidade se FPS < 30
      >
      <Fisheye zoom={0.4}>
        <SceneSetup />
        <NightSky />
        <directionalLight intensity={0.7} castShadow shadow-bias={-0.0004} position={[-20, 20, 20]}>
          <orthographicCamera attach="shadow-camera" args={[-20, 20, 20, -20]} />
        </directionalLight>
        <ambientLight intensity={0.2} />
        {/* Vídeo em loop - único telão otimizado */}
        <VideoScreen 
          videoPath="/zaza.mp4"
          position={[0, 8, 28]} // Norte (Z positivo) - virado para o centro
          rotation={[0, Math.PI, 0]} // Olha para o Sul (centro)
          width={24}
          height={13.5}
          muted={false} // Com som
        />
        <Physics timeStep={1/60} gravity={[0, -9.81, 0]} paused={isPaused}>
          <PhysicsPauser isPaused={isPaused} />
          <PlayerSync socket={socket} isPaused={isPaused} spawnPosition={spawnPosition} controllerRef={controllerRef} />
          <KeyboardControls map={keyboardMap} enabled={!isPaused}>
            <Controller 
              ref={controllerRef}
              maxVelLimit={5}
              userData={{ isController: true }}
              position={spawnPosition}
              mode="normal"
              autoBalance={false}
              disableFollowCam={false}
            >
              <FloatingCharacter>
                {/* Nickname acima da cabeça do avatar */}
                {playerData?.nickname && (
                  <group position={[0, 2.3, 0]}>
                    {/* Frame preto semi-transparente */}
                    <mesh position={[0, 0, -0.01]}>
                      <planeGeometry args={[playerData.nickname.length * 0.18 + 0.3, 0.45]} />
                      <meshBasicMaterial color="#000000" transparent opacity={0.6} />
                    </mesh>
                    {/* Texto do nickname */}
                    <Text
                      position={[0, 0, 0]}
                      fontSize={0.3}
                      color="#ffffff"
                      anchorX="center"
                      anchorY="middle"
                    >
                      {playerData.nickname}
                    </Text>
                  </group>
                )}
                <Gltf 
                  castShadow 
                  receiveShadow 
                  scale={1.0} 
                  position={[0, 0, 0]} 
                  src={getCharacterModel(playerData.characterType)} 
                />
              </FloatingCharacter>
            </Controller>
            
            {/* FASE 2: Renderizar players remotos - passar apenas dados estáticos + getDynamic */}
            {playersList.map(player => (
              <RemotePlayer 
                key={player.id} 
                id={player.id}
                nickname={player.nickname}
                characterType={player.characterType}
                getDynamic={getDynamic}
              />
            ))}
            
            {/* Animações de entrada */}
            {joinAnimations.map(anim => (
              <JoinAnimation
                key={anim.id}
                position={anim.position}
                duration={2.5}
              />
            ))}
          </KeyboardControls>
          {/* Plano simples como chão - TAMANHO AUMENTADO - Otimizado */}
          <RigidBody type="fixed" position={[0, 0, 0]} colliders="cuboid" ccd={false}>
            <mesh receiveShadow position={[0, 0, 0]}>
              <boxGeometry args={[200, 1.0, 200]} />
              <meshStandardMaterial color="#4a5568" />
            </mesh>
          </RigidBody>
        </Physics>
        {/* NPC com comportamento estilo Mii do Wii */}
        <NPC position={[10, 1, 0]} />
      </Fisheye>
    </Canvas>
    <PauseMenu isPaused={isPaused} onResume={() => setIsPaused(false)} />
    
    {/* Indicador de status do Socket.IO - Pronto para receber usuários */}
    {hasJoined && <ConnectionStatus isConnected={isConnected} />}
    
    {/* Notificações de entrada */}
    {notifications.map(notif => (
      <JoinNotification
        key={notif.id}
        nickname={notif.nickname}
        onComplete={() => {
          setNotifications(prev => prev.filter(n => n.id !== notif.id))
        }}
      />
    ))}
    </>
  )
}

