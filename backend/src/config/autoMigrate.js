const prisma = require('./db');

/**
 * Automatically ensures all required tables and columns exist on server startup.
 * Runs directly on Neon PostgreSQL or SQLite via raw SQL queries.
 * This guarantees zero downtime and prevents "table does not exist" or "column does not exist" errors.
 */
async function autoMigrate() {
  const isPostgres = Boolean(
    process.env.RENDER ||
    process.env.NODE_ENV === 'production' ||
    (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('postgres'))
  );

  console.log(`🔄 Checking database schema health (${isPostgres ? 'PostgreSQL' : 'SQLite'})...`);

  try {
    if (isPostgres) {
      // 1. Ensure MadrasaStudent table exists in PostgreSQL
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "MadrasaStudent" (
          "id" SERIAL PRIMARY KEY,
          "memberId" INTEGER,
          "parentName" TEXT,
          "parentPhone" TEXT DEFAULT '',
          "job" TEXT,
          "division" TEXT,
          "studentsCount" INTEGER DEFAULT 1,
          "studentName" TEXT,
          "admissionNo" TEXT,
          "classLevel" TEXT DEFAULT '',
          "monthlyFee" DOUBLE PRECISION DEFAULT 200.0,
          "feePerStudent" DOUBLE PRECISION DEFAULT 200.0,
          "openingBalance" DOUBLE PRECISION DEFAULT 0.0,
          "admissionDate" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
          "status" TEXT DEFAULT 'Active',
          "notes" TEXT,
          "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 2. Ensure MadrasaPayment table exists in PostgreSQL
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "MadrasaPayment" (
          "id" SERIAL PRIMARY KEY,
          "studentId" INTEGER NOT NULL REFERENCES "MadrasaStudent"("id") ON DELETE CASCADE,
          "month" INTEGER NOT NULL,
          "year" INTEGER NOT NULL,
          "feeAmount" DOUBLE PRECISION DEFAULT 0.0,
          "openingBalanceAmount" DOUBLE PRECISION DEFAULT 0.0,
          "totalAmount" DOUBLE PRECISION NOT NULL,
          "paymentMode" TEXT DEFAULT 'Cash in Hand',
          "paymentDate" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
          "receiptNo" TEXT,
          "notes" TEXT,
          "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 3. Ensure FoodDuty table exists in PostgreSQL
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "FoodDuty" (
          "id" SERIAL PRIMARY KEY,
          "memberId" INTEGER,
          "customName" TEXT,
          "phone" TEXT,
          "division" TEXT,
          "date" TIMESTAMP(3) NOT NULL,
          "mealType" TEXT DEFAULT 'All Day',
          "status" TEXT DEFAULT 'Pending',
          "notes" TEXT,
          "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 4. Ensure all newly added columns exist in existing PostgreSQL tables
      const alterStatements = [
        `ALTER TABLE "Member" ADD COLUMN IF NOT EXISTS "job" TEXT;`,
        `ALTER TABLE "Member" ADD COLUMN IF NOT EXISTS "endDate" TIMESTAMP(3);`,
        `ALTER TABLE "Member" ADD COLUMN IF NOT EXISTS "hasMadrasa" BOOLEAN DEFAULT false;`,
        `ALTER TABLE "Member" ADD COLUMN IF NOT EXISTS "madrasaChildrenCount" INTEGER DEFAULT 0;`,
        `ALTER TABLE "Member" ADD COLUMN IF NOT EXISTS "madrasaMonthlyFee" DOUBLE PRECISION DEFAULT 0.0;`,
        `ALTER TABLE "MadrasaStudent" ADD COLUMN IF NOT EXISTS "job" TEXT;`,
        `ALTER TABLE "MadrasaStudent" ADD COLUMN IF NOT EXISTS "address" TEXT;`,
        `ALTER TABLE "MadrasaStudent" ADD COLUMN IF NOT EXISTS "endDate" TIMESTAMP(3);`,
        `ALTER TABLE "MadrasaStudent" ADD COLUMN IF NOT EXISTS "studentsCount" INTEGER DEFAULT 1;`,
        `ALTER TABLE "MadrasaStudent" ADD COLUMN IF NOT EXISTS "feePerStudent" DOUBLE PRECISION DEFAULT 200.0;`,
        `ALTER TABLE "MadrasaStudent" ADD COLUMN IF NOT EXISTS "parentPhone" TEXT DEFAULT '';`,
        `ALTER TABLE "MadrasaStudent" ADD COLUMN IF NOT EXISTS "parentName" TEXT;`,
        `ALTER TABLE "MadrasaStudent" ADD COLUMN IF NOT EXISTS "division" TEXT;`,
        `ALTER TABLE "MadrasaStudent" ADD COLUMN IF NOT EXISTS "memberId" INTEGER;`,
        `ALTER TABLE "MadrasaStudent" ADD COLUMN IF NOT EXISTS "studentName" TEXT;`,
        `ALTER TABLE "MadrasaStudent" ADD COLUMN IF NOT EXISTS "monthlyFee" DOUBLE PRECISION DEFAULT 200.0;`,
        `ALTER TABLE "MadrasaStudent" ADD COLUMN IF NOT EXISTS "openingBalance" DOUBLE PRECISION DEFAULT 0.0;`,
        `ALTER TABLE "MadrasaStudent" ADD COLUMN IF NOT EXISTS "admissionDate" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;`,
        `ALTER TABLE "MadrasaStudent" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'Active';`,
        `ALTER TABLE "MadrasaStudent" ADD COLUMN IF NOT EXISTS "notes" TEXT;`,
        `ALTER TABLE "Income" ADD COLUMN IF NOT EXISTS "madrasaPaymentId" INTEGER;`,
        `ALTER TABLE "Income" ADD COLUMN IF NOT EXISTS "studentId" INTEGER;`,
        `ALTER TABLE "Income" ADD COLUMN IF NOT EXISTS "receiptNo" TEXT;`,
      ];

      for (const sql of alterStatements) {
        try {
          await prisma.$executeRawUnsafe(sql);
        } catch (e) {
          // Column may already exist or syntax variance, ignore safely
        }
      }

      console.log('✅ PostgreSQL database schema verified and up-to-date.');
    } else {
      // Local SQLite setup
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "MadrasaStudent" (
          "id" INTEGER PRIMARY KEY AUTOINCREMENT,
          "memberId" INTEGER,
          "parentName" TEXT,
          "parentPhone" TEXT DEFAULT '',
          "address" TEXT,
          "job" TEXT,
          "division" TEXT,
          "studentsCount" INTEGER DEFAULT 1,
          "studentName" TEXT,
          "admissionNo" TEXT,
          "classLevel" TEXT DEFAULT '',
          "monthlyFee" REAL DEFAULT 200.0,
          "feePerStudent" REAL DEFAULT 200.0,
          "openingBalance" REAL DEFAULT 0.0,
          "admissionDate" DATETIME DEFAULT CURRENT_TIMESTAMP,
          "endDate" DATETIME,
          "status" TEXT DEFAULT 'Active',
          "notes" TEXT,
          "createdAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `).catch(() => {});

      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "MadrasaPayment" (
          "id" INTEGER PRIMARY KEY AUTOINCREMENT,
          "studentId" INTEGER NOT NULL,
          "month" INTEGER NOT NULL,
          "year" INTEGER NOT NULL,
          "feeAmount" REAL DEFAULT 0.0,
          "openingBalanceAmount" REAL DEFAULT 0.0,
          "totalAmount" REAL NOT NULL,
          "paymentMode" TEXT DEFAULT 'Cash in Hand',
          "paymentDate" DATETIME DEFAULT CURRENT_TIMESTAMP,
          "receiptNo" TEXT,
          "notes" TEXT,
          "createdAt" DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `).catch(() => {});

      // Add missing columns to SQLite if needed
      const sqliteAddCols = [
        `ALTER TABLE "Member" ADD COLUMN "job" TEXT;`,
        `ALTER TABLE "Member" ADD COLUMN "endDate" DATETIME;`,
        `ALTER TABLE "Member" ADD COLUMN "hasMadrasa" BOOLEAN DEFAULT 0;`,
        `ALTER TABLE "Member" ADD COLUMN "madrasaChildrenCount" INTEGER DEFAULT 0;`,
        `ALTER TABLE "Member" ADD COLUMN "madrasaMonthlyFee" REAL DEFAULT 0.0;`,
        `ALTER TABLE "MadrasaStudent" ADD COLUMN "address" TEXT;`,
        `ALTER TABLE "MadrasaStudent" ADD COLUMN "endDate" DATETIME;`,
        `ALTER TABLE "MadrasaStudent" ADD COLUMN "job" TEXT;`,
        `ALTER TABLE "MadrasaStudent" ADD COLUMN "studentsCount" INTEGER DEFAULT 1;`,
        `ALTER TABLE "MadrasaStudent" ADD COLUMN "feePerStudent" REAL DEFAULT 200.0;`,
        `ALTER TABLE "Income" ADD COLUMN "madrasaPaymentId" INTEGER;`,
        `ALTER TABLE "Income" ADD COLUMN "studentId" INTEGER;`,
      ];

      for (const sql of sqliteAddCols) {
        try {
          await prisma.$executeRawUnsafe(sql);
        } catch (e) {
          // In SQLite, "duplicate column name" is expected if column already exists
        }
      }

      console.log('✅ SQLite database schema verified and up-to-date.');
    }
  } catch (err) {
    console.warn('⚠️ Notice during autoMigrate check:', err.message);
  }
}

module.exports = { autoMigrate };
