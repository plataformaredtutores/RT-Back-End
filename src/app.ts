import './config/env'
import express from 'express'
import { setRoutes } from './routes'
import cors from 'cors'
import notFound from './middlewares/notFound'
import errorHandler from './middlewares/errorHandler'
import swaggerUi from 'swagger-ui-express'
import { swaggerSpec } from './config/swagger'
import cookieParser from 'cookie-parser'

const app = express()
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000

const corsOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

if (process.env.TRUST_PROXY === '1' || process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1)
}

app.use(
  cors({
    origin: corsOrigins.length
      ? (origin, callback) => {
          // Allow non-browser / same-origin requests that omit Origin
          if (!origin) return callback(null, true)
          return callback(null, corsOrigins.includes(origin))
        }
      : true, // reflect request origin — allows all origins
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Auth-Token-In-Body'],
  }),
)
app.use(cookieParser())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Swagger docs
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))
app.get('/docs.json', (_req, res) => res.json(swaggerSpec))
// Routes
setRoutes(app)

// 404 and error handling
app.use(notFound)
app.use(errorHandler)

const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}!`)
})

server.on('error', (err) => {
  console.error('Server error:', err)
})

const shutdown = (signal: string) => {
  console.log(`\n${signal} received. Shutting down...`)
  server.close(() => {
    console.log('HTTP server closed')
    process.exit(0)
  })
  setTimeout(() => process.exit(1), 10_000).unref()
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
