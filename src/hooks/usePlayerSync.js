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

    // Estratégia 1: Buscar por userData.isController
    scene.traverse((obj) => {
      if (controllerObjectRef.current) return
      if (obj.userData?.isController) {
        controllerObjectRef.current = obj
        console.log('✅ Controller encontrado via userData.isController')
        return
      }
    })

    // Estratégia 2: Buscar por RigidBody dinâmico
    if (!controllerObjectRef.current && world) {
      scene.traverse((obj) => {
        if (controllerObjectRef.current) return
        if (obj.userData?.rapierBody) {
          try {
            const body = world.bodies.get(obj.userData.rapierBody)
            if (body && body.isDynamic()) {
              controllerObjectRef.current = obj
              console.log('✅ Controller encontrado via RigidBody')
              return
            }
          } catch (e) {
            // Ignorar erros
          }
        }
      })
    }

    // Estratégia 3: Buscar por nome/tipo do objeto
    if (!controllerObjectRef.current) {
      scene.traverse((obj) => {
        if (controllerObjectRef.current) return
        // Procurar por objetos que podem ser o controller
        if (obj.type === 'Group' && obj.children.length > 0) {
          // Verificar se tem estrutura similar ao controller
          const hasRigidBody = obj.userData?.rapierBody || obj.children.some(child => child.userData?.rapierBody)
          if (hasRigidBody) {
            controllerObjectRef.current = obj
            console.log('✅ Controller encontrado via estrutura')
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

    if (controllerRef?.current) {
      // CORREÇÃO: Usar ref direto - mesma referência que o Controller renderiza
      position = {
        x: controllerRef.current.position.x || 0,
        y: controllerRef.current.position.y || 0,
        z: controllerRef.current.position.z || 0
      }

      rotation = {
        x: controllerRef.current.rotation.x || 0,
        y: controllerRef.current.rotation.y || 0,
        z: controllerRef.current.rotation.z || 0
      }
    } else if (controllerObjectRef.current) {
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

    // FASE 1: Frequência de atualização reduzida para 60-80ms (~12-16fps de rede)
    // Isso reduz significativamente o tráfego de rede mantendo movimento suave
    const INTERVAL = 80 // ~12.5 updates/s (otimizado para reduzir payload)
    if (now - lastTimeRef.current < INTERVAL) return
    lastTimeRef.current = now

    try {
      // Threshold para detectar mudanças significativas
      const threshold = 0.001
      const lastSent = lastSentRef.current
      
      const hasChanged = 
        !lastSent.position ||
        Math.abs(position.x - lastSent.position.x) > threshold ||
        Math.abs(position.y - lastSent.position.y) > threshold ||
        Math.abs(position.z - lastSent.position.z) > threshold ||
        Math.abs(rotation.y - (lastSent.rotation?.y || 0)) > threshold

      // Heartbeat: enviar posição mesmo sem mudança a cada 2 segundos
      const needsHeartbeat = now - lastHeartbeatRef.current > 2000

      if ((hasChanged || needsHeartbeat) && socket.connected) {
        // FASE 1: Payload enxuto - apenas x, y, z, ry (reduz ~40% do tamanho)
        // Backend irá reconstruir a estrutura completa
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

