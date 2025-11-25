import { useEffect, useState } from 'react'
import './JoinNotification.css'

/**
 * Notificação no canto da tela quando alguém entra na sala
 */
export default function JoinNotification({ nickname, onComplete }) {
  const [isVisible, setIsVisible] = useState(true)
  const [isAnimating, setIsAnimating] = useState(true)

  useEffect(() => {
    // Animação de entrada
    const enterTimer = setTimeout(() => {
      setIsAnimating(false)
    }, 300)

    // Desaparecer após 3 segundos
    const exitTimer = setTimeout(() => {
      setIsVisible(false)
      setTimeout(() => {
        if (onComplete) onComplete()
      }, 300) // Aguardar animação de saída
    }, 3000)

    return () => {
      clearTimeout(enterTimer)
      clearTimeout(exitTimer)
    }
  }, [onComplete])

  if (!isVisible) return null

  return (
    <div className={`join-notification ${isAnimating ? 'enter' : 'exit'}`}>
      <div className="join-notification-content">
        <div className="join-notification-icon">✨</div>
        <div className="join-notification-text">
          <span className="join-notification-name">{nickname}</span>
          <span className="join-notification-message">joined room</span>
        </div>
      </div>
    </div>
  )
}

