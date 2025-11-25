import { useRef, useEffect, useState, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * Animação de entrada quando um player entra na sala
 * Efeito de partículas surgindo do chão (como um gênio da lâmpada)
 */
export default function JoinAnimation({ position, duration = 2 }) {
  const groupRef = useRef()
  const particlesRef = useRef([])
  const [isActive, setIsActive] = useState(true)
  const timeRef = useRef(0)

  // Criar partículas uma vez (reduzido para melhor performance)
  const particles = useMemo(() => {
    const particleCount = 20 // Reduzido de 30 para 20
    const particles = []

    for (let i = 0; i < particleCount; i++) {
      const particle = {
        position: new THREE.Vector3(
          (Math.random() - 0.5) * 2,
          -1, // Começar abaixo do chão
          (Math.random() - 0.5) * 2
        ),
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 0.5,
          Math.random() * 2 + 1, // Velocidade para cima
          (Math.random() - 0.5) * 0.5
        ),
        size: Math.random() * 0.25 + 0.1, // Tamanho ligeiramente menor
        opacity: 1,
        color: new THREE.Color().setHSL(Math.random() * 0.1 + 0.5, 0.8, 0.6) // Tons de azul/roxo
      }
      particles.push(particle)
    }

    return particles
  }, [])

  useEffect(() => {
    // Inicializar partículas
    particlesRef.current = particles.map(p => ({
      position: p.position.clone(),
      velocity: p.velocity.clone(),
      size: p.size,
      opacity: p.opacity,
      color: p.color.clone()
    }))

    // Resetar tempo
    timeRef.current = 0

    // Desativar após a duração
    const timer = setTimeout(() => {
      setIsActive(false)
    }, duration * 1000)

    return () => clearTimeout(timer)
  }, [duration, particles])

  useFrame((state, delta) => {
    if (!isActive || !groupRef.current || particlesRef.current.length === 0) return

    timeRef.current += delta
    const progress = timeRef.current / duration

    // Atualizar partículas (otimizado)
    const velocityScale = delta
    const gravity = delta * 2
    
    for (let i = 0; i < particlesRef.current.length; i++) {
      const particle = particlesRef.current[i]
      
      // Atualizar posição (evitar clone desnecessário)
      particle.position.x += particle.velocity.x * velocityScale
      particle.position.y += particle.velocity.y * velocityScale
      particle.position.z += particle.velocity.z * velocityScale

      // Reduzir velocidade (gravidade/atrito)
      particle.velocity.multiplyScalar(0.95)
      particle.velocity.y -= gravity

      // Reduzir opacidade ao longo do tempo
      particle.opacity = Math.max(0, 1 - progress)
    }
  })

  if (!isActive || particlesRef.current.length === 0) return null

  return (
    <group ref={groupRef} position={[position.x, position.y, position.z]}>
      {/* Partículas - usando geometria compartilhada para melhor performance */}
      {particlesRef.current.map((particle, index) => (
        <mesh 
          key={index} 
          position={[particle.position.x, particle.position.y, particle.position.z]}
        >
          <sphereGeometry args={[particle.size, 6, 6]} />
          <meshStandardMaterial
            color={particle.color}
            transparent
            opacity={particle.opacity}
            emissive={particle.color}
            emissiveIntensity={0.5}
          />
        </mesh>
      ))}

      {/* Efeito de luz central */}
      <pointLight
        position={[0, 0, 0]}
        intensity={2}
        distance={5}
        decay={2}
        color="#6b9fff"
      />
    </group>
  )
}

