import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import * as dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

let testPrisma: PrismaClient;

/**
 * Get or create a test Prisma client instance
 * Uses TEST_DATABASE_URL if available, otherwise falls back to DATABASE_URL
 */
export function getTestPrisma(): PrismaClient {
  if (!testPrisma) {
    const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
    
    if (!databaseUrl) {
      throw new Error(
        'TEST_DATABASE_URL or DATABASE_URL must be set for tests. ' +
        'Create a .env.test file with TEST_DATABASE_URL pointing to your test database.'
      );
    }

    testPrisma = new PrismaClient({
      datasources: {
        db: {
          url: databaseUrl,
        },
      },
      log: process.env.DEBUG_TESTS === 'true' ? ['query', 'error', 'warn'] : ['error'],
    });
  }
  return testPrisma;
}

/**
 * Reset the test database by running migrations
 * WARNING: This will delete all data in the test database
 */
export async function resetTestDatabase(): Promise<void> {
  const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    throw new Error('TEST_DATABASE_URL or DATABASE_URL must be set');
  }

  // Reset database using Prisma migrate reset (only in test environment)
  if (process.env.NODE_ENV === 'test') {
    try {
      execSync('npx prisma migrate reset --force --skip-seed', {
        env: { ...process.env, DATABASE_URL: databaseUrl },
        stdio: 'inherit',
      });
    } catch (error) {
      console.error('Failed to reset test database:', error);
      throw error;
    }
  }
}

/**
 * Clean up test database connections
 */
export async function cleanupTestDatabase(): Promise<void> {
  if (testPrisma) {
    await testPrisma.$disconnect();
    testPrisma = null as any;
  }
}

/**
 * Truncate all tables (faster than reset for between tests)
 * Use with caution - only in test environment
 * PostgreSQL version - uses TRUNCATE CASCADE
 */
export async function truncateAllTables(): Promise<void> {
  const prisma = getTestPrisma();
  
  // Get all table names from Prisma schema (PostgreSQL uses lowercase with quotes)
  const tables = [
    'RefreshToken',
    'UserBankAccount',
    'User',
    'Student',
    'ParentTutor',
    'Institution',
    'ClassPayment',
    'Class',
    'Fee',
    'CoordinatorPayment',
    'AdminPayment',
  ];

  // Truncate all tables with CASCADE to handle foreign keys
  // PostgreSQL automatically handles foreign key constraints with CASCADE
  const tableList = tables.map(t => `"${t}"`).join(', ');
  try {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE;`);
  } catch (error) {
    console.warn('Could not truncate tables:', error);
    throw error;
  }
}

