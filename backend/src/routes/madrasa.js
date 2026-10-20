const express = require('express');
const router = express.Router();
const prisma = require('../config/db');
const authMiddleware = require('../middleware/auth');

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Accurately calculates dues for a Madrasa student based on admissionDate, monthly fee, opening balance, and payment history.
 */
function calculateStudentDue(student, payments = []) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-12

  const admDate = student.admissionDate ? new Date(student.admissionDate) : now;
  let startYear = admDate.getFullYear();
  let startMonth = admDate.getMonth() + 1;

  if (isNaN(startYear) || startYear < 1990) {
    startYear = currentYear;
    startMonth = 1;
  }

  // Create set of paid (year-month) keys
  const paidSet = new Set(payments.map(p => `${p.year}-${p.month}`));

  const dueMonths = [];
  let y = startYear;
  let m = startMonth;

  while (y < currentYear || (y === currentYear && m <= currentMonth)) {
    const key = `${y}-${m}`;
    if (!paidSet.has(key)) {
      dueMonths.push({
        month: m,
        year: y,
        label: `${MONTH_NAMES[m - 1]} ${y}`,
      });
    }
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }

  const monthlyFee = parseFloat(student.monthlyFee) || 0;
  const monthsDueAmount = dueMonths.length * monthlyFee;

  // Calculate Opening Balance arrears
  const totalOpeningBalance = parseFloat(student.openingBalance) || 0;
  const paidOpeningBalance = payments.reduce((sum, p) => sum + (parseFloat(p.openingBalanceAmount) || 0), 0);
  const netOpeningBalanceDue = Math.max(0, totalOpeningBalance - paidOpeningBalance);

  const totalDueAmount = monthsDueAmount + netOpeningBalanceDue;
  const isCurrentMonthPaid = paidSet.has(`${currentYear}-${currentMonth}`);
  const nextDueMonth = dueMonths.length > 0 ? dueMonths[0] : null;
  const dueMonthsNames = dueMonths.map(d => d.label).join(', ');

  return {
    dueMonthsCount: dueMonths.length,
    dueMonths,
    dueMonthsNames,
    nextDueMonth,
    monthlyFee,
    openingBalance: totalOpeningBalance,
    paidOpeningBalance,
    netOpeningBalanceDue,
    monthsDueAmount,
    totalDueAmount,
    isCurrentMonthPaid,
  };
}

