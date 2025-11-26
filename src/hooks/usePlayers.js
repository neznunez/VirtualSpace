import { useState, useCallback, useRef } from 'react'
import * as THREE from 'three'

/**
 * FASE 2: Hook otimizado para gerenciar players
 * 
 * Separação de responsabilidades:
 * - State (React): Apenas dados estáticos { id, nickname, characterType }
 * - Map (dinâmico): Posições e rotações atualizadas { position: Vector3, rotY: number, lastUpdate: number }
 * 
 * Isso elimina re-renders desnecessários do React quando apenas a posição muda.
 */
export function usePlayers() {
  // FASE 2: State apenas para dados estáticos (que precisam trigger re-render)
  const [playersList, setPlayersList] = useState([]) // Array de { id, nickname, characterType }
  
  // FASE 2: Map para dados dinâmicos (posições atualizadas sem trigger re-render)
  const dynamicRef = useRef(new Map()) // Map<id, { position: Vector3, rotY: number, lastUpdate: number }>

  // FASE 2: Adicionar player - cria entry no Map e adiciona no state
  const addPlayer = useCallback((playerData) => {
    const { id, nickname, characterType, position, rotation } = playerData
    
    // Validação
    if (!id || typeof id !== 'string') return

    // Ajustar Y se for 0 (altura padrão do ecctrl é 1.0)
    const adjustedY = position?.y === 0 ? 1.0 : (position?.y || 1.0)
    const pos = position || { x: 0, y: 1.0, z: 0 }
    const rot = rotation || { x: 0, y: 0, z: 0 }

    // FASE 2: Criar entry no Map (dados dinâmicos)
    const positionVector = new THREE.Vector3(
      typeof pos.x === 'number' ? pos.x : 0,
      adjustedY,
      typeof pos.z === 'number' ? pos.z : 0
    )
    
    dynamicRef.current.set(id, {
      position: positionVector,
      rotY: typeof rot.y === 'number' ? rot.y : 0,
      lastUpdate: Date.now()
    })


    // FASE 2: Adicionar no state (dados estáticos) - apenas uma vez
    setPlayersList(prev => {
      // Verificar se já existe
      if (prev.some(p => p.id === id)) {
        return prev.map(p => 
          p.id === id 
            ? { id, nickname: nickname?.trim().slice(0, 12) || 'Unknown', characterType: characterType || 0 }
            : p
        )
      }
      
      // Adicionar novo player
      return [...prev, {
        id,
        nickname: nickname?.trim().slice(0, 12) || 'Unknown',
        characterType: characterType || 0
      }]
    })
  }, [])

  // FASE 2: Atualizar posição/rotação - NÃO usa setState, apenas atualiza Map
  // CORREÇÃO: Abordagem mais robusta baseada em three-arena
  const updatePlayer = useCallback((id, position, rotation) => {
    if (!id || typeof id !== 'string') return
    if (!position || typeof position.x !== 'number') return // Validação rigorosa

    let dyn = dynamicRef.current.get(id)
    
    // Se player não existe no Map, criar entry defensivamente
    if (!dyn) {
      const adjustedY = position.y === 0 ? 1.0 : position.y
      dyn = {
        position: new THREE.Vector3(
          position.x || 0,
          adjustedY,
          position.z || 0
        ),
        rotY: rotation?.y || 0,
        lastUpdate: Date.now()
      }
      dynamicRef.current.set(id, dyn)
      
      // Adicionar no state também se não existir
      setPlayersList(prev => {
        if (prev.some(p => p.id === id)) return prev
        return [...prev, { 
          id, 
          nickname: `Player-${id.slice(0, 6)}`, 
          characterType: 0 
        }]
      })
      return // Primeira vez, já criou
    }

    // CORREÇÃO CRÍTICA: Sempre usar valores recebidos do servidor diretamente
    // Não usar valores antigos como fallback - servidor é a fonte da verdade
    const newX = position.x
    const newY = position.y === 0 ? 1.0 : position.y
    const newZ = position.z
    const newRotY = rotation?.y ?? dyn.rotY
    
    // SEMPRE criar novo Vector3 (garante atualização)
    dyn.position = new THREE.Vector3(newX, newY, newZ)
    dyn.rotY = newRotY
    dyn.lastUpdate = Date.now()
  }, [])

  // FASE 2: Remover player - remove do Map e do state
  const removePlayer = useCallback((id) => {
    if (!id || typeof id !== 'string') return

    const removed = dynamicRef.current.delete(id)
    if (!removed) return

    // Remover do state também
    setPlayersList(prev => prev.filter(p => p.id !== id))
  }, [])

  // FASE 2: Limpar todos os players
  const clearPlayers = useCallback(() => {
    dynamicRef.current.clear()
    setPlayersList([])
  }, [])

  // FASE 2: Função para pegar dados dinâmicos (usado pelo RemotePlayer)
  // CORREÇÃO: Criar novo Vector3 a partir dos valores, não clonar referência
  // Isso garante que sempre temos os valores mais recentes (baseado em three-arena)
  const getDynamic = useCallback((id) => {
    const dyn = dynamicRef.current.get(id)
    if (!dyn || !dyn.position) return null
    
    // Criar novo Vector3 a partir dos valores atuais (não clonar referência)
    // Isso garante que sempre pegamos os valores mais recentes do Map
    return {
      position: new THREE.Vector3(dyn.position.x, dyn.position.y, dyn.position.z),
      rotY: dyn.rotY,
      lastUpdate: dyn.lastUpdate
    }
  }, [])

  return {
    // FASE 2: Expor lista de players (dados estáticos) para renderização
    playersList,
    // FASE 2: Função para pegar dados dinâmicos
    getDynamic,
    // Funções de gerenciamento
    addPlayer,
    updatePlayer,
    removePlayer,
    clearPlayers
  }
}

