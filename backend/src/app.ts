import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config';
import { pool } from './db/pool';
import { authenticate } from './middleware/auth';
import { errorHandler, notFoundHandler } from './middleware/error';
import { ok } from './utils/http';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import departmentRoutes from './routes/departments';
import assetRoutes from './routes/assets';
import custodyRoutes from './routes/custody';
import auditRoutes from './routes/audit';
import dashboardRoutes from './routes/dashboard';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(
    cors({
      origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(',').map((o) => o.trim()),
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  if (config.nodeEnv !== 'test') app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'));

  app.get('/api/health', async (_req, res) => {
    await pool.query('SELECT 1');
    ok(res, { status: 'ok', time: new Date().toISOString() }, 'API is healthy');
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/users', authenticate, userRoutes);
  app.use('/api/departments', authenticate, departmentRoutes);
  app.use('/api/assets', authenticate, assetRoutes);
  app.use('/api/custody', authenticate, custodyRoutes);
  app.use('/api/audit-logs', authenticate, auditRoutes);
  app.use('/api/dashboard', authenticate, dashboardRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
