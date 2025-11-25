import { useState, useCallback } from 'react'

export function usePlayers() {
  const [players, setPlayers] = useState({})

  // Adicionar ou atualizar um player
  const addPlayer = useCallback((playerData) => {
    setPlayers(prev => ({
      ...prev,
      [playerData.id]: playerData
    }))
  }, [])

  // Atualizar posição/rotação de um player
  const updatePlayer = useCallback((id, position, rotation) => {
    setPlayers(prev => {
      if (!prev[id]) return prev
      
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
    addPlayer,
    updatePlayer,
    removePlayer,
    clearPlayers
  }
}

