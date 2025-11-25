import { useState, useCallback, useRef } from 'react'

export function usePlayers() {
  const [players, setPlayers] = useState({})
  // Ref para armazenar posições atualizadas (evita re-renders)
  const positionsRef = useRef({})

  // Adicionar ou atualizar um player
  const addPlayer = useCallback((playerData) => {
    setPlayers(prev => {
      const newPlayers = {
        ...prev,
        [playerData.id]: {
          ...playerData,
          position: playerData.position || { x: 0, y: 0, z: 0 },
          rotation: playerData.rotation || { x: 0, y: 0, z: 0 }
        }
      }
      // Armazenar posição no ref também
      positionsRef.current[playerData.id] = {
        position: playerData.position || { x: 0, y: 0, z: 0 },
        rotation: playerData.rotation || { x: 0, y: 0, z: 0 }
      }
      return newPlayers
    })
  }, [])

  // Atualizar posição/rotação de um player (otimizado)
  const updatePlayer = useCallback((id, position, rotation) => {
    // Atualizar no ref primeiro (rápido, sem re-render)
    if (positionsRef.current[id]) {
      positionsRef.current[id].position = position
      positionsRef.current[id].rotation = rotation
    }
    
    // Atualizar state apenas se player existe (mantém sincronizado)
    setPlayers(prev => {
      if (!prev[id]) return prev
      // Retornar mesmo objeto se apenas posição mudou (evita re-render do componente)
      return {
        ...prev,
        [id]: {
          ...prev[id],
          position,
          rotation
        }
      }
    })
  }, [])

  // Remover um player
  const removePlayer = useCallback((id) => {
    setPlayers(prev => {
      const newPlayers = { ...prev }
      delete newPlayers[id]
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

