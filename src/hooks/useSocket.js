import { useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'

export function useSocket(serverUrl) {
  const [socket, setSocket] = useState(null)
  const [isConnected, setIsConnected] = useState(false)
  const socketRef = useRef(null)

  useEffect(() => {
    // URL do servidor
    // Prioridade: serverUrl > REACT_APP_SOCKET_URL > localhost (dev)
    const url = serverUrl || process.env.REACT_APP_SOCKET_URL || 
      (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3001')
    
    if (!url) {
      console.error('❌ REACT_APP_SOCKET_URL não configurada!')
      return
    }
    
    console.log('Conectando ao servidor Socket.IO:', url)
    
    // Criar conexão Socket.IO
    const socketInstance = io(url, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    })

    socketRef.current = socketInstance
    setSocket(socketInstance)

    // Eventos de conexão
    socketInstance.on('connect', () => {
      console.log('✅ Conectado ao servidor Socket.IO')
      setIsConnected(true)
    })

    socketInstance.on('disconnect', () => {
      console.log('❌ Desconectado do servidor Socket.IO')
      setIsConnected(false)
    })

    socketInstance.on('connect_error', (error) => {
      console.error('Erro ao conectar:', error)
      setIsConnected(false)
    })

    // Cleanup ao desmontar
    return () => {
      if (socketInstance) {
        socketInstance.disconnect()
      }
    }
  }, [serverUrl])

  return { socket, isConnected }
}

