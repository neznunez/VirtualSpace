import { useState, useRef, useEffect, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Gltf, useEnvironment, Text } from '@react-three/drei'
import * as THREE from 'three'

// Componente para renderizar o modelo 3D no carrossel
function CharacterPreview({ modelPath, nickname }) {
  const groupRef = useRef()
  
  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.3
    }
  })
  
  return (
    <group ref={groupRef} rotation={[0, 0, 0]}>
      {/* Modelo 3D posicionado mais baixo e centralizado - FIXO */}
      <group position={[0, -2.5, 0]}>
        <Gltf src={modelPath} scale={2} />
        {/* Nickname acima da cabeça do avatar */}
        {nickname && (
          <Text
            position={[0, 1.2, 0]}
            fontSize={0.25}
            color="#ffffff"
            anchorX="center"
            anchorY="bottom"
            outlineWidth={0.03}
            outlineColor="#000000"
          >
            {nickname}
          </Text>
        )}
      </group>
    </group>
  )
}

// Componente para controlar parallax da câmera
function ParallaxCamera({ mousePosition }) {
  const { camera } = useThree()
  const targetPosition = useRef([0, 0, 5])
  
  useFrame(() => {
    if (mousePosition.current) {
      const { x, y } = mousePosition.current
      // Movimento suave da câmera baseado na posição do mouse
      // Multiplicadores pequenos para movimento sutil
      targetPosition.current[0] = x * 0.3
      targetPosition.current[1] = y * 0.3
      
      // Interpolação suave (lerp) para movimento fluido
      camera.position.x += (targetPosition.current[0] - camera.position.x) * 0.05
      camera.position.y += (targetPosition.current[1] - camera.position.y) * 0.05
      camera.lookAt(0, 0, 0)
    }
  })
  
  return null
}

// Estrelas com parallax
function ParallaxStars({ mousePosition }) {
  const starsRef = useRef()
  const stars = useMemo(() => {
    const starsGeometry = new THREE.BufferGeometry()
    const starsMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.3,
      sizeAttenuation: true,
    })
    
    const starsVertices = []
    for (let i = 0; i < 1000; i++) {
      const x = (Math.random() - 0.5) * 50
      const y = (Math.random() - 0.5) * 50
      const z = (Math.random() - 0.5) * 50
      starsVertices.push(x, y, z)
    }
    
    starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starsVertices, 3))
    return new THREE.Points(starsGeometry, starsMaterial)
  }, [])
  
  useFrame(() => {
    if (starsRef.current && mousePosition.current) {
      const { x, y } = mousePosition.current
      // Movimento parallax mais rápido nas estrelas (camada mais distante)
      starsRef.current.position.x = x * 0.5
      starsRef.current.position.y = y * 0.5
    }
  })
  
  return <primitive ref={starsRef} object={stars} />
}

// Cena de fundo (versão mais escura)
function BackgroundScene({ mousePosition }) {
  const envMap = useEnvironment({ files: '/night.hdr' })
  const meshRef = useRef()
  
  useFrame(() => {
    if (meshRef.current && mousePosition.current) {
      const { x, y } = mousePosition.current
      // Movimento parallax mais sutil no chão (camada mais próxima)
      meshRef.current.position.x = x * 0.1
      meshRef.current.position.z = y * 0.1
    }
  })
  
  return (
    <>
      <ParallaxStars mousePosition={mousePosition} />
      <ambientLight intensity={0.1} />
      <directionalLight intensity={0.3} position={[-20, 20, 20]} />
      <mesh 
        ref={meshRef}
        rotation={[-Math.PI / 2, 0, 0]} 
        position={[0, -2, 0]}
      >
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#1a1a2e" />
      </mesh>
    </>
  )
}

