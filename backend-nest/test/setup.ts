import { config } from 'dotenv';

// Load test environment variables
config({ path: '.env.test' });

// Set test-specific defaults
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret';

// Increase timeout for database operations
jest.setTimeout(30000);
