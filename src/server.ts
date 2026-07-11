import 'dotenv/config'

import { createGameServer } from '@/app.js'

const { httpServer, allowedOrigins } = createGameServer()

const PORT = Number(process.env.API_PORT ?? 3000)
const HOST = process.env.API_LOCALHOST

if (process.env.NODE_ENV === 'development' && HOST) {
  httpServer.listen(PORT, HOST, () => {
    console.log(`🚀 [ storylic-api ] rodando localmente em http://${HOST}:${PORT}`)
    console.log(`📱 Acesse pelo celular em http://192.168.15.12:${PORT}`)
    console.log(`🔗 CORS permitido: ${allowedOrigins.join(', ')}`)
  })
} else {
  httpServer.listen(PORT, () => {
    console.log(`🚀 [ Servidor Storylic ] rodando na porta ${PORT}`)
  })
}
