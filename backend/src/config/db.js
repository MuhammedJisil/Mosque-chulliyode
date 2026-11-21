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

// Optional Keep-alive heartbeat: Only enabled if DB_KEEP_ALIVE=true in environment variables.
// NOTE: Neon Free Tier has a limit of ~100 active compute hours/month.
// Leaving this disabled allows Neon to auto-suspend when idle to preserve your free tier quota.
function startHeartbeat() {
  if (process.env.DB_KEEP_ALIVE === 'true') {
    const HEARTBEAT_INTERVAL_MS = 3.5 * 60 * 1000;
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
