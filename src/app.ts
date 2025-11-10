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

app.use(cors({
	origin: 'http://localhost:5173',
	credentials: true,
	methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
	allowedHeaders: ['Content-Type', 'Authorization'],
}))
app.use(cookieParser())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Revisar si tiene que ir antes de los app.use y app.get
//setRoutes(app)

// Swagger docs
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))
app.get('/docs.json', (_req, res) => res.json(swaggerSpec))
// Routes
setRoutes(app)

// 404 and error handling
app.use(notFound)
app.use(errorHandler)

const server = app.listen(PORT, () => {
	console.log(`🚀 Server running on http://localhost:${PORT}!`)
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
