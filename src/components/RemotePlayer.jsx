import { useRef, useEffect, memo, useMemo } from 'react'
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
  
  // Garantir que position existe, senão usar (0, 0, 0)
  const initialPos = player.position || { x: 0, y: 0, z: 0 }
  const targetPosition = useRef(new THREE.Vector3(initialPos.x, initialPos.y, initialPos.z))
  const targetRotation = useRef(player.rotation?.y || 0)

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
      // Lerp para posição (suaviza o movimento)
      groupRef.current.position.lerp(targetPosition.current, 0.1)
      
      // Lerp para rotação
      const currentRotation = groupRef.current.rotation.y
      const newRotation = lerp(currentRotation, targetRotation.current, 0.1)
      groupRef.current.rotation.y = newRotation
    }

    // Animação de flutuação (igual ao player local)
    if (floatGroupRef.current) {
      timeRef.current += delta
      const floatAmount = Math.sin(timeRef.current * 2) * 0.1
      floatGroupRef.current.position.y = floatAmount
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
              {player.nickname}
            </Text>
          </group>
        )}
        {/* Modelo 3D do avatar remoto */}
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
  // Comparação customizada para evitar re-renders desnecessários
  // Retorna true se NÃO deve re-renderizar (valores iguais)
  // Retorna false se DEVE re-renderizar (valores diferentes)
  if (prevProps.player.id !== nextProps.player.id) return false
  if (prevProps.player.nickname !== nextProps.player.nickname) return false
  if (prevProps.player.characterType !== nextProps.player.characterType) return false
  
  // Para posição/rotação, permitir atualizações (serão tratadas no useEffect)
  // Mas evitar re-render se apenas posição mudou (já é atualizada via ref)
  return true
})

export default RemotePlayer

