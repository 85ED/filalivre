import { startAllSessions } from "./src/services/whatsappService.js"

console.log("╔══════════════════════════════════════╗")
console.log("║  Fila Livre WhatsApp Service        ║")
console.log("╚══════════════════════════════════════╝")

async function boot() {
  await startAllSessions()
}

boot()
