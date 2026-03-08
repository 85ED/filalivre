import wppconnect from '@wppconnect-team/wppconnect'
import { addSession, hasSession } from './sessionPool.js'

export async function createSession(barbeariaId) {
  if (hasSession(barbeariaId)) {
    return
  }

  const client = await wppconnect.create({
    session: `barbearia_${barbeariaId}`,
    catchQR: (base64Qr) => {
      console.log(`QR CODE BARBEARIA ${barbeariaId}`)
    },
    statusFind: (status) => {
      console.log(`STATUS ${barbeariaId}`, status)
    },
    headless: true
  })

  addSession(barbeariaId, client)

  console.log(`Sessão criada ${barbeariaId}`)
}
