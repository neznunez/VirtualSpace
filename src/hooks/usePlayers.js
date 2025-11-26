import { useState, useCallback, useRef } from 'react'

export function usePlayers() {
  const [players, setPlayers] = useState({})
  // Ref para armazenar posições atualizadas (evita re-renders)
  const positionsRef = useRef({})

  // Adicionar ou atualizar um player
  const addPlayer = useCallback((playerData) => {
    // Ajustar Y se for 0 (altura padrão do ecctrl é 1.0)
    const adjustedPosition = playerData.position || { x: 0, y: 1.0, z: 0 }
    if (adjustedPosition.y === 0) {
      adjustedPosition.y = 1.0
    }
    
    setPlayers(prev => {
      const newPlayers = {
        ...prev,
        [playerData.id]: {
          ...playerData,
          position: adjustedPosition,
          rotation: playerData.rotation || { x: 0, y: 0, z: 0 }
        }
      }
      // Armazenar posição no ref também
      positionsRef.current[playerData.id] = {
        position: adjustedPosition,
        rotation: playerData.rotation || { x: 0, y: 0, z: 0 }
      }
      return newPlayers
    })
  }, [])

  // Atualizar posição/rotação - SEMPRE atualizar state para trigger re-render
  const updatePlayer = useCallback((id, position, rotation) => {
    // Ajustar Y se for 0 (altura padrão do ecctrl é 1.0)
    const adjustedPosition = { ...position }
    if (adjustedPosition.y === 0) {
      adjustedPosition.y = 1.0
    }
    
    // Atualizar no ref
    if (positionsRef.current[id]) {
      positionsRef.current[id].position = adjustedPosition
      positionsRef.current[id].rotation = rotation
    }
    
    // IMPORTANTE: SEMPRE atualizar state (SEM verificação de hasChanged)
    // Isso garante que o React sempre detecte mudanças, mesmo pequenas
    setPlayers(prev => {
      if (!prev[id]) {
        console.warn('⚠️ [usePlayers] Tentando atualizar player inexistente:', id)
        return prev
      }
      
      // SEMPRE criar novos objetos para garantir que React detecte a mudança
      console.log(`🔄 [usePlayers] Atualizando player ${id}:`, adjustedPosition)
      return {
        ...prev,
        [id]: {
          ...prev[id],
          position: { ...adjustedPosition }, // Novo objeto - SEMPRE
          rotation: { ...rotation }  // Novo objeto - SEMPRE
        }
      }
    })
  }, [])

  // Remover um player
  const removePlayer = useCallback((id) => {
    setPlayers(prev => {
      const newPlayers = { ...prev }
      delete newPlayers[id]
      delete positionsRef.current[id]
      return newPlayers
    })
  }, [])

  // Limpar todos os players
  const clearPlayers = useCallback(() => {
    setPlayers({})
  }, [])

  return {
    players,
    positionsRef, // Expor ref para acesso direto
    addPlayer,
    updatePlayer,
    removePlayer,
    clearPlayers
  }
}

