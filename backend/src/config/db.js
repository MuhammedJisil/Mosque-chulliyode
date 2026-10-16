const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

prisma.$connect()
  .then(() => console.log('✅ Database connected successfully.'))
  .catch((err) => console.error('❌ Database connection error on startup:', err.message));

module.exports = prisma;
