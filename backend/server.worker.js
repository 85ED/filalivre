import { checkQueueAlerts } from "./src/workers/QueueAlertWorker.js"

console.log("╔══════════════════════════════════════╗")
console.log("║  Fila Livre Queue Worker Started    ║")
console.log("╚══════════════════════════════════════╝")

async function startWorker() {
  while (true) {
    try {
      await checkQueueAlerts()
    } catch (err) {
      console.error("Worker error:", err)
    }

    await new Promise(resolve => setTimeout(resolve, 5000))
  }
}

startWorker()
