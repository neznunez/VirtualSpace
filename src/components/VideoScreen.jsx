import { useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * Componente de vídeo 3D em loop
 * Posicionado na borda do ambiente, virado para dentro
 */
export default function VideoScreen({ 
  videoPath = '/zaza.mp4',
  position = [0, 5, -45], // Posição na borda (Z negativo = sul)
  rotation = [0, 0, 0], // Virado para dentro (norte)
  width = 16,
  height = 9,
  frameThickness = 0.3,
  frameColor = '#1a1a2e',
  muted = false // Controla se o vídeo tem som ou não
}) {
  const videoRef = useRef()
  const textureRef = useRef()
  const meshRef = useRef()
  const frameRef = useRef()

  useEffect(() => {
    // Criar elemento de vídeo - otimizado para performance máxima
    const video = document.createElement('video')
    video.src = videoPath
    video.crossOrigin = 'anonymous'
    video.loop = true
    video.autoplay = true
    video.playsInline = true
    video.muted = muted // Controlar som baseado na prop
    video.preload = 'auto' // Carregar vídeo antecipadamente
    video.load() // Forçar carregamento imediato
    // Otimizações de performance
    video.setAttribute('playsinline', '')
    video.setAttribute('webkit-playsinline', '')
    video.setAttribute('autoplay', '')
    // Desabilitar controles e outras features para melhor performance
    video.controls = false
    if (video.disablePictureInPicture !== undefined) {
      video.disablePictureInPicture = true
    }
    if (muted) {
      video.setAttribute('muted', '')
    }
    
    // Tratamento de erros
    video.addEventListener('error', (e) => {
      console.error('❌ Erro ao carregar vídeo:', videoPath, e)
      console.error('Vídeo error code:', video.error?.code, video.error?.message)
    })
    
    video.addEventListener('loadstart', () => {
      console.log('📹 Iniciando carregamento do vídeo:', videoPath)
    })
    
    videoRef.current = video

    // Criar textura do vídeo imediatamente - otimizada para performance máxima
    const texture = new THREE.VideoTexture(video)
    texture.minFilter = THREE.LinearFilter
    texture.magFilter = THREE.LinearFilter
    texture.format = THREE.RGBAFormat
    texture.flipY = true // Inverter verticalmente (corrigir de cabeça para baixo)
    texture.generateMipmaps = false // Desabilitar mipmaps para melhor performance em vídeo
    texture.anisotropy = 1 // Reduzir anisotropia para melhor performance
    texture.wrapS = THREE.ClampToEdgeWrapping
    texture.wrapT = THREE.ClampToEdgeWrapping
    textureRef.current = texture

    // Função para aplicar textura ao mesh - otimizada
    const applyTexture = () => {
      if (meshRef.current && textureRef.current) {
        const material = meshRef.current.material
        if (textureRef.current.image) {
          if (!material.map) {
            material.map = textureRef.current
            material.emissiveMap = textureRef.current
            material.needsUpdate = true
            console.log('✅ Textura aplicada ao mesh')
          }
        }
      }
    }

    // Função para iniciar reprodução em loop (sem fallback de interação)
    const startPlayback = () => {
      if (video.readyState >= 2) {
        video.play().then(() => {
          console.log('▶️ Vídeo reproduzindo:', videoPath)
        }).catch((err) => {
          console.warn('⚠️ Erro ao reproduzir vídeo, tentando novamente...', err)
          // Tentar novamente após delay
          setTimeout(() => {
            video.play().catch(() => {})
          }, 500)
        })
      }
    }

    // Quando o vídeo estiver pronto, aplicar textura e iniciar reprodução
    const handleCanPlay = () => {
      console.log('✅ Vídeo pronto para reprodução:', videoPath)
      applyTexture()
      startPlayback()
    }
    
    const handleLoadedData = () => {
      console.log('📥 Dados do vídeo carregados:', videoPath)
      applyTexture()
      startPlayback()
    }
    
    const handleCanPlayThrough = () => {
      console.log('🎬 Vídeo pode ser reproduzido completamente:', videoPath)
      applyTexture()
      startPlayback()
    }

    video.addEventListener('canplay', handleCanPlay)
    video.addEventListener('loadeddata', handleLoadedData)
    video.addEventListener('canplaythrough', handleCanPlayThrough)
    
    // Aplicar textura imediatamente se mesh já estiver disponível
    applyTexture()
    
    // Tentar reproduzir imediatamente em loop
    startPlayback()

    return () => {
      // Cleanup
      video.removeEventListener('canplay', handleCanPlay)
      video.removeEventListener('loadeddata', handleLoadedData)
      video.removeEventListener('canplaythrough', handleCanPlayThrough)
      if (textureRef.current) {
        textureRef.current.dispose()
      }
      if (video) {
        video.pause()
        video.src = ''
      }
    }
  }, [videoPath, muted])

  // Atualizar textura otimizada - reduzir atualizações para melhor performance
  const lastUpdateRef = useRef(0)
  useFrame(() => {
    if (!textureRef.current || !videoRef.current || !meshRef.current) return
    
    // Aplicar textura ao mesh quando estiver disponível (apenas uma vez)
    if (meshRef.current.material && textureRef.current.image) {
      if (!meshRef.current.material.map) {
        meshRef.current.material.map = textureRef.current
        meshRef.current.material.emissiveMap = textureRef.current
        meshRef.current.material.needsUpdate = true
      }
    }
    
    // Atualizar textura apenas quando necessário (a cada ~33ms = 30fps para vídeo)
    const now = Date.now()
    if (now - lastUpdateRef.current > 33) {
      if (videoRef.current && videoRef.current.readyState >= 2 && !videoRef.current.paused && !videoRef.current.ended) {
        if (textureRef.current) {
          textureRef.current.needsUpdate = true
        }
        lastUpdateRef.current = now
      }
    }
  })

  return (
    <group position={position} rotation={rotation}>
      {/* Frame do vídeo */}
      <group ref={frameRef}>
        {/* Borda superior */}
        <mesh position={[0, height / 2 + frameThickness / 2, 0]}>
          <boxGeometry args={[width + frameThickness * 2, frameThickness, 0.1]} />
          <meshStandardMaterial color={frameColor} />
        </mesh>
        {/* Borda inferior */}
        <mesh position={[0, -height / 2 - frameThickness / 2, 0]}>
          <boxGeometry args={[width + frameThickness * 2, frameThickness, 0.1]} />
          <meshStandardMaterial color={frameColor} />
        </mesh>
        {/* Borda esquerda */}
        <mesh position={[-width / 2 - frameThickness / 2, 0, 0]}>
          <boxGeometry args={[frameThickness, height, 0.1]} />
          <meshStandardMaterial color={frameColor} />
        </mesh>
        {/* Borda direita */}
        <mesh position={[width / 2 + frameThickness / 2, 0, 0]}>
          <boxGeometry args={[frameThickness, height, 0.1]} />
          <meshStandardMaterial color={frameColor} />
        </mesh>
      </group>

      {/* Tela do vídeo - apenas no lado virado para o centro */}
      <mesh ref={meshRef} position={[0, 0, 0.05]} scale={[-1, 1, 1]}>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial 
          side={THREE.FrontSide}
          emissive={0xffffff}
          emissiveIntensity={3.5}
          toneMapped={false}
          color={0xffffff}
        />
      </mesh>

      {/* Luzes de emissão do telão - simulando luz real na frente (otimizado) */}
      <pointLight 
        position={[0, 0, 0.5]} 
        intensity={2} 
        distance={45}
        decay={1.4}
        color="#ffffff"
      />
      
      <pointLight 
        position={[0, height / 3, 0.4]} 
        intensity={1.2} 
        distance={40}
        decay={1.5}
        color="#ffffff"
      />
      <pointLight 
        position={[0, -height / 3, 0.4]} 
        intensity={1.2} 
        distance={40}
        decay={1.5}
        color="#ffffff"
      />
      
      <pointLight 
        position={[-width / 3, 0, 0.4]} 
        intensity={1} 
        distance={35}
        decay={1.6}
        color="#ffffff"
      />
      <pointLight 
        position={[width / 3, 0, 0.4]} 
        intensity={1} 
        distance={35}
        decay={1.6}
        color="#ffffff"
      />
    </group>
  )
}

