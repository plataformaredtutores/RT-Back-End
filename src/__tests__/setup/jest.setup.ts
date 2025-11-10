import { PrismaClient } from '@prisma/client';

// Set test environment
process.env.NODE_ENV = 'test';

// Extend Jest timeout for database operations
jest.setTimeout(10000);

// Cleanup after all tests
afterAll(async () => {
  // Close any open database connections
  const prisma = new PrismaClient();
  await prisma.$disconnect();
});

