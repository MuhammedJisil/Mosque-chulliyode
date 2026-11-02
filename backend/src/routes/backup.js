const express = require('express');
const router = express.Router();
const prisma = require('../config/db');
const authMiddleware = require('../middleware/auth');

// Export all data as a backup JSON
router.get('/export', authMiddleware, async (req, res) => {
  if (req.admin && req.admin.role === 'viewer') {
    return res.status(403).json({ success: false, message: 'Access denied. View-only users cannot export or download database backups.' });
  }
  try {
    const [
      customCategories,
      settings,
      members,
      madrasaStudents,
      foodDuties,
      staff,
      incomes,
      expenses,
      admins
    ] = await Promise.all([
      prisma.customCategory.findMany(),
      prisma.setting.findMany(),
      prisma.member.findMany({
        include: { payments: true }
      }),
      prisma.madrasaStudent.findMany({
        include: { payments: true }
      }),
      prisma.foodDuty.findMany(),
      prisma.staff.findMany({
        include: { payments: true }
      }),
      prisma.income.findMany(),
      prisma.expense.findMany(),
      prisma.admin.findMany({
        select: { id: true, username: true, name: true, role: true, createdAt: true }
      })
    ]);

    const backupPayload = {
      app: 'Masjid al noor',
      subtitle: 'sirajul huda sangam chulliyode',
      version: '2.0',
      exportedAt: new Date().toISOString(),
      counts: {
        customCategories: customCategories.length,
        divisions: customCategories.filter(c => c.type === 'DIVISION').length,
        settings: settings.length,
        members: members.length,
        memberPayments: members.reduce((sum, m) => sum + (m.payments ? m.payments.length : 0), 0),
        madrasaStudents: madrasaStudents.length,
        madrasaPayments: madrasaStudents.reduce((sum, s) => sum + (s.payments ? s.payments.length : 0), 0),
        foodDuties: foodDuties.length,
        staff: staff.length,
        staffPayments: staff.reduce((sum, s) => sum + (s.payments ? s.payments.length : 0), 0),
        incomes: incomes.length,
        expenses: expenses.length,
        admins: admins.length
      },
      data: {
        customCategories,
        settings,
        members,
        madrasaStudents,
        foodDuties,
        staff,
        incomes,
        expenses
      }
    };

    res.json({
      success: true,
      backup: backupPayload
    });
  } catch (error) {
    console.error('Backup export error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate backup: ' + error.message });
  }
});

