import { useRef, useEffect, memo, useMemo, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Gltf, Text } from '@react-three/drei'
import * as THREE from 'three'

/**
 * FASE 2: RemotePlayer otimizado
 * 
 * Recebe apenas dados estáticos (id, nickname, characterType) e getDynamic
 * Movimento 100% no useFrame usando getDynamic (não depende de React re-renders)
 */
const RemotePlayer = memo(function RemotePlayer({ id, nickname, characterType, getDynamic }) {
  // Validar dados
  if (!id || !getDynamic) {
    return null
  }
  
  const groupRef = useRef()
  const floatGroupRef = useRef()
  const timeRef = useRef(0)
  const fadeTimeRef = useRef(0)
  const [opacity, setOpacity] = useState(0) // Começar invisível para fade in
  
  // FASE 2: Target position/rotation (atualizados no useFrame via getDynamic)
  const targetPos = useRef(new THREE.Vector3(0, 1.0, 0))
  const targetRotY = useRef(0)
  const isInitialized = useRef(false) // CORREÇÃO: Flag para primeira inicialização
  
  // CORREÇÃO 3: Inicializar posição imediatamente quando componente monta
  useEffect(() => {
    // Tentar pegar dados imediatamente
    const dyn = getDynamic(id)
    if (dyn && dyn.position && groupRef.current) {
      // Teleportar imediatamente para posição correta do servidor
      groupRef.current.position.copy(dyn.position)
      groupRef.current.rotation.y = dyn.rotY
      targetPos.current.copy(dyn.position)
      targetRotY.current = dyn.rotY
      isInitialized.current = true
    } else {
      // Se não encontrou dados, marcar como não inicializado
      isInitialized.current = false
    }
  }, [id, getDynamic]) // Re-executar se id mudar
  
  // Fade in quando o player é criado
  useEffect(() => {
    fadeTimeRef.current = 0
    setOpacity(0)
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
  }, [id]) // Reset quando id muda

  // FASE 2: Movimento 100% no useFrame - pega dados dinâmicos via getDynamic
  // CORREÇÃO: Abordagem mais direta baseada em three-arena
  useFrame((_, delta) => {
    const g = groupRef.current
    if (!g) return

    // Pegar dados dinâmicos do Map
    const dyn = getDynamic(id)
    if (!dyn || !dyn.position) {
      if (!isInitialized.current) return
      return
    }

    // Primeira vez: inicializar imediatamente
    if (!isInitialized.current) {
      g.position.set(dyn.position.x, dyn.position.y, dyn.position.z)
      g.rotation.y = dyn.rotY
      targetPos.current.set(dyn.position.x, dyn.position.y, dyn.position.z)
      targetRotY.current = dyn.rotY
      isInitialized.current = true
      return
    }

    // Atualizar target position/rotation (sempre usar valores diretos)
    targetPos.current.set(dyn.position.x, dyn.position.y, dyn.position.z)
    targetRotY.current = dyn.rotY

    // Teleporte se muito longe (lag severo)
    const TELEPORT_DISTANCE = 10
    const distance = g.position.distanceTo(targetPos.current)
    if (distance > TELEPORT_DISTANCE) {
      g.position.copy(targetPos.current)
      g.rotation.y = targetRotY.current
      return
    }

    // Interpolação exponencial (frame-rate independent)
    // Baseado em three-arena: usar lerp mais agressivo para movimento mais responsivo
    const t = 1 - Math.exp(-30 * delta) // Aumentado de 25 para 30 (mais responsivo)

    g.position.lerp(targetPos.current, t)
    g.rotation.y += (targetRotY.current - g.rotation.y) * t

    // Animação de flutuação (igual ao player local)
    if (floatGroupRef.current) {
      timeRef.current += delta
      const floatAmount = Math.sin(timeRef.current * 2) * 0.1
      floatGroupRef.current.position.y = floatAmount
      
      // Aplicar fade in no modelo GLTF (otimizado)
      if (opacity < 1) {
        // Cache de materiais para evitar traverse repetido
        if (!floatGroupRef.current.userData.materialsCached) {
          floatGroupRef.current.userData.materials = []
          floatGroupRef.current.traverse((child) => {
            if (child.isMesh && child.material) {
              if (Array.isArray(child.material)) {
                floatGroupRef.current.userData.materials.push(...child.material)
              } else {
                floatGroupRef.current.userData.materials.push(child.material)
              }
            }
          })
          floatGroupRef.current.userData.materialsCached = true
        }
        
        // Aplicar opacity apenas nos materiais cacheados
        floatGroupRef.current.userData.materials.forEach(mat => {
          if (mat && typeof mat.transparent !== 'undefined') {
            mat.transparent = true
            mat.opacity = opacity
          }
        })
      }
    }
  })

  // Determinar qual modelo usar baseado no characterType (memoizado)
  const characterModel = useMemo(() => {
    const models = ['/VirtualHead.glb', '/NPCHead.glb', '/ghost_w_tophat-transformed.glb']
    return models[characterType] || models[0]
  }, [characterType])
  
  // Memoizar tamanho do frame do nickname
  const frameWidth = useMemo(() => {
    return (nickname?.length || 0) * 0.18 + 0.3
  }, [nickname])

  return (
    <group ref={groupRef}>
      {/* Grupo de flutuação */}
      <group ref={floatGroupRef}>
        {/* Nickname acima da cabeça */}
        {nickname && (
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
              {nickname}
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
  // FASE 2: Comparação simplificada - apenas dados estáticos
  // Posição/rotação não importam mais (são gerenciadas no useFrame via getDynamic)
  if (prevProps.id !== nextProps.id) return false
  if (prevProps.nickname !== nextProps.nickname) return false
  if (prevProps.characterType !== nextProps.characterType) return false
  
  // Se dados estáticos são iguais, não precisa re-render
  // (movimento é gerenciado no useFrame, não depende de props)
  return true
})

export default RemotePlayer

