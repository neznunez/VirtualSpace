import { useRef } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { useRapier } from '@react-three/rapier'

// Componente interno para capturar posição do controller
export function PlayerSync({ socket, isPaused }) {
  const { scene } = useThree()
  const { world } = useRapier()
  const lastSentRef = useRef({ position: null, rotation: null })
  const lastTimeRef = useRef(0)
  const controllerObjectRef = useRef(null)

  useFrame((state, delta) => {
    if (!socket || isPaused || !world) return

    // Enviar a cada ~50ms (20fps)
    const now = Date.now()
    if (now - lastTimeRef.current < 50) return
    lastTimeRef.current = now

    try {
      // Procurar o objeto do controller na cena (cache para performance)
      if (!controllerObjectRef.current) {
        scene.traverse((obj) => {
          // Procurar por objetos com userData.isController
          if (obj.userData?.isController) {
            controllerObjectRef.current = obj
          }
          // Ou procurar por RigidBody do player (ecctrl cria um)
          else if (obj.userData?.rapierBody) {
            const body = world.bodies.get(obj.userData.rapierBody)
            if (body && body.isDynamic()) {
              controllerObjectRef.current = obj
            }
          }
        })
      }

      // Se ainda não encontrou, procurar por grupos com física
      if (!controllerObjectRef.current) {
        scene.traverse((obj) => {
          if (obj.type === 'Group' && obj.children.length > 0) {
            const hasRapierBody = obj.children.some(child => 
              child.userData?.rapierBody
            )
            if (hasRapierBody && obj.position && Math.abs(obj.position.y) < 10) {
              controllerObjectRef.current = obj
            }
          }
        })
      }

      if (!controllerObjectRef.current) return

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

      // Verificar se houve mudança significativa
      const threshold = 0.01
      const lastSent = lastSentRef.current
      
      const hasChanged = 
        !lastSent.position ||
        Math.abs(position.x - lastSent.position.x) > threshold ||
        Math.abs(position.y - lastSent.position.y) > threshold ||
        Math.abs(position.z - lastSent.position.z) > threshold ||
        Math.abs(rotation.y - (lastSent.rotation?.y || 0)) > threshold

      if (hasChanged) {
        socket.emit('playerMove', { position, rotation })
        lastSentRef.current = { position, rotation }
      }
    } catch (error) {
      // Resetar cache em caso de erro
      controllerObjectRef.current = null
    }
  })

  return null
}

