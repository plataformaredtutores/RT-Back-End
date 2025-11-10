# Test Directory

**📖 For complete testing setup and instructions, see [`TESTING.md`](../../TESTING.md) in the project root.**

## Quick Reference

### Test Structure
```
src/__tests__/
├── setup/
│   ├── jest.setup.ts      # Global Jest configuration
│   ├── db.setup.ts        # Database utilities
│   └── test-helpers.ts    # Helper functions
├── unit/                  # Unit tests
└── integration/           # Integration tests
    └── auth/              # Auth tests
```

### Available Helpers
- `createTestUser()` - Create user with hashed password
- `generateTestToken()` - Generate JWT token
- `createRefreshToken()` - Create refresh token
- `getAuthHeaders()` - Auth request headers
- `cleanupTestData()` - Clean up test data

### Running Tests
```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # With coverage
npm run test:auth     # Auth tests only
```

