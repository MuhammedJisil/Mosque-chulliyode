require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const incomeRoutes = require('./routes/income');
const expenseRoutes = require('./routes/expense');
const memberRoutes = require('./routes/members');
const staffRoutes = require('./routes/staff');
const categoryRoutes = require('./routes/categories');
const backupRoutes = require('./routes/backup');
const foodDutyRoutes = require('./routes/foodDuties');
const madrasaRoutes = require('./routes/madrasa');
const divisionRoutes = require('./routes/divisions');

const app = express();

const { autoMigrate } = require('./config/autoMigrate');

// Ensure PostgreSQL/SQLite database schema has all columns and tables automatically
if (process.env.RENDER || (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('postgres'))) {
  try {
    const { execSync } = require('child_process');
    console.log('🚀 Checking and syncing Neon PostgreSQL schema with Prisma...');
    execSync('npx prisma db push --schema=prisma/schema.postgresql.prisma --accept-data-loss --skip-generate', { stdio: 'inherit' });
    console.log('✅ Neon PostgreSQL database schema is verified and up-to-date.');
  } catch (err) {
    console.warn('⚠️ Notice during initial prisma db push check:', err.message);
  }
}

// Self-healing direct SQL migration check
autoMigrate().catch(err => console.warn('autoMigrate startup notice:', err.message));

// Default to 5001. If PORT is set to 5000, redirect to 5001 because macOS Control Center AirPlay Receiver occupies 5000
const rawPort = parseInt(process.env.PORT, 10);
const PORT = (!rawPort || rawPort === 5000) ? 5001 : rawPort;

// Trust reverse proxy (Cloudflare, Render, Railway, Nginx) for correct client IP detection
app.set('trust proxy', 1);

// Security Headers with Helmet
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allows serving uploaded proof images to frontend
  crossOriginEmbedderPolicy: false,
}));

// CORS setup
const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(s => s.trim())
  : '*';

app.use(cors({
  origin: corsOrigins === '*' ? true : corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Global API Rate Limiter (Protects against DDoS and brute-force scraping)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes.'
  }
});
app.use('/api/', apiLimiter);

// Body parsing with safe limits (10MB)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static folder for uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Root route for cron jobs / uptime monitoring (prevents Render instance from sleeping)
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'online',
    message: '🕌 جامعة النور (Jamia An-Noor) Masjid Management API is active and awake!',
    timestamp: new Date().toISOString()
  });
});

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'جامعة النور (Jamia An-Noor) Masjid Management System API'
  });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/income', incomeRoutes);
app.use('/api/expense', expenseRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/food-duties', foodDutyRoutes);
app.use('/api/madrasa', madrasaRoutes);
app.use('/api/divisions', divisionRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);
  res.status(500).json({
    success: false,
    message: err.message || 'An internal server error occurred'
  });
});

app.listen(PORT, () => {
  console.log(`🕌 جامعة النور ERP Server running on http://localhost:${PORT}`);
});
