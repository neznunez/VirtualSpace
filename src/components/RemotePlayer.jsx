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
  
  // Garantir que position existe, senão usar (0, 1.0, 0) - Y padrão do ecctrl
  const initialPos = player.position || { x: 0, y: 1.0, z: 0 }
  // Se Y for 0, ajustar para 1.0 (altura padrão do ecctrl)
  const adjustedY = initialPos.y === 0 ? 1.0 : initialPos.y
  const targetPosition = useRef(new THREE.Vector3(initialPos.x, adjustedY, initialPos.z))
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
    const pos = player.position || { x: 0, y: 1.0, z: 0 }
    // Se Y for 0, ajustar para 1.0 (altura padrão do ecctrl Controller)
    const adjustedY = pos.y === 0 ? 1.0 : pos.y
    const newTarget = new THREE.Vector3(pos.x, adjustedY, pos.z)
    
    console.log(`📍 [RemotePlayer] Atualizando posição de ${player.nickname}:`, { x: pos.x, y: adjustedY, z: pos.z })
    
    // Se for a primeira vez ou mudança grande (spawn inicial ou lag), teleportar
    if (groupRef.current) {
      const distance = groupRef.current.position.distanceTo(newTarget)
      if (distance > 5) {
        // Teleportar se muito longe (spawn inicial ou lag severo)
        groupRef.current.position.copy(newTarget)
        console.log(`🚀 [RemotePlayer] Teleportando player remoto ${player.nickname}:`, { x: pos.x, y: adjustedY, z: pos.z })
      }
    }
    
    targetPosition.current.set(pos.x, adjustedY, pos.z)
    targetRotation.current = player.rotation?.y ?? 0
  }, [
    player.position?.x, 
    player.position?.y, 
    player.position?.z,
    player.rotation?.y
  ])

  // Interpolação suave de posição e rotação + animação de flutuação
  useFrame((state, delta) => {
    if (groupRef.current) {
      // FALLBACK: Atualizar targetPosition diretamente do player.position (garantia extra)
      // Isso garante que mesmo se o useEffect não acionar, a posição seja atualizada
      const pos = player.position || { x: 0, y: 1.0, z: 0 }
      const adjustedY = pos.y === 0 ? 1.0 : pos.y
      targetPosition.current.set(pos.x, adjustedY, pos.z)
      targetRotation.current = player.rotation?.y ?? 0
      
      // Lerp mais rápido e responsivo para movimento mais fluido
      // Usar delta * 25 para interpolação frame-rate independent mais rápida
      const lerpFactor = Math.min(delta * 25, 0.5) // Máximo 50% por frame (mais responsivo)
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
  // Se ID mudou, re-render
  if (prevProps.player?.id !== nextProps.player?.id) return false
  
  // Se dados básicos mudaram, re-render
  if (prevProps.player?.nickname !== nextProps.player?.nickname) return false
  if (prevProps.player?.characterType !== nextProps.player?.characterType) return false
  
  // Comparar posição com precisão maior (detectar mudanças muito pequenas)
  const prevPos = prevProps.player?.position || { x: 0, y: 1.0, z: 0 }
  const nextPos = nextProps.player?.position || { x: 0, y: 1.0, z: 0 }
  
  // Se qualquer coordenada mudou (mesmo que pouco), re-render
  const posChanged = 
    Math.abs(prevPos.x - nextPos.x) > 0.0001 ||
    Math.abs(prevPos.y - nextPos.y) > 0.0001 ||
    Math.abs(prevPos.z - nextPos.z) > 0.0001 ||
    Math.abs((prevProps.player?.rotation?.y || 0) - (nextProps.player?.rotation?.y || 0)) > 0.0001
  
  // Se posição mudou, re-render (retorna false = não é igual = precisa re-render)
  // Se não mudou, não re-render (retorna true = é igual = não precisa re-render)
  return !posChanged
})

export default RemotePlayer

