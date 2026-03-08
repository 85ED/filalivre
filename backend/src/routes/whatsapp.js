import express from 'express'
import { sendMessage } from '../services/whatsapp/messageDispatcher.js'
import { createSession } from '../services/whatsapp/sessionManager.js'

const router = express.Router()

router.post('/session/:barbeariaId', async (req, res) => {
  const { barbeariaId } = req.params

  try {
    await createSession(barbeariaId)
    res.json({ status: 'sessao iniciada' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/send', async (req, res) => {
  const { barbeariaId, telefone, mensagem } = req.body

  try {
    await sendMessage(barbeariaId, telefone, mensagem)
    res.json({ status: 'mensagem enviada' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router

