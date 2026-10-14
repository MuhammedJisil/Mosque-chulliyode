const { execSync } = require('child_process');

const isProd = Boolean(
  process.env.RENDER ||
  process.env.NODE_ENV === 'production' ||
  (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('postgres'))
);

if (isProd) {
  console.log('🚀 Production environment detected. Generating Prisma client for PostgreSQL...');
  try {
    execSync('npx prisma generate --schema=prisma/schema.postgresql.prisma', { stdio: 'inherit' });
  } catch (err) {
    console.error('Failed to generate PostgreSQL Prisma client:', err);
    process.exit(1);
  }

  if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('postgres')) {
    console.log('🚀 Syncing schema with production PostgreSQL database...');
    try {
      execSync('npx prisma db push --schema=prisma/schema.postgresql.prisma', { stdio: 'inherit' });
      console.log('✅ PostgreSQL database synced successfully.');
    } catch (err) {
      console.warn('⚠️ Warning during prisma db push:', err.message);
    }
  }
} else {
  console.log('💻 Local development environment detected. Generating Prisma client for SQLite...');
  try {
    execSync('npx prisma generate --schema=prisma/schema.prisma', { stdio: 'inherit' });
  } catch (err) {
    console.error('Failed to generate SQLite Prisma client:', err);
    process.exit(1);
  }
}
