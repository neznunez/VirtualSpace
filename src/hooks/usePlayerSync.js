import { useRef, useEffect } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { useRapier } from '@react-three/rapier'

// Componente interno para capturar posição do controller
// CORREÇÃO: Receber controllerRef para garantir referência única
export function PlayerSync({ socket, isPaused, spawnPosition, controllerRef }) {
  const { scene } = useThree()
  const { world } = useRapier()
  const lastSentRef = useRef({ position: null, rotation: null })
  const lastTimeRef = useRef(0)
  const lastHeartbeatRef = useRef(0)
  const controllerObjectRef = useRef(null)
  const searchStartTimeRef = useRef(Date.now())
  const fallbackPositionRef = useRef(spawnPosition ? { x: spawnPosition[0], y: spawnPosition[1], z: spawnPosition[2] } : null)

  // Múltiplas estratégias de busca do controller
  const findController = () => {
    if (controllerObjectRef.current) return true

    // Estratégia 1: Buscar por userData.isController (mais confiável)
    scene.traverse((obj) => {
      if (controllerObjectRef.current) return
      if (obj.userData?.isController && obj.position) {
        controllerObjectRef.current = obj
        return
      }
    })

    // Estratégia 2: Buscar por RigidBody dinâmico
    if (!controllerObjectRef.current && world) {
      scene.traverse((obj) => {
        if (controllerObjectRef.current) return
        if (obj.userData?.rapierBody && obj.position) {
          try {
            const body = world.bodies.get(obj.userData.rapierBody)
            if (body && body.isDynamic()) {
              controllerObjectRef.current = obj
              return
            }
          } catch (e) {
            // Ignorar erros
          }
        }
      })
    }

    // Estratégia 3: Buscar por estrutura do ecctrl (Group com RigidBody)
    if (!controllerObjectRef.current) {
      scene.traverse((obj) => {
        if (controllerObjectRef.current) return
        if (obj.type === 'Group' && obj.position && obj.children.length > 0) {
          const hasRigidBody = obj.userData?.rapierBody || 
                               obj.children.some(child => child.userData?.rapierBody)
          if (hasRigidBody) {
            controllerObjectRef.current = obj
            return
          }
        }
      })
    }

    return !!controllerObjectRef.current
  }

  // Buscar controller quando componente monta
  useEffect(() => {
    searchStartTimeRef.current = Date.now()
    findController()
    
    // Tentar novamente após delay se não encontrou
    if (!controllerObjectRef.current) {
      const timeout = setTimeout(() => {
        findController()
      }, 1000)
      return () => clearTimeout(timeout)
    }
  }, [scene, world])

  // Atualizar fallback position quando spawnPosition mudar
  useEffect(() => {
    if (spawnPosition && spawnPosition.length === 3) {
      fallbackPositionRef.current = { x: spawnPosition[0], y: spawnPosition[1], z: spawnPosition[2] }
    }
  }, [spawnPosition])

  useFrame((state, delta) => {
    // Verificar se socket existe E está conectado
    if (!socket || !socket.connected || isPaused || !world) return

    const now = Date.now()
    
    // Buscar controller menos frequentemente (a cada 2 segundos) para melhor performance
    const searchInterval = 2000
    if (!controllerObjectRef.current && now % searchInterval < 16) {
      findController()
    }

    // CORREÇÃO: Priorizar ref direto do Controller (garantir referência única)
    let position, rotation

    // Tentar usar ref direto primeiro (se Controller expor)
    if (controllerRef?.current) {
      // Verificar se é um objeto Three.js válido
      if (controllerRef.current.position && typeof controllerRef.current.position.x === 'number') {
        position = {
          x: controllerRef.current.position.x,
          y: controllerRef.current.position.y,
          z: controllerRef.current.position.z
        }
        rotation = {
          x: controllerRef.current.rotation.x || 0,
          y: controllerRef.current.rotation.y || 0,
          z: controllerRef.current.rotation.z || 0
        }
      } else {
        // Se ref não é objeto Three.js, buscar via traverse
        controllerObjectRef.current = null
      }
    }
    
    // Fallback: buscar via traverse se ref não funcionou
    if (!position && controllerObjectRef.current) {
      // Fallback: buscar via traverse se ref não estiver disponível
      // Verificar se o objeto ainda existe na cena
      if (!controllerObjectRef.current.parent && !scene.getObjectById(controllerObjectRef.current.id)) {
        controllerObjectRef.current = null
        return
      }

      position = {
        x: controllerObjectRef.current.position.x || 0,
        y: controllerObjectRef.current.position.y || 0,
        z: controllerObjectRef.current.position.z || 0
      }

      rotation = {
        x: controllerObjectRef.current.rotation.x || 0,
        y: controllerObjectRef.current.rotation.y || 0,
        z: controllerObjectRef.current.rotation.z || 0
      }
    } else {
      // Se não encontrou após 5 segundos, usar fallback
      const timeSinceSearchStart = now - searchStartTimeRef.current
      if (timeSinceSearchStart > 5000 && fallbackPositionRef.current) {
        // Fallback: usar spawnPosition se não encontrou controller após 5 segundos
        position = { ...fallbackPositionRef.current }
        rotation = { x: 0, y: 0, z: 0 }
      } else {
        // Ainda procurando, não enviar nada
        return
      }
    }

    // CORREÇÃO: Frequência otimizada baseada em three-arena
    // Balance entre responsividade e tráfego de rede
    const INTERVAL = 50 // ~20 updates/s (mais responsivo que 80ms)
    if (now - lastTimeRef.current < INTERVAL) return
    lastTimeRef.current = now

    try {
      // Threshold menor para detectar mudanças mais precisas
      const threshold = 0.0005 // Reduzido de 0.001 para ser mais sensível
      const lastSent = lastSentRef.current
      
      const hasChanged = 
        !lastSent.position ||
        Math.abs(position.x - lastSent.position.x) > threshold ||
        Math.abs(position.y - lastSent.position.y) > threshold ||
        Math.abs(position.z - lastSent.position.z) > threshold ||
        Math.abs(rotation.y - (lastSent.rotation?.y || 0)) > threshold

      // Heartbeat: enviar posição mesmo sem mudança a cada 1.5 segundos (mais frequente)
      const needsHeartbeat = now - lastHeartbeatRef.current > 1500

      if ((hasChanged || needsHeartbeat) && socket.connected) {
        // Payload enxuto - apenas x, y, z, ry
        socket.emit('playerMove', {
          x: position.x,
          y: position.y,
          z: position.z,
          ry: rotation.y
        })
        lastSentRef.current = { position: { ...position }, rotation: { ...rotation } }
        if (needsHeartbeat) {
          lastHeartbeatRef.current = now
        }
      }
    } catch (error) {
      console.error('Erro no PlayerSync:', error)
      controllerObjectRef.current = null
    }
  })

  return null
}

