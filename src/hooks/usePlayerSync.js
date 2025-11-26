import { useRef, useEffect } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { useRapier } from '@react-three/rapier'

// Componente interno para capturar posição do controller
export function PlayerSync({ socket, isPaused }) {
  const { scene } = useThree()
  const { world } = useRapier()
  const lastSentRef = useRef({ position: null, rotation: null })
  const lastTimeRef = useRef(0)
  const controllerObjectRef = useRef(null)

  // Buscar controller uma vez quando o componente monta
  useEffect(() => {
    const findController = () => {
      if (controllerObjectRef.current) return
      
      // Procurar por userData.isController (mais rápido)
      scene.traverse((obj) => {
        if (controllerObjectRef.current) return
        if (obj.userData?.isController) {
          controllerObjectRef.current = obj
          console.log('✅ Controller encontrado via userData')
        }
      })
      
      // Se não encontrou, procurar por RigidBody
      if (!controllerObjectRef.current) {
        scene.traverse((obj) => {
          if (controllerObjectRef.current) return
          if (obj.userData?.rapierBody) {
            const body = world.bodies.get(obj.userData.rapierBody)
            if (body && body.isDynamic()) {
              controllerObjectRef.current = obj
              console.log('✅ Controller encontrado via RigidBody')
            }
          }
        })
      }
    }

    // Tentar encontrar imediatamente
    findController()
    
    // Se não encontrou, tentar novamente após um delay
    if (!controllerObjectRef.current) {
      const timeout = setTimeout(() => {
        findController()
      }, 1000)
      return () => clearTimeout(timeout)
    }
  }, [scene, world])

  useFrame((state, delta) => {
    // Verificar se socket existe E está conectado
    if (!socket || !socket.connected || isPaused || !world) return

    // Aumentar frequência para 60fps (~16ms) para melhor sincronização
    const now = Date.now()
    if (now - lastTimeRef.current < 16) return // 60fps para movimento mais fluido
    lastTimeRef.current = now

    try {
      // Buscar controller continuamente se não encontrado
      if (!controllerObjectRef.current) {
        scene.traverse((obj) => {
          if (controllerObjectRef.current) return
          if (obj.userData?.isController) {
            controllerObjectRef.current = obj
          }
        })
      }

      if (!controllerObjectRef.current) return
      
      // Verificar se o objeto ainda existe na cena
      if (!controllerObjectRef.current.parent && !scene.getObjectById(controllerObjectRef.current.id)) {
        controllerObjectRef.current = null
        return
      }

      const position = {
        x: controllerObjectRef.current.position.x || 0,
        y: controllerObjectRef.current.position.y || 0,
        z: controllerObjectRef.current.position.z || 0
      }

      const rotation = {
        x: controllerObjectRef.current.rotation.x || 0,
        y: controllerObjectRef.current.rotation.y || 0,
        z: controllerObjectRef.current.rotation.z || 0
      }

      // Threshold muito baixo para garantir envio frequente
      const threshold = 0.001
      const lastSent = lastSentRef.current
      
      const hasChanged = 
        !lastSent.position ||
        Math.abs(position.x - lastSent.position.x) > threshold ||
        Math.abs(position.y - lastSent.position.y) > threshold ||
        Math.abs(position.z - lastSent.position.z) > threshold ||
        Math.abs(rotation.y - (lastSent.rotation?.y || 0)) > threshold

      if (hasChanged && socket.connected) {
        socket.emit('playerMove', { position, rotation })
        lastSentRef.current = { position: { ...position }, rotation: { ...rotation } }
      }
    } catch (error) {
      console.error('Erro no PlayerSync:', error)
      controllerObjectRef.current = null
    }
  })

  return null
}

