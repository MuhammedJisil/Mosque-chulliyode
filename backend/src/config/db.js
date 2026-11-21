const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

prisma.$connect()
  .then(() => {
    console.log('✅ Database connected successfully.');
    startHeartbeat();
  })
  .catch((err) => console.error('❌ Database connection error on startup:', err.message));

// Keep-alive heartbeat: Prevents Neon PostgreSQL compute from auto-suspending
// after 5 minutes of inactivity and prevents 57P01 administrator connection terminations
function startHeartbeat() {
  const isPostgres = Boolean(
    process.env.RENDER ||
    process.env.NODE_ENV === 'production' ||
    (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('postgres'))
  );

  if (isPostgres) {
    const HEARTBEAT_INTERVAL_MS = 3.5 * 60 * 1000; // 3.5 minutes (Neon idle timeout is 5 minutes)
    const heartbeatTimer = setInterval(async () => {
      try {
        await prisma.$queryRaw`SELECT 1;`;
      } catch (err) {
        // Prisma will automatically re-establish connection on next query
      }
    }, HEARTBEAT_INTERVAL_MS);

    if (heartbeatTimer.unref) {
      heartbeatTimer.unref();
    }
  }
}

module.exports = prisma;
