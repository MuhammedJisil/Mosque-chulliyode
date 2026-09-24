const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // 1. Seed 3 Predefined Admin Accounts
  const adminDefaults = [
    { username: 'admin1', passwordRaw: 'admin123', name: 'Chief Administrator' },
    { username: 'admin2', passwordRaw: 'admin123', name: 'General Secretary' },
    { username: 'admin3', passwordRaw: 'admin123', name: 'Treasurer' },
  ];

  for (const admin of adminDefaults) {
    const hashedPassword = await bcrypt.hash(admin.passwordRaw, 10);
    const existing = await prisma.admin.findUnique({
      where: { username: admin.username }
    });

    if (!existing) {
      await prisma.admin.create({
        data: {
          username: admin.username,
          password: hashedPassword,
          name: admin.name,
          role: 'admin',
        }
      });
      console.log(`✅ Created Admin: ${admin.username} / ${admin.passwordRaw}`);
    } else {
      console.log(`ℹ️ Admin ${admin.username} already exists`);
    }
  }

  // 2. Initial Sample Staff
  const existingStaff = await prisma.staff.count();
  if (existingStaff === 0) {
    await prisma.staff.createMany({
      data: [
        { name: 'Moulana Abdul Rahman', phone: '9876543210', salary: 25000, category: 'Imam', status: 'Active', description: 'Head Imam of the Mosque' },
        { name: 'Hafiz Bilal Ahmed', phone: '9876543211', salary: 18000, category: 'Muazzin', status: 'Active', description: 'Muazzin & Assistant' },
        { name: 'Qari Zafar Iqbal', phone: '9876543212', salary: 15000, category: 'Teacher (Madarsa)', status: 'Active', description: 'Teaches Quran Tajweed' },
        { name: 'Mohammed Rafiq', phone: '9876543213', salary: 12000, category: 'Cleaner', status: 'Active', description: 'Facility maintenance & cleaning' },
      ]
    });
    console.log('✅ Seeded initial Staff members');
  }

  // 3. Initial Sample Members
  const existingMembers = await prisma.member.count();
  if (existingMembers === 0) {
    const m1 = await prisma.member.create({
      data: {
        name: 'Farooq Abdullah',
        phone: '9845012345',
        address: 'House #42, Main Road, Near Market',
        monthlyDonation: 100,
        status: 'Active',
        hasMadrasa: true,
        madrasaChildrenCount: 2,
        madrasaMonthlyFee: 400,
        notes: 'Enrolled in Madrasa evening batch'
      }
    });

    const m2 = await prisma.member.create({
      data: {
        name: 'Zameer Ahmed',
        phone: '9845098765',
        address: 'Flat 302, Green Meadows',
        monthlyDonation: 200,
        status: 'Active',
        hasMadrasa: false,
        madrasaChildrenCount: 0,
        madrasaMonthlyFee: 0,
        notes: 'Regular donor'
      }
    });

    const m3 = await prisma.member.create({
      data: {
        name: 'Tariq Mansoor',
        phone: '9845055555',
        address: 'B-14, Crescent Colony',
        monthlyDonation: 100,
        status: 'Active',
        hasMadrasa: true,
        madrasaChildrenCount: 1,
        madrasaMonthlyFee: 200,
        notes: 'Student: Ayaan Mansoor'
      }
    });

    const m4 = await prisma.member.create({
      data: {
        name: 'Suhail Khan',
        phone: '9845077777',
        address: 'Opposite Masjid Gate 2',
        monthlyDonation: 500,
        status: 'Active',
        hasMadrasa: false,
        madrasaChildrenCount: 0,
        madrasaMonthlyFee: 0,
        notes: 'Patron member'
      }
    });

    // Record payments for some members for current month
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    await prisma.memberPayment.create({
      data: {
        memberId: m1.id,
        month: currentMonth,
        year: currentYear,
        membershipAmount: 100,
        madrasaAmount: 400,
        totalAmount: 500,
        paymentMode: 'UPI',
        receiptNo: `RCP-${currentYear}${String(currentMonth).padStart(2, '0')}-001`,
        notes: 'Paid via GPay'
      }
    });

    await prisma.memberPayment.create({
      data: {
        memberId: m2.id,
        month: currentMonth,
        year: currentYear,
        membershipAmount: 200,
        madrasaAmount: 0,
        totalAmount: 200,
        paymentMode: 'Cash in Hand',
        receiptNo: `RCP-${currentYear}${String(currentMonth).padStart(2, '0')}-002`,
        notes: 'Handed to cashier'
      }
    });
    console.log('✅ Seeded initial Members and Monthly Payments');
  }

  // 4. Initial Sample Income Records
  const existingIncome = await prisma.income.count();
  if (existingIncome === 0) {
    await prisma.income.createMany({
      data: [
        {
          donorName: 'Jumma Congregation',
          donorPhone: '',
          donorAddress: 'Main Prayer Hall',
          category: 'Friday Collection',
          amount: 14500,
          paymentMode: 'Cash in Hand',
          description: 'Weekly Friday donation box count',
          date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
        },
        {
          donorName: 'Haji Mohammed Usman',
          donorPhone: '9811223344',
          donorAddress: 'Usman Nagar',
          category: 'Donation',
          amount: 25000,
          paymentMode: 'Bank Transfer',
          description: 'General Mosque upkeep donation',
          date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
        },
        {
          donorName: 'Bro. Salim Merchant',
          donorPhone: '9822334455',
          donorAddress: 'Merchant Lane',
          category: 'Zakat',
          amount: 30000,
          paymentMode: 'Online',
          description: 'Zakat disbursement fund',
          date: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)
        },
        {
          donorName: 'Community Box #1 & #2',
          donorPhone: '',
          donorAddress: 'Gate 1 and Gate 3',
          category: 'Donation Box Collection',
          amount: 6200,
          paymentMode: 'Cash in Hand',
          description: 'Monthly box opening',
          date: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000)
        }
      ]
    });
    console.log('✅ Seeded sample Income records');
  }

  // 5. Initial Sample Expense Records
  const existingExpense = await prisma.expense.count();
  if (existingExpense === 0) {
    await prisma.expense.createMany({
      data: [
        {
          purpose: 'Electricity Bill for Current Month',
          paidTo: 'State Electricity Board',
          category: 'Electricity Bill',
          amount: 8450,
          paymentMode: 'Online',
          description: 'Meter #4492-8812 paid online receipt attached',
          date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
        },
        {
          purpose: 'Wuzu Khana & Restroom Cleaning Supplies',
          paidTo: 'City Chemical & Hardware Store',
          category: 'Cleaning Supplies',
          amount: 1850,
          paymentMode: 'Cash in Hand',
          description: 'Disinfectant, soap, brushes, mop set',
          date: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)
        },
        {
          purpose: 'Sound System Wireless Mic Repair',
          paidTo: 'Acoustic Sound & Electronics',
          category: 'Sound System',
          amount: 3200,
          paymentMode: 'UPI',
          description: 'Replacement mic receiver for Mimbar',
          date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
        },
        {
          purpose: 'Plumbing and water pump maintenance',
          paidTo: 'Al-Madina Hardware',
          category: 'Maintenance & Repairs',
          amount: 2400,
          paymentMode: 'Cash in Hand',
          description: 'Repaired overhead tank float valve',
          date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000)
        }
      ]
    });
    console.log('✅ Seeded sample Expense records');
  }

  console.log('✨ Seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
