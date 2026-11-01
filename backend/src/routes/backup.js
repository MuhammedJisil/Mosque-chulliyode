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

    // Execute in a transaction to maintain integrity
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

      // 2. Restore Custom Categories (includes DIVISION, INCOME, EXPENSE)
      for (const cat of customCategories) {
        await tx.customCategory.create({
          data: {
            type: cat.type,
            name: cat.name,
            createdAt: cat.createdAt ? new Date(cat.createdAt) : new Date(),
          }
        });
      }

      // 3. Restore Settings
      for (const s of settings) {
        await tx.setting.create({
          data: {
            key: s.key,
            value: s.value,
          }
        });
      }

      // 4. Restore Members & MemberPayments (mapping member IDs)
      const oldToNewMemberId = {};
      const oldToNewPaymentId = {};

      for (const m of members) {
        const createdMember = await tx.member.create({
          data: {
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
          }
        });

        oldToNewMemberId[m.id] = createdMember.id;

        if (m.payments && Array.isArray(m.payments)) {
          for (const p of m.payments) {
            const createdPayment = await tx.memberPayment.create({
              data: {
                memberId: createdMember.id,
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
              }
            });
            oldToNewPaymentId[p.id] = createdPayment.id;
          }
        }
      }

      // 5. Restore MadrasaStudents & MadrasaPayments (mapping student and member IDs)
      const oldToNewStudentId = {};
      const oldToNewMadrasaPaymentId = {};

      for (const s of madrasaStudents) {
        const mappedMemberId = s.memberId ? (oldToNewMemberId[s.memberId] || null) : null;
        const createdStudent = await tx.madrasaStudent.create({
          data: {
            memberId: mappedMemberId,
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
          }
        });

        oldToNewStudentId[s.id] = createdStudent.id;

        if (s.payments && Array.isArray(s.payments)) {
          for (const mp of s.payments) {
            const createdMadrasaPayment = await tx.madrasaPayment.create({
              data: {
                studentId: createdStudent.id,
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
              }
            });
            oldToNewMadrasaPaymentId[mp.id] = createdMadrasaPayment.id;
          }
        }
      }

      // 6. Restore Food Duties (mapping memberId)
      for (const fd of foodDuties) {
        const mappedMemberId = fd.memberId ? (oldToNewMemberId[fd.memberId] || null) : null;
        await tx.foodDuty.create({
          data: {
            memberId: mappedMemberId,
            customName: fd.customName || null,
            phone: fd.phone || null,
            division: fd.division || null,
            date: fd.date ? new Date(fd.date) : new Date(),
            mealType: fd.mealType || 'All Day',
            status: fd.status || 'Pending',
            notes: fd.notes || null,
            createdAt: fd.createdAt ? new Date(fd.createdAt) : new Date(),
          }
        });
      }

      // 7. Restore Staff & StaffPayments (mapping staff IDs)
      const oldToNewStaffId = {};
      const oldToNewStaffPaymentId = {};

      for (const s of staff) {
        const createdStaff = await tx.staff.create({
          data: {
            name: s.name,
            phone: s.phone || '',
            salary: parseFloat(s.salary) || 0,
            category: s.category || 'Staff',
            joiningDate: s.joiningDate ? new Date(s.joiningDate) : new Date(),
            status: s.status || 'Active',
            description: s.description || '',
            createdAt: s.createdAt ? new Date(s.createdAt) : new Date(),
          }
        });

        oldToNewStaffId[s.id] = createdStaff.id;

        if (s.payments && Array.isArray(s.payments)) {
          for (const sp of s.payments) {
            const createdStaffPayment = await tx.staffPayment.create({
              data: {
                staffId: createdStaff.id,
                month: parseInt(sp.month) || 1,
                year: parseInt(sp.year) || new Date().getFullYear(),
                amount: parseFloat(sp.amount) || 0,
                paymentMode: sp.paymentMode || 'Cash in Hand',
                paymentDate: sp.paymentDate ? new Date(sp.paymentDate) : new Date(),
                receiptNo: sp.receiptNo || null,
                notes: sp.notes || '',
                createdAt: sp.createdAt ? new Date(sp.createdAt) : new Date(),
              }
            });
            oldToNewStaffPaymentId[sp.id] = createdStaffPayment.id;
          }
        }
      }

      // 8. Restore Incomes (mapping memberId, memberPaymentId, studentId, madrasaPaymentId)
      for (const inc of incomes) {
        const mappedMemberId = inc.memberId ? (oldToNewMemberId[inc.memberId] || null) : null;
        const mappedMemberPaymentId = inc.memberPaymentId ? (oldToNewPaymentId[inc.memberPaymentId] || null) : null;
        const mappedStudentId = inc.studentId ? (oldToNewStudentId[inc.studentId] || null) : null;
        const mappedMadrasaPaymentId = inc.madrasaPaymentId ? (oldToNewMadrasaPaymentId[inc.madrasaPaymentId] || null) : null;

        await tx.income.create({
          data: {
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
            memberId: mappedMemberId,
            memberPaymentId: mappedMemberPaymentId,
            studentId: mappedStudentId,
            madrasaPaymentId: mappedMadrasaPaymentId,
            date: inc.date ? new Date(inc.date) : new Date(),
            createdAt: inc.createdAt ? new Date(inc.createdAt) : new Date(),
          }
        });
      }

      // 9. Restore Expenses (mapping staffId, staffPaymentId)
      for (const exp of expenses) {
        const mappedStaffId = exp.staffId ? (oldToNewStaffId[exp.staffId] || null) : null;
        const mappedStaffPaymentId = exp.staffPaymentId ? (oldToNewStaffPaymentId[exp.staffPaymentId] || null) : null;

        await tx.expense.create({
          data: {
            purpose: exp.purpose,
            paidTo: exp.paidTo,
            category: exp.category,
            amount: parseFloat(exp.amount) || 0,
            paymentMode: exp.paymentMode || 'Cash in Hand',
            description: exp.description || '',
            customFields: exp.customFields || null,
            proofImage: exp.proofImage || null,
            receiptNo: exp.receiptNo || null,
            staffId: mappedStaffId,
            staffPaymentId: mappedStaffPaymentId,
            date: exp.date ? new Date(exp.date) : new Date(),
            createdAt: exp.createdAt ? new Date(exp.createdAt) : new Date(),
          }
        });
      }
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
