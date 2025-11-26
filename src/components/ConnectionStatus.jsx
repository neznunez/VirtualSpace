import './ConnectionStatus.css'

/**
 * Indicador de status do Socket.IO no canto superior esquerdo
 * Indica se o Socket.IO está conectado e pronto para receber usuários
 */
export default function ConnectionStatus({ isConnected }) {
  return (
    <div className="connection-status">
      <div className={`connection-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
        <div className="connection-dot"></div>
      </div>
    </div>
  )
}

