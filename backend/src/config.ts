import 'dotenv/config';

const nodeEnv = process.env.NODE_ENV ?? 'development';

function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length >= 16) return secret;
  if (nodeEnv === 'production') {
    throw new Error('JWT_SECRET must be set (min. 16 characters) in production');
  }
  console.warn('[config] JWT_SECRET missing or too short - using an insecure development secret');
  return 'dev-only-insecure-jwt-secret-change-me';
}

export const config = {
  nodeEnv,
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://itam:itam_password@localhost:5432/itam',
  jwtSecret: jwtSecret(),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '8h',
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  seedDemoData: (process.env.SEED_DEMO_DATA ?? 'false').toLowerCase() === 'true',
  admin: {
    username: process.env.ADMIN_USERNAME ?? 'admin',
    password: process.env.ADMIN_PASSWORD ?? 'Admin@123',
    fullName: process.env.ADMIN_FULL_NAME ?? 'System Administrator',
    email: process.env.ADMIN_EMAIL ?? 'admin@company.local',
  },
};
