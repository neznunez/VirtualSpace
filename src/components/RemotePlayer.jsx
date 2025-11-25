import { useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Gltf, Text } from '@react-three/drei'
import * as THREE from 'three'

// Função para interpolação suave (lerp)
function lerp(start, end, factor) {
  return start + (end - start) * factor
}

export default function RemotePlayer({ player }) {
  const groupRef = useRef()
  const floatGroupRef = useRef()
  const timeRef = useRef(0)
  const targetPosition = useRef(new THREE.Vector3(player.position.x, player.position.y, player.position.z))
  const targetRotation = useRef(player.rotation.y || 0)

  // Atualizar posição alvo quando receber novos dados do player
  useEffect(() => {
    if (player.position) {
      targetPosition.current.set(
        player.position.x,
        player.position.y,
        player.position.z
      )
    }

    if (player.rotation !== undefined) {
      targetRotation.current = player.rotation.y || 0
    }
  }, [player.position, player.rotation])

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

  // Determinar qual modelo usar baseado no characterType
  const getCharacterModel = (type) => {
    const models = ['/VirtualHead.glb', '/NPCHead.glb', '/ghost_w_tophat-transformed.glb']
    return models[type] || models[0]
  }

  return (
    <group ref={groupRef}>
      {/* Grupo de flutuação */}
      <group ref={floatGroupRef}>
        {/* Nickname acima da cabeça */}
        {player.nickname && (
          <group position={[0, 2.3, 0]}>
            {/* Frame preto semi-transparente */}
            <mesh position={[0, 0, -0.01]}>
              <planeGeometry args={[player.nickname.length * 0.18 + 0.3, 0.45]} />
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
          src={getCharacterModel(player.characterType)} 
        />
      </group>
    </group>
  )
}

