import { Express } from 'express'
import userRoutes from './userRoutes'
import studentRoutes from './studentRoutes'
import institutionRoutes from './institutionRoutes'
import mailRoutes from './mailRoutes'
import authRoutes from './authRoutes'
import classRoutes from './classRoutes'
import feeRoutes from './feeRoutes'
import cashFlowRoutes from './cashFlowRoutes'
import tutorRoutes from './tutorRoutes'
import coordinatorRoutes from './coordinatorRoutes'
import adminRoutes from './adminRoutes'
import { health } from '../controllers/healthController'
import { requireAuth } from '../middlewares/auth'
import { authorize } from '../middlewares/authorize'

export function setRoutes(app: Express) {
  app.get('/health', health)
  app.use('/mail', mailRoutes)
  app.use('/auth', authRoutes)
  app.use(requireAuth)
  app.use('/users', userRoutes)
  app.use('/students', authorize(['admin', 'coordinator', 'tutor']), studentRoutes)
  app.use('/institutions', authorize(['admin', 'coordinator']), institutionRoutes)
  app.use('/coordinators', authorize(['admin']), coordinatorRoutes)
  app.use('/classes', classRoutes)
  app.use('/fees', authorize(['admin', 'coordinator', 'tutor', 'guardian']), feeRoutes)
  app.use('/tutors', authorize(['admin', 'coordinator']), tutorRoutes)
  app.use('/cashflow', cashFlowRoutes)
  app.use('/admin', authorize(['admin']), adminRoutes)
}
