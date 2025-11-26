import { useRef, useEffect, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * Animação de entrada quando um player entra na sala
 * Círculo brilhante no chão que pulsa, avatar aparece com luz, depois desaparece
 */
export default function JoinAnimation({ position, duration = 2.5 }) {
  const groupRef = useRef()
  const circleRef = useRef()
  const lightRef = useRef()
  const [isActive, setIsActive] = useState(true)
  const timeRef = useRef(0)
  const circleOpacityRef = useRef(1)
  const lightIntensityRef = useRef(0)

  useEffect(() => {
    // Desativar após a duração
    const timer = setTimeout(() => {
      setIsActive(false)
    }, duration * 1000)

    return () => clearTimeout(timer)
  }, [duration])

  useFrame((state, delta) => {
    if (!isActive || !groupRef.current) return

    timeRef.current += delta
    const progress = timeRef.current / duration

    // Fase 1: Círculo aparece e pulsa (0-40% do tempo)
    if (progress < 0.4) {
      const phaseProgress = progress / 0.4
      // Pulsação do círculo
      const pulse = Math.sin(timeRef.current * 4) * 0.3 + 0.7 // Entre 0.4 e 1.0
      if (circleRef.current) {
        circleRef.current.material.emissiveIntensity = pulse * 2
        circleRef.current.material.opacity = Math.min(1, phaseProgress * 2)
        // Escala pulsante
        const scale = 0.8 + Math.sin(timeRef.current * 6) * 0.2
        circleRef.current.scale.set(scale, 1, scale)
      }
    }
    // Fase 2: Avatar aparece com luz (40-70% do tempo)
    else if (progress < 0.7) {
      const phaseProgress = (progress - 0.4) / 0.3
      // Luz aumenta
      lightIntensityRef.current = Math.min(3, phaseProgress * 3)
      if (lightRef.current) {
        lightRef.current.intensity = lightIntensityRef.current
      }
      // Círculo continua pulsando mas mais intenso
      if (circleRef.current) {
        const pulse = Math.sin(timeRef.current * 5) * 0.4 + 0.6
        circleRef.current.material.emissiveIntensity = pulse * 2.5
      }
    }
    // Fase 3: Círculo desaparece suavemente (70-100% do tempo)
    else {
      const phaseProgress = (progress - 0.7) / 0.3
      // Círculo desaparece
      circleOpacityRef.current = Math.max(0, 1 - phaseProgress)
      if (circleRef.current) {
        circleRef.current.material.opacity = circleOpacityRef.current
        circleRef.current.material.emissiveIntensity = circleOpacityRef.current * 1.5
      }
      // Luz também diminui
      lightIntensityRef.current = Math.max(0, 3 * (1 - phaseProgress))
      if (lightRef.current) {
        lightRef.current.intensity = lightIntensityRef.current
      }
    }
  })

  if (!isActive) return null

  return (
    <group ref={groupRef} position={[position.x, position.y + 0.01, position.z]}>
      {/* Círculo brilhante no chão */}
      <mesh 
        ref={circleRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
      >
        <ringGeometry args={[0.5, 2, 32]} />
        <meshStandardMaterial
          color="#6b9fff"
          emissive="#6b9fff"
          emissiveIntensity={2}
          transparent
          opacity={1}
          side={THREE.DoubleSide}
        />
      </mesh>
      
      {/* Círculo interno mais brilhante */}
      <mesh 
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.01, 0]}
      >
        <circleGeometry args={[1.2, 32]} />
        <meshStandardMaterial
          color="#4a9eff"
          emissive="#4a9eff"
          emissiveIntensity={1.5}
          transparent
          opacity={0.6}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Luz pontual que ilumina o avatar */}
      <pointLight
        ref={lightRef}
        position={[0, 1.5, 0]}
        intensity={0}
        distance={8}
        decay={2}
        color="#6b9fff"
      />
    </group>
  )
}