// 1. Get all Madrasa Students with search, filters, dues, and smart prefix ranking
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { search, status, division, classLevel } = req.query;

    const isPostgres = Boolean(
      process.env.RENDER ||
      process.env.NODE_ENV === 'production' ||
      (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('postgres'))
    );

    const stringFilter = (value) => (
      isPostgres
        ? { contains: value, mode: 'insensitive' }
        : { contains: value }
    );

    const where = {};
    if (search && search.trim() !== '') {
      const q = search.trim();
      where.OR = [
        { parentName: stringFilter(q) },
        { parentPhone: stringFilter(q) },
        { job: stringFilter(q) },
        { division: stringFilter(q) },
        { studentName: stringFilter(q) },
        { classLevel: stringFilter(q) },
        { admissionNo: stringFilter(q) },
        { member: { name: stringFilter(q) } },
        { member: { phone: stringFilter(q) } },
      ];
    }

    if (status && status !== 'All') {
      where.status = status;
    }

    if (division && division !== 'All') {
      where.division = division;
    }

    if (classLevel && classLevel !== 'All') {
      where.classLevel = classLevel;
    }

    const students = await prisma.madrasaStudent.findMany({
      where,
      include: {
        member: {
          select: { id: true, name: true, phone: true, job: true, division: true, idNumber: true }
        },
        payments: {
          orderBy: { paymentDate: 'desc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    let studentsWithDue = students.map(s => {
      const dueInfo = calculateStudentDue(s, s.payments);
      return {
        ...s,
        ...dueInfo,
      };
    });

    // Smart Search Ranking: prioritize prefix matches on parent name or member name
    if (search && search.trim() !== '') {
      const qLower = search.trim().toLowerCase();
      studentsWithDue.sort((a, b) => {
        const aName = (a.parentName || a.member?.name || a.studentName || '').toLowerCase();
        const bName = (b.parentName || b.member?.name || b.studentName || '').toLowerCase();

        // 1. Exact start of parent/member name
        const aStarts = aName.startsWith(qLower);
        const bStarts = bName.startsWith(qLower);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;

        // 2. Any word in the name starts with query
        const aWordStarts = aName.split(/\s+/).some(w => w.startsWith(qLower));
        const bWordStarts = bName.split(/\s+/).some(w => w.startsWith(qLower));
        if (aWordStarts && !bWordStarts) return -1;
        if (!aWordStarts && bWordStarts) return 1;

        // 3. Default alphabetical sort
        return aName.localeCompare(bName);
      });
    }

    res.json({
      success: true,
      students: studentsWithDue,
      totalCount: studentsWithDue.length,
    });
  } catch (error) {
    console.error('Fetch madrasa students error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 2. Single Student with full details and payment history
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const student = await prisma.madrasaStudent.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        member: {
          select: { id: true, name: true, phone: true, division: true, idNumber: true }
        },
        payments: {
          orderBy: [{ year: 'desc' }, { month: 'desc' }]
        }
      }
    });

    if (!student) {
      return res.status(404).json({ success: false, message: 'Madrasa student not found' });
    }

    const dueInfo = calculateStudentDue(student, student.payments);

    res.json({
      success: true,
      student: {
        ...student,
        ...dueInfo,
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 3. Create Madrasa Record
router.post('/', authMiddleware, async (req, res) => {
  try {
    const {
      memberId,
      parentName,
      parentPhone,
      job,
      division,
      studentsCount = 1,
      studentName,
      admissionNo,
      classLevel = '',
      monthlyFee,
      feePerStudent = 200,
      openingBalance = 0,
      admissionDate,
      status = 'Active',
      notes
    } = req.body;

    let finalParentName = parentName ? parentName.trim() : '';
    let finalParentPhone = parentPhone ? String(parentPhone).trim() : '';
    let finalJob = job || '';
    let finalDivision = division || '';

    let parsedMemberId = null;
    if (memberId) {
      parsedMemberId = parseInt(memberId) || null;
      if (parsedMemberId) {
        const linkedMember = await prisma.member.findUnique({ where: { id: parsedMemberId } });
        if (linkedMember) {
          if (!finalParentName) finalParentName = linkedMember.name;
          if (!finalParentPhone) finalParentPhone = linkedMember.phone || '';
          if (!finalJob) finalJob = linkedMember.job || '';
          if (!finalDivision) finalDivision = linkedMember.division || '';
        }
      }
    }

    if (!finalParentName && !studentName) {
      return res.status(400).json({ success: false, message: 'Parent or Mahallu member selection is required.' });
    }

    const count = parseInt(studentsCount) || 1;
    const perFee = parseFloat(feePerStudent) || 200;
    const finalMonthlyFee = (monthlyFee !== undefined && parseFloat(monthlyFee) > 0)
      ? parseFloat(monthlyFee)
      : (count * perFee);

    const finalStudentName = studentName && studentName.trim()
      ? studentName.trim()
      : finalParentName;

    const newStudent = await prisma.madrasaStudent.create({
      data: {
        memberId: parsedMemberId,
        parentName: finalParentName,
        parentPhone: finalParentPhone,
        job: finalJob,
        division: finalDivision,
        studentsCount: count,
        studentName: finalStudentName,
        admissionNo: admissionNo ? String(admissionNo).trim() : null,
        classLevel: classLevel || '',
        monthlyFee: finalMonthlyFee,
        feePerStudent: perFee,
        openingBalance: parseFloat(openingBalance) || 0,
        admissionDate: admissionDate ? new Date(admissionDate) : new Date(),
        status: status || 'Active',
        notes: notes || '',
      },
      include: {
        member: { select: { id: true, name: true, phone: true, job: true, division: true } }
      }
    });

    res.status(201).json({
      success: true,
      message: 'Madrasa entry registered successfully',
      student: newStudent,
    });
  } catch (error) {
    console.error('Create madrasa error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 4. Update Madrasa Record
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const {
      memberId,
      parentName,
      parentPhone,
      job,
      division,
      studentsCount,
      studentName,
      admissionNo,
      classLevel,
      monthlyFee,
      feePerStudent,
      openingBalance,
      admissionDate,
      status,
      notes
    } = req.body;

    let parsedMemberId = undefined;
    if (memberId !== undefined) {
      parsedMemberId = memberId ? parseInt(memberId) : null;
    }

    const count = studentsCount !== undefined ? (parseInt(studentsCount) || 1) : undefined;
    const perFee = feePerStudent !== undefined ? (parseFloat(feePerStudent) || 200) : undefined;

    let calcMonthlyFee = undefined;
    if (monthlyFee !== undefined) {
      calcMonthlyFee = parseFloat(monthlyFee) || 0;
    }

    const updated = await prisma.madrasaStudent.update({
      where: { id: parseInt(req.params.id) },
      data: {
        memberId: parsedMemberId,
        parentName: parentName !== undefined ? parentName.trim() : undefined,
        parentPhone: parentPhone !== undefined ? parentPhone.trim() : undefined,
        job: job !== undefined ? job.trim() : undefined,
        division: division !== undefined ? division.trim() : undefined,
        studentsCount: count,
        studentName: studentName !== undefined ? studentName.trim() : undefined,
        admissionNo: admissionNo !== undefined ? (admissionNo ? String(admissionNo).trim() : null) : undefined,
        classLevel: classLevel !== undefined ? classLevel : undefined,
        monthlyFee: calcMonthlyFee,
        feePerStudent: perFee,
        openingBalance: openingBalance !== undefined ? (parseFloat(openingBalance) || 0) : undefined,
        admissionDate: admissionDate ? new Date(admissionDate) : undefined,
        status: status !== undefined ? status : undefined,
        notes: notes !== undefined ? notes : undefined,
      },
      include: {
        member: { select: { id: true, name: true, phone: true, job: true, division: true } }
      }
    });

    res.json({
      success: true,
      message: 'Madrasa student updated successfully',
      student: updated,
    });
  } catch (error) {
    console.error('Update madrasa student error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 5. Delete Madrasa Student
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const studentId = parseInt(req.params.id);

    const student = await prisma.madrasaStudent.findUnique({
      where: { id: studentId },
      include: { payments: true }
    });

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const paymentIds = student.payments.map(p => p.id);

    // Delete linked Income records safely
    await prisma.income.deleteMany({
      where: {
        OR: [
          { madrasaPaymentId: { in: paymentIds } },
          { studentId },
          { description: { contains: student.studentName } }
        ]
      }
    }).catch(err => console.warn('Income cleanup warning on student delete:', err.message));

    // Delete student (Cascade deletes payments)
    await prisma.madrasaStudent.delete({
      where: { id: studentId }
    });

    res.json({
      success: true,
      message: 'Student and related payment records deleted successfully'
    });
  } catch (error) {
    console.error('Delete madrasa student error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 6. Record Madrasa Fee Payment (Multi-month or single month, syncs as single Income record)
router.post('/:id/pay', authMiddleware, async (req, res) => {
  try {
    const studentId = parseInt(req.params.id);
    const {
      months, // Array of { month, year, label }
      month,
      year,
      feeAmount,
      openingBalanceAmount = 0,
      paymentMode = 'Cash in Hand',
      notes = ''
    } = req.body;

    const student = await prisma.madrasaStudent.findUnique({
      where: { id: studentId },
      include: { member: true }
    });

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const guardianName = student.parentName || student.member?.name || 'Guardian';
    const guardianPhone = student.parentPhone || student.member?.phone || '';
    const guardianDivision = student.division || student.member?.division || '';

    // Multi-month payment handling
    if (Array.isArray(months) && months.length > 0) {
      // Validate none of these months are already paid
      for (const mItem of months) {
        const mN = parseInt(mItem.month);
        const yN = parseInt(mItem.year);
        const existing = await prisma.madrasaPayment.findFirst({
          where: { studentId, month: mN, year: yN }
        });
        if (existing) {
          return res.status(400).json({
            success: false,
            message: `${student.studentName} has already paid fee for ${MONTH_NAMES[mN - 1]} ${yN}. Please uncheck already paid months.`
          });
        }
      }

      const totalFee = parseFloat(feeAmount) || 0;
      const totalOpening = parseFloat(openingBalanceAmount) || 0;
      const totalOverall = totalFee + totalOpening;

      if (totalOverall <= 0) {
        return res.status(400).json({ success: false, message: 'Payment total amount must be greater than zero.' });
      }

      const numMonths = months.length;
      const perMonthFee = Math.round((totalFee / numMonths) * 100) / 100;

      // Unique Shared Receipt No for the entire batch payment
      const sharedReceiptNo = `RCP-MAD-${Date.now().toString().slice(-6)}-${studentId}`;

      const createdPayments = await prisma.$transaction(async (tx) => {
        const batch = [];
        for (let idx = 0; idx < numMonths; idx++) {
          const mItem = months[idx];
          const mN = parseInt(mItem.month);
          const yN = parseInt(mItem.year);
          const openBalThis = idx === 0 ? totalOpening : 0;
          const totalThis = perMonthFee + openBalThis;

          const payment = await tx.madrasaPayment.create({
            data: {
              studentId,
              month: mN,
              year: yN,
              feeAmount: perMonthFee,
              openingBalanceAmount: openBalThis,
              totalAmount: totalThis,
              paymentMode,
              receiptNo: sharedReceiptNo,
              notes: notes || '',
            }
          });
          batch.push(payment);
        }

        // Create ONLY ONE consolidated Income record for the whole multi-month payment
        const monthListText = months.map(m => `${MONTH_NAMES[m.month - 1]} ${m.year}`).join(', ');
        let incomeDesc = `Madrasa fee for ${numMonths} month(s): ${monthListText}. Student: ${student.studentName} (${student.classLevel || 'General'})`;
        if (totalOpening > 0) incomeDesc += ` (Opening Balance: ₹${totalOpening})`;
        if (notes) incomeDesc += ` Note: ${notes}`;

        await tx.income.create({
          data: {
            donorName: `${student.studentName} (Parent: ${guardianName})`,
            donorPhone: guardianPhone,
            donorAddress: guardianDivision,
            category: 'Madrasa Monthly Fee',
            amount: totalOverall,
            paymentMode,
            description: incomeDesc,
            receiptNo: sharedReceiptNo,
            madrasaPaymentId: batch[0].id,
            studentId: student.id,
            date: new Date(),
          }
        });

        return batch;
      });

      return res.status(201).json({
        success: true,
        message: `Successfully recorded Madrasa fee payment of ₹${totalOverall} for ${numMonths} month(s) and synced as Income!`,
        payments: createdPayments,
      });
    }

    // Single month payment handling
    const mNum = parseInt(month) || 0;
    const yNum = parseInt(year) || new Date().getFullYear();

    if (mNum > 0 && parseFloat(feeAmount) > 0) {
      const existing = await prisma.madrasaPayment.findFirst({
        where: { studentId, month: mNum, year: yNum }
      });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: `${student.studentName} has already paid fee for ${MONTH_NAMES[mNum - 1]} ${yNum}.`
        });
      }
    }

    const tFee = parseFloat(feeAmount) || 0;
    const tOpen = parseFloat(openingBalanceAmount) || 0;
    const tAll = tFee + tOpen;

    if (tAll <= 0) {
      return res.status(400).json({ success: false, message: 'Payment total amount must be greater than zero.' });
    }

    const receiptNo = `RCP-MAD-${Date.now().toString().slice(-6)}-${studentId}`;

    const payment = await prisma.$transaction(async (tx) => {
      const p = await tx.madrasaPayment.create({
        data: {
          studentId,
          month: mNum,
          year: yNum,
          feeAmount: tFee,
          openingBalanceAmount: tOpen,
          totalAmount: tAll,
          paymentMode,
          receiptNo,
          notes: notes || '',
        }
      });

      let singleDesc = mNum > 0
        ? `Madrasa fee for ${MONTH_NAMES[mNum - 1]} ${yNum}. Student: ${student.studentName} (${student.classLevel || 'General'})`
        : `Madrasa past opening balance payment. Student: ${student.studentName}`;
      if (notes) singleDesc += ` Note: ${notes}`;

      await tx.income.create({
        data: {
          donorName: `${student.studentName} (Parent: ${guardianName})`,
          donorPhone: guardianPhone,
          donorAddress: guardianDivision,
          category: 'Madrasa Monthly Fee',
          amount: tAll,
          paymentMode,
          description: singleDesc,
          receiptNo,
          madrasaPaymentId: p.id,
          studentId: student.id,
          date: new Date(),
        }
      });

      return p;
    });

    res.status(201).json({
      success: true,
      message: 'Madrasa fee recorded and synced to Income successfully',
      payment,
    });
  } catch (error) {
    console.error('Record madrasa payment error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 7. Revert / Delete a Madrasa Payment (Batch by receiptNo or single)
router.delete('/:id/payments/:paymentId', authMiddleware, async (req, res) => {
  try {
    const studentId = parseInt(req.params.id);
    const paymentId = parseInt(req.params.paymentId);

    const payment = await prisma.madrasaPayment.findFirst({
      where: { id: paymentId, studentId }
    });

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment record not found' });
    }

    if (payment.receiptNo) {
      const batchPayments = await prisma.madrasaPayment.findMany({
        where: { studentId, receiptNo: payment.receiptNo }
      });
      const batchIds = batchPayments.map(p => p.id);

      // Delete linked Income record(s) safely
      await prisma.income.deleteMany({
        where: {
          OR: [
            { madrasaPaymentId: { in: batchIds } },
            { receiptNo: payment.receiptNo },
            { description: { contains: payment.receiptNo } }
          ]
        }
      }).catch(err => console.error('Income delete warning:', err));

      // Delete batch payments
      await prisma.madrasaPayment.deleteMany({
        where: { studentId, receiptNo: payment.receiptNo }
      });
    } else {
      await prisma.income.deleteMany({
        where: { madrasaPaymentId: paymentId }
      }).catch(err => console.error('Income delete warning:', err));

      await prisma.madrasaPayment.delete({
        where: { id: paymentId }
      });
    }

    res.json({
      success: true,
      message: 'Madrasa payment reverted and corresponding Income record removed successfully.'
    });
  } catch (error) {
    console.error('Revert madrasa payment error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
