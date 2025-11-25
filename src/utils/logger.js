// Logger condicional - só loga em desenvolvimento
const isDev = process.env.NODE_ENV === 'development'

export const logger = {
  log: (...args) => {
    if (isDev) console.log(...args)
  },
  error: (...args) => {
    if (isDev) console.error(...args)
  },
  warn: (...args) => {
    if (isDev) console.warn(...args)
  }
}

