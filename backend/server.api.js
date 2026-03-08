import express from "express"
import cors from "cors"

import queueRoutes from "./src/routes/queue.js"
import barberRoutes from "./src/routes/barbers.js"
import barbershopRoutes from "./src/routes/barbershops.js"
import authRoutes from "./src/routes/auth.js"

const app = express()

app.use(express.json())
app.use(cors())

app.use("/api/queue", queueRoutes)
app.use("/api/barbers", barberRoutes)
app.use("/api/barbershops", barbershopRoutes)
app.use("/api/auth", authRoutes)

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date() })
})

const PORT = process.env.PORT || 8080

app.listen(PORT, () => {
  console.log("╔════════════════════════════════════════╗")
  console.log("║  Fila Livre API Server Started        ║")
  console.log(`║  Port: ${PORT}`)
  console.log("╚════════════════════════════════════════╝")
})
