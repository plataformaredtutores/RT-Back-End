import { Express } from 'express'
import userRoutes from './userRoutes'
import institutionRoutes from './institutionRoutes'
import mailRoutes from './mailRoutes'
import authRoutes from './authRoutes'
import { health } from '../controllers/healthController'
import { requireAuth } from '../middlewares/auth'
import { authorize } from '../middlewares/authorize'

export function setRoutes(app: Express) {
  app.get('/health', health)
  app.use('/mail', mailRoutes)
  app.use('/auth', authRoutes)
  app.use(requireAuth)
  app.use('/users', userRoutes)
  app.use('/institutions', authorize(['admin', "coordinator"]), institutionRoutes)
}