// Restore data from backup JSON
router.post('/restore', authMiddleware, async (req, res) => {
  if (req.admin && req.admin.role === 'viewer') {
    return res.status(403).json({ success: false, message: 'Access denied. View-only users cannot restore backups.' });
  }

  try {
    const { backupData } = req.body;
    if (!backupData || !backupData.data) {
      return res.status(400).json({ success: false, message: 'Invalid backup file format.' });
    }

    const {
      customCategories = [],
      settings = [],
      members = [],
      madrasaStudents = [],
      foodDuties = [],
      staff = [],
      incomes = [],
      expenses = []
    } = backupData.data;

    // Collect all sub-payments from members, madrasaStudents, and staff
    const allMemberPayments = [];
    members.forEach(m => {
      if (m.payments && Array.isArray(m.payments)) {
        m.payments.forEach(p => {
          allMemberPayments.push({
            id: p.id,
            memberId: p.memberId || m.id,
            month: parseInt(p.month) || 0,
            year: parseInt(p.year) || new Date().getFullYear(),
            membershipAmount: parseFloat(p.membershipAmount) || 0,
            madrasaAmount: parseFloat(p.madrasaAmount) || 0,
            openingBalanceAmount: parseFloat(p.openingBalanceAmount) || 0,
            totalAmount: parseFloat(p.totalAmount) || 0,
            paymentMode: p.paymentMode || 'Cash in Hand',
            paymentDate: p.paymentDate ? new Date(p.paymentDate) : new Date(),
            receiptNo: p.receiptNo || null,
            notes: p.notes || '',
            createdAt: p.createdAt ? new Date(p.createdAt) : new Date(),
          });
        });
      }
    });

    const allMadrasaPayments = [];
    madrasaStudents.forEach(s => {
      if (s.payments && Array.isArray(s.payments)) {
        s.payments.forEach(mp => {
          allMadrasaPayments.push({
            id: mp.id,
            studentId: mp.studentId || s.id,
            month: parseInt(mp.month) || 0,
            year: parseInt(mp.year) || new Date().getFullYear(),
            feeAmount: parseFloat(mp.feeAmount) || 0,
            openingBalanceAmount: parseFloat(mp.openingBalanceAmount) || 0,
            totalAmount: parseFloat(mp.totalAmount) || 0,
            paymentMode: mp.paymentMode || 'Cash in Hand',
            paymentDate: mp.paymentDate ? new Date(mp.paymentDate) : new Date(),
            receiptNo: mp.receiptNo || null,
            notes: mp.notes || null,
            createdAt: mp.createdAt ? new Date(mp.createdAt) : new Date(),
          });
        });
      }
    });

    const allStaffPayments = [];
    staff.forEach(s => {
      if (s.payments && Array.isArray(s.payments)) {
        s.payments.forEach(sp => {
          allStaffPayments.push({
            id: sp.id,
            staffId: sp.staffId || s.id,
            month: parseInt(sp.month) || 1,
            year: parseInt(sp.year) || new Date().getFullYear(),
            amount: parseFloat(sp.amount) || 0,
            paymentMode: sp.paymentMode || 'Cash in Hand',
            paymentDate: sp.paymentDate ? new Date(sp.paymentDate) : new Date(),
            receiptNo: sp.receiptNo || null,
            notes: sp.notes || '',
            createdAt: sp.createdAt ? new Date(sp.createdAt) : new Date(),
          });
        });
      }
    });

    // Execute in an optimized atomic batch transaction
    await prisma.$transaction(async (tx) => {
      // 1. Clear existing data in reverse dependency order
      await tx.madrasaPayment.deleteMany();
      await tx.madrasaStudent.deleteMany();
      await tx.foodDuty.deleteMany();
      await tx.memberPayment.deleteMany();
      await tx.staffPayment.deleteMany();
      await tx.income.deleteMany();
      await tx.expense.deleteMany();
      await tx.member.deleteMany();
      await tx.staff.deleteMany();
      await tx.customCategory.deleteMany();
      await tx.setting.deleteMany();

      // 2. Batch Restore Custom Categories
      if (customCategories.length > 0) {
        await tx.customCategory.createMany({
          data: customCategories.map(cat => ({
            id: cat.id,
            type: cat.type,
            name: cat.name,
            createdAt: cat.createdAt ? new Date(cat.createdAt) : new Date(),
          }))
        });
      }

      // 3. Batch Restore Settings
      if (settings.length > 0) {
        await tx.setting.createMany({
          data: settings.map(s => ({
            id: s.id,
            key: s.key,
            value: s.value,
          }))
        });
      }

      // 4. Batch Restore Members
      if (members.length > 0) {
        await tx.member.createMany({
          data: members.map(m => ({
            id: m.id,
            name: m.name,
            address: m.address || '',
            phone: m.phone || '',
            job: m.job || null,
            division: m.division || null,
            idNumber: m.idNumber || null,
            hasFamily: Boolean(m.hasFamily),
            adultsCount: parseInt(m.adultsCount) || 0,
            childrenCount: parseInt(m.childrenCount) || 0,
            familyDetails: m.familyDetails || null,
            joiningDate: m.joiningDate ? new Date(m.joiningDate) : new Date(),
            monthlyDonation: parseFloat(m.monthlyDonation) || 100,
            openingBalance: parseFloat(m.openingBalance) || 0,
            status: m.status || 'Active',
            endDate: m.endDate ? new Date(m.endDate) : null,
            hasMadrasa: Boolean(m.hasMadrasa),
            madrasaChildrenCount: parseInt(m.madrasaChildrenCount) || 0,
            madrasaMonthlyFee: parseFloat(m.madrasaMonthlyFee) || 0,
            notes: m.notes || '',
            createdAt: m.createdAt ? new Date(m.createdAt) : new Date(),
          }))
        });
      }

      // 5. Batch Restore Member Payments
      if (allMemberPayments.length > 0) {
        await tx.memberPayment.createMany({
          data: allMemberPayments
        });
      }

      // 6. Batch Restore Madrasa Students
      if (madrasaStudents.length > 0) {
        await tx.madrasaStudent.createMany({
          data: madrasaStudents.map(s => ({
            id: s.id,
            memberId: s.memberId || null,
            parentName: s.parentName || null,
            parentPhone: s.parentPhone || '',
            address: s.address || null,
            job: s.job || null,
            division: s.division || null,
            studentsCount: parseInt(s.studentsCount) || 1,
            studentName: s.studentName || null,
            admissionNo: s.admissionNo || null,
            classLevel: s.classLevel || '',
            monthlyFee: parseFloat(s.monthlyFee) || 200,
            feePerStudent: parseFloat(s.feePerStudent) || 200,
            openingBalance: parseFloat(s.openingBalance) || 0,
            admissionDate: s.admissionDate ? new Date(s.admissionDate) : new Date(),
            endDate: s.endDate ? new Date(s.endDate) : null,
            status: s.status || 'Active',
            notes: s.notes || null,
            createdAt: s.createdAt ? new Date(s.createdAt) : new Date(),
          }))
        });
      }

      // 7. Batch Restore Madrasa Payments
      if (allMadrasaPayments.length > 0) {
        await tx.madrasaPayment.createMany({
          data: allMadrasaPayments
        });
      }

      // 8. Batch Restore Food Duties
      if (foodDuties.length > 0) {
        await tx.foodDuty.createMany({
          data: foodDuties.map(fd => ({
            id: fd.id,
            memberId: fd.memberId || null,
            customName: fd.customName || null,
            phone: fd.phone || null,
            division: fd.division || null,
            date: fd.date ? new Date(fd.date) : new Date(),
            mealType: fd.mealType || 'All Day',
            status: fd.status || 'Pending',
            notes: fd.notes || null,
            createdAt: fd.createdAt ? new Date(fd.createdAt) : new Date(),
          }))
        });
      }

      // 9. Batch Restore Staff
      if (staff.length > 0) {
        await tx.staff.createMany({
          data: staff.map(s => ({
            id: s.id,
            name: s.name,
            phone: s.phone || '',
            salary: parseFloat(s.salary) || 0,
            category: s.category || 'Staff',
            joiningDate: s.joiningDate ? new Date(s.joiningDate) : new Date(),
            status: s.status || 'Active',
            description: s.description || '',
            createdAt: s.createdAt ? new Date(s.createdAt) : new Date(),
          }))
        });
      }

      // 10. Batch Restore Staff Payments
      if (allStaffPayments.length > 0) {
        await tx.staffPayment.createMany({
          data: allStaffPayments
        });
      }

      // 11. Batch Restore Incomes
      if (incomes.length > 0) {
        await tx.income.createMany({
          data: incomes.map(inc => ({
            id: inc.id,
            donorName: inc.donorName,
            donorPhone: inc.donorPhone || '',
            donorAddress: inc.donorAddress || '',
            category: inc.category,
            amount: parseFloat(inc.amount) || 0,
            paymentMode: inc.paymentMode || 'Cash in Hand',
            description: inc.description || '',
            customFields: inc.customFields || null,
            proofImage: inc.proofImage || null,
            receiptNo: inc.receiptNo || null,
            memberId: inc.memberId || null,
            memberPaymentId: inc.memberPaymentId || null,
            studentId: inc.studentId || null,
            madrasaPaymentId: inc.madrasaPaymentId || null,
            date: inc.date ? new Date(inc.date) : new Date(),
            createdAt: inc.createdAt ? new Date(inc.createdAt) : new Date(),
          }))
        });
      }

      // 12. Batch Restore Expenses
      if (expenses.length > 0) {
        await tx.expense.createMany({
          data: expenses.map(exp => ({
            id: exp.id,
            purpose: exp.purpose,
            paidTo: exp.paidTo,
            category: exp.category,
            amount: parseFloat(exp.amount) || 0,
            paymentMode: exp.paymentMode || 'Cash in Hand',
            description: exp.description || '',
            customFields: exp.customFields || null,
            proofImage: exp.proofImage || null,
            receiptNo: exp.receiptNo || null,
            staffId: exp.staffId || null,
            staffPaymentId: exp.staffPaymentId || null,
            date: exp.date ? new Date(exp.date) : new Date(),
            createdAt: exp.createdAt ? new Date(exp.createdAt) : new Date(),
          }))
        });
      }
    }, {
      maxWait: 20000,
      timeout: 60000
    });

    res.json({
      success: true,
      message: 'Database backup successfully restored!',
      restoredCounts: {
        members: members.length,
        madrasaStudents: madrasaStudents.length,
        foodDuties: foodDuties.length,
        staff: staff.length,
        incomes: incomes.length,
        expenses: expenses.length,
        categories: customCategories.length,
      }
    });
  } catch (error) {
    console.error('Backup restore error:', error);
    res.status(500).json({ success: false, message: 'Failed to restore backup: ' + error.message });
  }
});

module.exports = router;
