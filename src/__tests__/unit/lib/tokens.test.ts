import { randomToken, hashToken, verifyTokenHash } from '../../../lib/tokens';

describe('Token Utilities', () => {
  describe('randomToken', () => {
    it('should generate a random token', () => {
      const token = randomToken();
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
    });

    it('should generate different tokens on each call', () => {
      const token1 = randomToken();
      const token2 = randomToken();
      expect(token1).not.toBe(token2);
    });

    it('should generate tokens with custom byte length', () => {
      const token = randomToken(32);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
    });

    it('should generate base64url encoded tokens', () => {
      const token = randomToken();
      // base64url doesn't contain +, /, or = characters
      expect(token).not.toContain('+');
      expect(token).not.toContain('/');
      // = might appear for padding, but less likely with base64url
    });
  });

  describe('hashToken', () => {
    it('should hash a token', async () => {
      const token = randomToken();
      const hash = await hashToken(token);
      
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash).not.toBe(token);
      expect(hash.length).toBeGreaterThan(0);
    });

    it('should produce different hashes for the same token (due to salt)', async () => {
      const token = randomToken();
      const hash1 = await hashToken(token);
      const hash2 = await hashToken(token);
      
      // Argon2 uses random salt, so hashes should be different
      expect(hash1).not.toBe(hash2);
    });

    it('should handle empty string', async () => {
      const hash = await hashToken('');
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
    });
  });

  describe('verifyTokenHash', () => {
    it('should verify a correct token against its hash', async () => {
      const token = randomToken();
      const hash = await hashToken(token);
      
      const isValid = await verifyTokenHash(hash, token);
      expect(isValid).toBe(true);
    });

    it('should reject an incorrect token', async () => {
      const token = randomToken();
      const wrongToken = randomToken();
      const hash = await hashToken(token);
      
      const isValid = await verifyTokenHash(hash, wrongToken);
      expect(isValid).toBe(false);
    });

    it('should reject empty token against valid hash', async () => {
      const token = randomToken();
      const hash = await hashToken(token);
      
      const isValid = await verifyTokenHash(hash, '');
      expect(isValid).toBe(false);
    });

    it('should handle verification with different hash instances of same token', async () => {
      const token = randomToken();
      const hash1 = await hashToken(token);
      const hash2 = await hashToken(token);
      
      // Both hashes should verify the same token (Argon2 handles this)
      const isValid1 = await verifyTokenHash(hash1, token);
      const isValid2 = await verifyTokenHash(hash2, token);
      
      expect(isValid1).toBe(true);
      expect(isValid2).toBe(true);
    });
  });
});

