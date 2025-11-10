/**
 * Example test file to verify test setup is working
 * This can be removed once real tests are implemented
 */

import { createTestUser, cleanupTestData } from '../../setup/test-helpers';
import { getTestPrisma } from '../../setup/db.setup';

describe('Test Setup Verification', () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it('should connect to test database', async () => {
    const prisma = getTestPrisma();
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    expect(result).toBeDefined();
  });

  it('should create a test user', async () => {
    const user = await createTestUser({
      email: 'test@example.com',
      password: 'TestPassword123!',
      role: 'tutor',
      name: 'Test User',
    });

    expect(user).toBeDefined();
    expect(user.email).toBe('test@example.com');
    expect(user.role).toBe('tutor');
    expect(user.hashedPassword).toBeDefined();
    expect(user.hashedPassword).not.toBe('TestPassword123!'); // Should be hashed
  });

  it('should clean up test data', async () => {
    await createTestUser({
      email: 'cleanup@example.com',
      role: 'admin',
    });

    await cleanupTestData();

    const prisma = getTestPrisma();
    const users = await prisma.user.findMany();
    expect(users.length).toBe(0);
  });
});

