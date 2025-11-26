import { useRef, useEffect, memo, useMemo, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Gltf, Text } from '@react-three/drei'
import * as THREE from 'three'

// Função para interpolação suave (lerp)
function lerp(start, end, factor) {
  return start + (end - start) * factor
}

const RemotePlayer = memo(function RemotePlayer({ player }) {
  // Validar dados do player
  if (!player || !player.id) {
    return null
  }
  
  const groupRef = useRef()
  const floatGroupRef = useRef()
  const timeRef = useRef(0)
  const fadeTimeRef = useRef(0)
  const [opacity, setOpacity] = useState(0) // Começar invisível para fade in
  
  // Garantir que position existe, senão usar (0, 0, 0)
  const initialPos = player.position || { x: 0, y: 0, z: 0 }
  const targetPosition = useRef(new THREE.Vector3(initialPos.x, initialPos.y, initialPos.z))
  const targetRotation = useRef(player.rotation?.y || 0)
  
  // Fade in quando o player é criado
  useEffect(() => {
    fadeTimeRef.current = 0
    setOpacity(0)
    // Fade in suave
    const fadeDuration = 0.8
    const interval = setInterval(() => {
      fadeTimeRef.current += 0.016
      const progress = Math.min(fadeTimeRef.current / fadeDuration, 1)
      setOpacity(progress)
      
      if (progress >= 1) {
        clearInterval(interval)
      }
    }, 16)

    return () => clearInterval(interval)
  }, [player.id]) // Reset quando player muda

  // Atualizar posição alvo quando receber novos dados do player
  // Usar valores específicos para evitar re-execuções desnecessárias
  useEffect(() => {
    const pos = player.position || { x: 0, y: 0, z: 0 }
    targetPosition.current.set(pos.x, pos.y, pos.z)

    const rotY = player.rotation?.y ?? 0
    targetRotation.current = rotY
  }, [
    player.position?.x, 
    player.position?.y, 
    player.position?.z,
    player.rotation?.y
  ])

  // Interpolação suave de posição e rotação + animação de flutuação
  useFrame((state, delta) => {
    if (groupRef.current) {
      // Lerp adaptativo baseado em delta time (mais responsivo)
      // Usar delta * 15 para interpolação frame-rate independent
      const lerpFactor = Math.min(delta * 15, 0.3) // Máximo 30% por frame
      groupRef.current.position.lerp(targetPosition.current, lerpFactor)
      
      // Lerp para rotação
      const currentRotation = groupRef.current.rotation.y
      const newRotation = lerp(currentRotation, targetRotation.current, lerpFactor)
      groupRef.current.rotation.y = newRotation
    }

    // Animação de flutuação (igual ao player local)
    if (floatGroupRef.current) {
      timeRef.current += delta
      const floatAmount = Math.sin(timeRef.current * 2) * 0.1
      floatGroupRef.current.position.y = floatAmount
      
      // Aplicar fade in no modelo GLTF (usar floatGroupRef que contém o modelo)
      if (floatGroupRef.current && opacity < 1) {
        floatGroupRef.current.traverse((child) => {
          if (child.isMesh && child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(mat => {
                if (mat && typeof mat.transparent !== 'undefined') {
                  mat.transparent = true
                  mat.opacity = opacity
                }
              })
            } else {
              if (child.material && typeof child.material.transparent !== 'undefined') {
                child.material.transparent = true
                child.material.opacity = opacity
              }
            }
          }
        })
      }
    }
  })

  // Determinar qual modelo usar baseado no characterType (memoizado)
  const characterModel = useMemo(() => {
    const models = ['/VirtualHead.glb', '/NPCHead.glb', '/ghost_w_tophat-transformed.glb']
    return models[player.characterType] || models[0]
  }, [player.characterType])
  
  // Memoizar tamanho do frame do nickname
  const frameWidth = useMemo(() => {
    return (player.nickname?.length || 0) * 0.18 + 0.3
  }, [player.nickname])

  return (
    <group ref={groupRef}>
      {/* Grupo de flutuação */}
      <group ref={floatGroupRef}>
        {/* Nickname acima da cabeça */}
        {player.nickname && (
          <group position={[0, 2.3, 0]}>
            {/* Frame preto semi-transparente */}
            <mesh position={[0, 0, -0.01]}>
              <planeGeometry args={[frameWidth, 0.45]} />
              <meshBasicMaterial color="#000000" transparent opacity={0.6 * opacity} />
            </mesh>
            {/* Texto do nickname */}
            <Text
              position={[0, 0, 0]}
              fontSize={0.3}
              color="#ffffff"
              anchorX="center"
              anchorY="middle"
              opacity={opacity}
            >
              {player.nickname}
            </Text>
          </group>
        )}
        {/* Modelo 3D do avatar remoto com fade in */}
        <Gltf 
          castShadow 
          receiveShadow 
          scale={1.0} 
          src={characterModel}
        />
      </group>
    </group>
  )
}, (prevProps, nextProps) => {
  // Comparação customizada - PERMITIR atualizações de posição
  if (prevProps.player.id !== nextProps.player.id) return false
  if (prevProps.player.nickname !== nextProps.player.nickname) return false
  if (prevProps.player.characterType !== nextProps.player.characterType) return false
  
  // IMPORTANTE: Permitir re-render se posição mudou (para atualizar useEffect)
  // Mas usar valores específicos para evitar re-renders desnecessários
  const prevPos = prevProps.player.position || { x: 0, y: 0, z: 0 }
  const nextPos = nextProps.player.position || { x: 0, y: 0, z: 0 }
  
  const posChanged = 
    prevPos.x !== nextPos.x ||
    prevPos.y !== nextPos.y ||
    prevPos.z !== nextPos.z ||
    (prevProps.player.rotation?.y || 0) !== (nextProps.player.rotation?.y || 0)
  
  // Se posição mudou, precisa re-renderizar para atualizar o useEffect
  return !posChanged
})

export default RemotePlayer

