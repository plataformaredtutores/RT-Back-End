import { PrismaClient } from '@prisma/client'

process.env.NODE_ENV = 'test'

// Extend Jest timeout for database operations
jest.setTimeout(10000)

afterAll(async () => {
  const prisma = new PrismaClient()
  await prisma.$disconnect()
})
