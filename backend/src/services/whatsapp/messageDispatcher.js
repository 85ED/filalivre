import { getSession } from './sessionPool.js'

export async function sendMessage(barbeariaId, telefone, mensagem) {
  const client = getSession(barbeariaId)

  if (!client) {
    throw new Error('Sessão não encontrada')
  }

  const numero = telefone.includes('@c.us')
    ? telefone
    : `${telefone}@c.us`

  await client.sendText(numero, mensagem)
}
