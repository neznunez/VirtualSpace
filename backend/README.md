# VRADIO Backend

Backend Socket.IO para a sala multiusuário do VRADIO.

## Instalação

```bash
cd backend
npm install
```

## Configuração

Crie um arquivo `.env` na pasta `backend/` com:

```
PORT=3001
FRONTEND_URL=http://localhost:3000
```

## Executar

```bash
npm start
```

O servidor estará rodando em `http://localhost:3001`

## Eventos Socket.IO

### Cliente → Servidor

- `join`: { nickname, characterType } - Player entra na sala
- `playerMove`: { position, rotation } - Atualiza posição do player

### Servidor → Cliente

- `currentPlayers`: { [socketId]: player } - Lista de todos os players (ao conectar)
- `newPlayer`: player - Novo player entrou
- `playerMoved`: { id, position, rotation } - Player se moveu
- `playerDisconnected`: socketId - Player saiu
- `error`: { message } - Erro na requisição

