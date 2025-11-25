import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { Physics, RigidBody, useRapier } from '@react-three/rapier'
import { Gltf, useEnvironment, Fisheye, KeyboardControls } from '@react-three/drei'
import { useEffect, useMemo, useState, useRef } from 'react'
import * as THREE from 'three'
import Controller from 'ecctrl'

function SceneSetup() {
  const envMap = useEnvironment({ files: '/night.hdr' })
  const { scene } = useThree()
  
  useEffect(() => {
    scene.environment = envMap
    scene.background = null
  }, [envMap, scene])
  
  return null
}

function NightSky() {
  const stars = useMemo(() => {
    const starsGeometry = new THREE.BufferGeometry()
    const starsMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.5,
      sizeAttenuation: true,
    })
    
    const starsVertices = []
    for (let i = 0; i < 5000; i++) {
      const x = (Math.random() - 0.5) * 2000
      const y = (Math.random() - 0.5) * 2000
      const z = (Math.random() - 0.5) * 2000
      starsVertices.push(x, y, z)
    }
    
    starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starsVertices, 3))
    return new THREE.Points(starsGeometry, starsMaterial)
  }, [])
  
  return <primitive object={stars} />
}

function PhysicsPauser({ isPaused }) {
  const { world } = useRapier()
  
  useEffect(() => {
    if (!world) return
    
    if (isPaused) {
      world.timestep = 0
    } else {
      world.timestep = 1/60
    }
  }, [world, isPaused])
  
  return null
}

function FloatingCharacter({ children }) {
  const groupRef = useRef()
  const timeRef = useRef(0)
  
  useFrame((state, delta) => {
    if (groupRef.current) {
      timeRef.current += delta
      // Animação suave de flutuação usando seno
      const floatAmount = Math.sin(timeRef.current * 2) * 0.1
      groupRef.current.position.y = floatAmount
    }
  })
  
  return (
    <group ref={groupRef}>
      {children}
    </group>
  )
}

function PauseMenu({ isPaused, onResume }) {
  if (!isPaused) return null
  
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      backgroundColor: '#000000',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
      fontFamily: '"Courier New", Courier, monospace',
    }}>
      <h1 style={{
        color: '#d3d3d3',
        fontSize: '2.5rem',
        fontWeight: 'normal',
        margin: '0 0 2rem 0',
        letterSpacing: '0.2rem',
        textTransform: 'uppercase',
      }}>
        Paused
      </h1>
      
      <div style={{
        color: '#d3d3d3',
        fontSize: '1.2rem',
        letterSpacing: '0.1rem',
      }}>
        ESC to Resume
      </div>
    </div>
  )
}

export default function App() {
  const [isPaused, setIsPaused] = useState(false)
  const keyboardMap = [
    { name: 'forward', keys: ['ArrowUp', 'KeyW'] },
    { name: 'backward', keys: ['ArrowDown', 'KeyS'] },
    { name: 'leftward', keys: ['ArrowLeft', 'KeyA'] },
    { name: 'rightward', keys: ['ArrowRight', 'KeyD'] },
    { name: 'jump', keys: ['Space'] },
    { name: 'run', keys: ['Shift'] },
  ]
  
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsPaused(prev => !prev)
        // Libera o pointer lock quando pausar
        if (document.pointerLockElement) {
          document.exitPointerLock()
        }
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
  
  return (
    <>
      <Canvas 
        shadows 
        onPointerDown={(e) => {
          if (!isPaused) {
            e.target.requestPointerLock()
          }
        }}
        gl={{ clearColor: '#0a0a1a' }}
      >
      <Fisheye zoom={0.4}>
        <SceneSetup />
        <NightSky />
        <directionalLight intensity={0.7} castShadow shadow-bias={-0.0004} position={[-20, 20, 20]}>
          <orthographicCamera attach="shadow-camera" args={[-20, 20, 20, -20]} />
        </directionalLight>
        <ambientLight intensity={0.2} />
        <Physics timeStep={1/60}>
          <PhysicsPauser isPaused={isPaused} />
          <KeyboardControls map={keyboardMap} enabled={!isPaused}>
            <Controller maxVelLimit={5}>
              <FloatingCharacter>
                <Gltf castShadow receiveShadow scale={1.0} position={[0, 0, 0]} src="/VirtualHead.glb" />
              </FloatingCharacter>
            </Controller>
          </KeyboardControls>
          {/* Plano simples como chão - ESPESSURA AUMENTADA */}
          <RigidBody type="fixed" position={[0, 0, 0]} colliders="cuboid">
            <mesh receiveShadow position={[0, 0, 0]}>
              <boxGeometry args={[100, 1.0, 100]} />
              <meshStandardMaterial color="#4a5568" />
            </mesh>
          </RigidBody>
        </Physics>
      </Fisheye>
    </Canvas>
    <PauseMenu isPaused={isPaused} onResume={() => setIsPaused(false)} />
    </>
  )
}

