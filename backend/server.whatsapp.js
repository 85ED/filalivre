import { createSession } from "./src/services/whatsapp/sessionManager.js"

console.log("╔══════════════════════════════════════╗")
console.log("║  Fila Livre WhatsApp Service        ║")
console.log("╚══════════════════════════════════════╝")

async function boot() {
  console.log("Iniciando WhatsApp service...")

  // sessão inicial de teste
  await createSession("default")

  console.log("WhatsApp service online")
}

boot()