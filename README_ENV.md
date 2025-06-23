# Configuração de Variáveis de Ambiente

## Para Desenvolvimento Local

Crie um arquivo `.env` na raiz do projeto com:

```env
REACT_APP_SOCKET_URL=http://localhost:4000/
REACT_APP_API_URL=http://localhost:4000
```

### Variáveis necessárias:
- `REACT_APP_SOCKET_URL` = URL do seu backend em produção (ex: `https://seu-backend.onrender.com/`)
- `REACT_APP_API_URL` = URL do seu backend em produção (ex: `https://seu-backend.onrender.com`)

### Exemplo:
```
REACT_APP_SOCKET_URL=https://seu-backend.onrender.com/
REACT_APP_API_URL=https://seu-backend.onrender.com/
```

## Importante:
- URLs do Socket.io devem terminar com `/`
- URLs da API REST não devem terminar com `/`