export default function CharacterSelection({ onJoin }) {
  const [selectedCharacter, setSelectedCharacter] = useState(0)
  const [nickname, setNickname] = useState('')
  const mousePosition = useRef({ x: 0, y: 0 })
  const containerRef = useRef(null)
  
  const characters = [
    { id: 0, name: 'Opção 1', model: '/VirtualHead.glb' },
    { id: 1, name: 'Opção 2', model: '/NPCHead.glb' },
  ]
  
  // Efeito parallax baseado no movimento do mouse
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        // Normalizar posição do mouse (-1 a 1)
        const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2
        const y = ((e.clientY - rect.top) / rect.height - 0.5) * -2 // Invertido para movimento natural
        
        mousePosition.current = { x, y }
      }
    }
    
    const container = containerRef.current
    if (container) {
      container.addEventListener('mousemove', handleMouseMove)
      return () => container.removeEventListener('mousemove', handleMouseMove)
    }
  }, [])
  
  const handlePrevious = () => {
    setSelectedCharacter((prev) => 
      prev === 0 ? characters.length - 1 : prev - 1
    )
  }
  
  const handleNext = () => {
    setSelectedCharacter((prev) => 
      prev === characters.length - 1 ? 0 : prev + 1
    )
  }
  
  const handleJoin = () => {
    if (nickname.trim()) {
      onJoin(nickname.trim(), selectedCharacter)
    }
  }
  
  return (
    <div 
      ref={containerRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
      }}
    >
      {/* Fundo 3D com glassmorphism estilo Apple */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        background: 'linear-gradient(135deg, #0a0a1a 0%, #1a1a2e 50%, #0f1419 100%)',
      }}>
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          opacity: 0.5,
        }}>
          <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
            <ParallaxCamera mousePosition={mousePosition} />
            <BackgroundScene mousePosition={mousePosition} />
          </Canvas>
        </div>
        {/* Overlay sutil estilo Apple */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'radial-gradient(circle at 50% 0%, rgba(255, 255, 255, 0.03) 0%, transparent 50%)',
        }} />
      </div>
      
      {/* Conteúdo centralizado */}
      <div style={{
        position: 'relative',
        zIndex: 2,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '2rem',
      }}>
        {/* Carrossel de personagens */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '2rem',
        }}>
          {/* Botão seta esquerda */}
          <button
            onClick={handlePrevious}
            style={{
              background: 'rgba(255, 255, 255, 0.07)',
              backdropFilter: 'blur(20px) saturate(180%)',
              WebkitBackdropFilter: 'blur(20px) saturate(180%)',
              border: '0.5px solid rgba(255, 255, 255, 0.18)',
              color: '#ffffff',
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              cursor: 'pointer',
              fontSize: '1.1rem',
              fontWeight: 300,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12), 0 0 0 0.5px rgba(255, 255, 255, 0.05) inset',
              padding: 0,
              lineHeight: 1,
            }}
            onMouseEnter={(e) => {
              e.target.style.background = 'rgba(255, 255, 255, 0.12)'
              e.target.style.border = '0.5px solid rgba(255, 255, 255, 0.25)'
              e.target.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.15), 0 0 0 0.5px rgba(255, 255, 255, 0.08) inset'
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'rgba(255, 255, 255, 0.07)'
              e.target.style.border = '0.5px solid rgba(255, 255, 255, 0.18)'
              e.target.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.12), 0 0 0 0.5px rgba(255, 255, 255, 0.05) inset'
            }}
          >
            ‹
          </button>
          
          {/* Preview 3D do personagem */}
          <div style={{
            width: '300px',
            height: '300px',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem',
          }}>
            <div style={{
              width: '100%',
              height: '250px',
              border: 'none',
              borderRadius: '20px',
              overflow: 'hidden',
              background: 'transparent',
            }}>
              <Canvas camera={{ position: [0, -0.5, 5], fov: 60 }}>
                <ambientLight intensity={0.5} />
                <directionalLight intensity={0.8} position={[5, 5, 5]} />
                <CharacterPreview 
                  modelPath={characters[selectedCharacter].model}
                  nickname={nickname || undefined}
                />
              </Canvas>
            </div>
            
            {/* Título do personagem */}
            <div style={{
              color: '#ffffff',
              fontSize: '1.5rem',
              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif',
              fontWeight: 600,
              textAlign: 'center',
              letterSpacing: '-0.02em',
            }}>
              {characters[selectedCharacter].name}
            </div>
          </div>
          
          {/* Botão seta direita */}
          <button
            onClick={handleNext}
            style={{
              background: 'rgba(255, 255, 255, 0.07)',
              backdropFilter: 'blur(20px) saturate(180%)',
              WebkitBackdropFilter: 'blur(20px) saturate(180%)',
              border: '0.5px solid rgba(255, 255, 255, 0.18)',
              color: '#ffffff',
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              cursor: 'pointer',
              fontSize: '1.1rem',
              fontWeight: 300,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12), 0 0 0 0.5px rgba(255, 255, 255, 0.05) inset',
              padding: 0,
              lineHeight: 1,
            }}
            onMouseEnter={(e) => {
              e.target.style.background = 'rgba(255, 255, 255, 0.12)'
              e.target.style.border = '0.5px solid rgba(255, 255, 255, 0.25)'
              e.target.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.15), 0 0 0 0.5px rgba(255, 255, 255, 0.08) inset'
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'rgba(255, 255, 255, 0.07)'
              e.target.style.border = '0.5px solid rgba(255, 255, 255, 0.18)'
              e.target.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.12), 0 0 0 0.5px rgba(255, 255, 255, 0.05) inset'
            }}
          >
            ›
          </button>
        </div>
        
        {/* Campo de texto para nickname */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.5rem',
        }}>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value.slice(0, 12))}
            placeholder="Digite seu nome"
            maxLength={12}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && nickname.trim()) {
                handleJoin()
              }
            }}
            onFocus={(e) => {
              e.target.style.background = 'rgba(255, 255, 255, 0.12)'
              e.target.style.border = '0.5px solid rgba(255, 255, 255, 0.3)'
              e.target.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.15), 0 0 0 0.5px rgba(255, 255, 255, 0.08) inset'
            }}
            onBlur={(e) => {
              e.target.style.background = 'rgba(255, 255, 255, 0.07)'
              e.target.style.border = '0.5px solid rgba(255, 255, 255, 0.18)'
              e.target.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.12), 0 0 0 0.5px rgba(255, 255, 255, 0.05) inset'
            }}
            style={{
              background: 'rgba(255, 255, 255, 0.07)',
              backdropFilter: 'blur(20px) saturate(180%)',
              WebkitBackdropFilter: 'blur(20px) saturate(180%)',
              border: '0.5px solid rgba(255, 255, 255, 0.18)',
              color: '#ffffff',
              padding: '1rem 1.5rem',
              fontSize: '1.2rem',
              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif',
              borderRadius: '12px',
              width: '300px',
              textAlign: 'center',
              outline: 'none',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12), 0 0 0 0.5px rgba(255, 255, 255, 0.05) inset',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          />
          <div style={{
            color: 'rgba(255, 255, 255, 0.6)',
            fontSize: '0.85rem',
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif',
            fontWeight: 400,
            letterSpacing: '0.01em',
          }}>
            {nickname.length}/12 caracteres
          </div>
        </div>
        
        {/* Botão entrar */}
        <button
          onClick={handleJoin}
          disabled={!nickname.trim()}
          style={{
            background: nickname.trim() 
              ? 'rgba(255, 255, 255, 0.12)' 
              : 'rgba(255, 255, 255, 0.04)',
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            color: nickname.trim() ? '#ffffff' : 'rgba(255, 255, 255, 0.4)',
            border: nickname.trim() 
              ? '0.5px solid rgba(255, 255, 255, 0.25)' 
              : '0.5px solid rgba(255, 255, 255, 0.1)',
            padding: '1rem 3rem',
            fontSize: '1.1rem',
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif',
            fontWeight: 600,
            borderRadius: '12px',
            cursor: nickname.trim() ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            boxShadow: nickname.trim()
              ? '0 4px 16px rgba(0, 0, 0, 0.12), 0 0 0 0.5px rgba(255, 255, 255, 0.05) inset'
              : '0 2px 8px rgba(0, 0, 0, 0.08), 0 0 0 0.5px rgba(255, 255, 255, 0.03) inset',
          }}
          onMouseEnter={(e) => {
            if (nickname.trim()) {
              e.target.style.background = 'rgba(255, 255, 255, 0.16)'
              e.target.style.border = '0.5px solid rgba(255, 255, 255, 0.3)'
              e.target.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.15), 0 0 0 0.5px rgba(255, 255, 255, 0.08) inset'
            }
          }}
          onMouseLeave={(e) => {
            if (nickname.trim()) {
              e.target.style.background = 'rgba(255, 255, 255, 0.12)'
              e.target.style.border = '0.5px solid rgba(255, 255, 255, 0.25)'
              e.target.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.12), 0 0 0 0.5px rgba(255, 255, 255, 0.05) inset'
            }
          }}
        >
          Entrar na Sala
        </button>
      </div>
    </div>
  )
}

