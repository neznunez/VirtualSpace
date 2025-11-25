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
      // Só procura uma vez e mantém em cache
      if (!controllerObjectRef.current) {
        let found = false
        
        // Primeira tentativa: procurar por userData.isController (mais rápido)
        scene.traverse((obj) => {
          if (found) return
          if (obj.userData?.isController) {
            controllerObjectRef.current = obj
            found = true
          }
        })
        
        // Segunda tentativa: procurar por RigidBody (mais custoso)
        if (!found) {
          scene.traverse((obj) => {
            if (found) return
            if (obj.userData?.rapierBody) {
              const body = world.bodies.get(obj.userData.rapierBody)
              if (body && body.isDynamic()) {
                controllerObjectRef.current = obj
                found = true
              }
            }
          })
        }
        
        // Terceira tentativa: procurar por grupos (mais custoso ainda)
        if (!found) {
          scene.traverse((obj) => {
            if (found) return
            if (obj.type === 'Group' && obj.children.length > 0) {
              const hasRapierBody = obj.children.some(child => 
                child.userData?.rapierBody
              )
              if (hasRapierBody && obj.position && Math.abs(obj.position.y) < 10) {
                controllerObjectRef.current = obj
                found = true
              }
            }
          })
        }
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

