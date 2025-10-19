import { Express } from 'express';
import userRoutes from './userRoutes';
import { health } from '../controllers/healthController'
import institutionRoutes from './institutionRoutes';

export function setRoutes(app: Express) {
  app.use('/users', userRoutes);
  app.get('/health', health);
  app.use('/institutions', institutionRoutes);
}