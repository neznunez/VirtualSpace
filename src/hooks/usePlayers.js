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
    if (!id || typeof id !== 'string') {
      console.warn('⚠️ [usePlayers] ID inválido ao adicionar:', id)
      return
    }

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

    // DEBUG: Verificar se foi criado corretamente
    const created = dynamicRef.current.get(id)
    console.log(`✅ [usePlayers] Player ${id} (${nickname}) adicionado no Map:`, {
      position: { x: created.position.x, y: created.position.y, z: created.position.z },
      rotY: created.rotY,
      characterType,
      totalPlayers: dynamicRef.current.size
    })

    // FASE 2: Adicionar no state (dados estáticos) - apenas uma vez
    setPlayersList(prev => {
      // Verificar se já existe
      if (prev.some(p => p.id === id)) {
        console.warn(`⚠️ [usePlayers] Player ${id} já existe, atualizando dados estáticos`)
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

    console.log(`✅ [usePlayers] Player ${id} adicionado. Total: ${dynamicRef.current.size}`)
  }, [])

  // FASE 2: Atualizar posição/rotação - NÃO usa setState, apenas atualiza Map
  const updatePlayer = useCallback((id, position, rotation) => {
    // Validação
    if (!id || typeof id !== 'string') {
      console.warn('⚠️ [usePlayers] ID inválido ao atualizar:', id)
      return
    }

    console.log(`🔄 [usePlayers] updatePlayer chamado para ${id}:`, {
      position,
      rotation,
      playersNoMap: Array.from(dynamicRef.current.keys())
    })

    const dyn = dynamicRef.current.get(id)
    if (!dyn) {
      console.warn(`⚠️ [usePlayers] Tentando atualizar player inexistente: ${id}`)
      console.warn(`📋 [usePlayers] Players disponíveis no Map:`, Array.from(dynamicRef.current.keys()))
      return
    }

    // Validar e ajustar position
    const adjustedY = position?.y === 0 ? 1.0 : (position?.y || dyn.position.y)
    
    const oldPos = { x: dyn.position.x, y: dyn.position.y, z: dyn.position.z }
    
    // FASE 2: Atualizar diretamente no Map (sem setState)
    dyn.position.set(
      typeof position?.x === 'number' ? position.x : dyn.position.x,
      adjustedY,
      typeof position?.z === 'number' ? position.z : dyn.position.z
    )
    dyn.rotY = typeof rotation?.y === 'number' ? rotation.y : dyn.rotY
    dyn.lastUpdate = Date.now()
    
    const newPos = { x: dyn.position.x, y: dyn.position.y, z: dyn.position.z }
    console.log(`✅ [usePlayers] Player ${id} atualizado:`, {
      oldPos,
      newPos,
      rotY: dyn.rotY
    })
    
    // NÃO chamar setState - isso elimina re-renders desnecessários!
  }, [])

  // FASE 2: Remover player - remove do Map e do state
  const removePlayer = useCallback((id) => {
    if (!id || typeof id !== 'string') {
      console.warn('⚠️ [usePlayers] ID inválido ao remover:', id)
      return
    }

    const removed = dynamicRef.current.delete(id)
    if (!removed) {
      console.warn(`⚠️ [usePlayers] Tentando remover player inexistente: ${id}`)
      return
    }

    // Remover do state também
    setPlayersList(prev => {
      const filtered = prev.filter(p => p.id !== id)
      console.log(`✅ [usePlayers] Player ${id} removido. Restantes: ${filtered.length}`)
      return filtered
    })
  }, [])

  // FASE 2: Limpar todos os players
  const clearPlayers = useCallback(() => {
    dynamicRef.current.clear()
    setPlayersList([])
    console.log('✅ [usePlayers] Todos os players removidos')
  }, [])

  // FASE 2: Função para pegar dados dinâmicos (usado pelo RemotePlayer)
  const getDynamic = useCallback((id) => {
    const dyn = dynamicRef.current.get(id)
    if (!dyn) {
      // DEBUG: Log apenas ocasionalmente para evitar spam
      if (!dynamicRef.current._lastLog || Date.now() - dynamicRef.current._lastLog > 2000) {
        console.warn(`⚠️ [usePlayers] getDynamic: Player ${id} não encontrado no Map`)
        console.warn(`📋 [usePlayers] Players disponíveis:`, Array.from(dynamicRef.current.keys()))
        dynamicRef.current._lastLog = Date.now()
      }
      return null
    }
    
    // Retornar clone para evitar mutação direta
    return {
      position: dyn.position.clone(),
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

