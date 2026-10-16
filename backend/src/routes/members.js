const express = require('express');
const router = express.Router();
const prisma = require('../config/db');
const authMiddleware = require('../middleware/auth');

// Helper to compute due months and total due amount for a member
function calculateMemberDue(member, payments) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1 to 12

  // Determine starting month/year based on joiningDate
  const joinDate = member.joiningDate ? new Date(member.joiningDate) : new Date(currentYear, 0, 1);
  let startYear = joinDate.getFullYear();
  let startMonth = joinDate.getMonth() + 1;

  // Sanity check to avoid invalid negative or distant NaN dates
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
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      dueMonths.push({
        month: m,
        year: y,
        label: `${monthNames[m - 1]} ${y}`,
      });
    }
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }

  const monthlyTotal = (member.monthlyDonation || 0) + (member.hasMadrasa ? (member.madrasaMonthlyFee || 0) : 0);
  const monthsDueAmount = dueMonths.length * monthlyTotal;

  // Calculate Member Opening Balance (Past Arrears from manual records)
  const totalOpeningBalance = Number(member.openingBalance || 0);
  const paidOpeningBalance = payments.reduce((sum, p) => sum + Number(p.openingBalanceAmount || 0), 0);
  const netOpeningBalanceDue = Math.max(0, totalOpeningBalance - paidOpeningBalance);

  const totalDueAmount = monthsDueAmount + netOpeningBalanceDue;

  // Is current month paid?
  const isCurrentMonthPaid = paidSet.has(`${currentYear}-${currentMonth}`);
  const nextDueMonth = dueMonths.length > 0 ? dueMonths[0] : null;
  const dueMonthsNames = dueMonths.map(d => d.label).join(', ');

  return {
    dueMonthsCount: dueMonths.length,
    dueMonths,
    dueMonthsNames,
    nextDueMonth,
    monthlyTotal,
    openingBalance: totalOpeningBalance,
    paidOpeningBalance,
    netOpeningBalanceDue,
    monthsDueAmount,
    totalDueAmount,
    isCurrentMonthPaid,
  };
}

// Get all Members with search, status filter, and due calculations
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { search, status, division } = req.query;

    const where = {};
    if (search && search.trim() !== '') {
      const q = search.trim();
      where.OR = [
        { name: { contains: q } },
        { phone: { contains: q } },
        { address: { contains: q } },
        { idNumber: { contains: q } },
        { division: { contains: q } },
        { job: { contains: q } },
      ];
    }

    if (status && status !== 'All') {
      where.status = status;
    }

    if (division && division !== 'All') {
      where.division = division;
    }

    const members = await prisma.member.findMany({
      where,
      include: {
        payments: {
          orderBy: { paymentDate: 'desc' }
        }
      },
      orderBy: { name: 'asc' }
    });

    const membersWithDue = members.map(m => {
      const dueInfo = calculateMemberDue(m, m.payments);
      return {
        ...m,
        ...dueInfo,
      };
    });

    res.json({
      success: true,
      members: membersWithDue,
      totalCount: membersWithDue.length,
    });
  } catch (error) {
    console.error('Fetch members error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Single member with complete payment history
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const member = await prisma.member.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        payments: {
          orderBy: [{ year: 'desc' }, { month: 'desc' }]
        }
      }
    });

    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    const dueInfo = calculateMemberDue(member, member.payments);

    res.json({
      success: true,
      member: {
        ...member,
        ...dueInfo,
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create Member
router.post('/', authMiddleware, async (req, res) => {
  try {
    const {
      name,
      address,
      phone,
      job,
      division,
      idNumber,
      hasFamily = false,
      adultsCount = 0,
      childrenCount = 0,
      familyDetails,
      joiningDate,
      monthlyDonation = 100,
      openingBalance = 0,
      status = 'Active',
      hasMadrasa = false,
      madrasaChildrenCount = 0,
      madrasaMonthlyFee = 0,
      notes
    } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Name is required.' });
    }

    const newMember = await prisma.member.create({
      data: {
        name,
        address: address || '',
        phone: phone ? String(phone).trim() : '',
        job: job || '',
        division: division || '',
        idNumber: idNumber || '',
        hasFamily: Boolean(hasFamily),
        adultsCount: parseInt(adultsCount) || 0,
        childrenCount: parseInt(childrenCount) || 0,
        familyDetails: familyDetails || '',
        joiningDate: joiningDate ? new Date(joiningDate) : new Date(),
        monthlyDonation: parseFloat(monthlyDonation) || 100,
        openingBalance: parseFloat(openingBalance) || 0,
        status: status || 'Active',
        hasMadrasa: Boolean(hasMadrasa),
        madrasaChildrenCount: parseInt(madrasaChildrenCount) || 0,
        madrasaMonthlyFee: parseFloat(madrasaMonthlyFee) || 0,
        notes: notes || '',
      }
    });

    res.status(201).json({
      success: true,
      message: 'Member registered successfully',
      member: newMember,
    });
  } catch (error) {
    console.error('Create member error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update Member
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const {
      name,
      address,
      phone,
      job,
      division,
      idNumber,
      hasFamily,
      adultsCount,
      childrenCount,
      familyDetails,
      joiningDate,
      monthlyDonation,
      openingBalance,
      status,
      hasMadrasa,
      madrasaChildrenCount,
      madrasaMonthlyFee,
      notes
    } = req.body;

    const updated = await prisma.member.update({
      where: { id: parseInt(req.params.id) },
      data: {
        name,
        address,
        phone: phone !== undefined ? String(phone).trim() : undefined,
        job: job !== undefined ? job : undefined,
        division: division !== undefined ? division : undefined,
        idNumber: idNumber !== undefined ? idNumber : undefined,
        hasFamily: hasFamily !== undefined ? Boolean(hasFamily) : undefined,
        adultsCount: adultsCount !== undefined ? (parseInt(adultsCount) || 0) : undefined,
        childrenCount: childrenCount !== undefined ? (parseInt(childrenCount) || 0) : undefined,
        familyDetails: familyDetails !== undefined ? familyDetails : undefined,
        ...(joiningDate ? { joiningDate: new Date(joiningDate) } : {}),
        ...(monthlyDonation !== undefined ? { monthlyDonation: parseFloat(monthlyDonation) } : {}),
        ...(openingBalance !== undefined ? { openingBalance: parseFloat(openingBalance) } : {}),
        ...(status !== undefined ? { status } : {}),
        ...(hasMadrasa !== undefined ? { hasMadrasa: Boolean(hasMadrasa) } : {}),
        ...(madrasaChildrenCount !== undefined ? { madrasaChildrenCount: parseInt(madrasaChildrenCount) } : {}),
        ...(madrasaMonthlyFee !== undefined ? { madrasaMonthlyFee: parseFloat(madrasaMonthlyFee) } : {}),
        notes,
      }
    });

    res.json({
      success: true,
      message: 'Member updated successfully',
      member: updated,
    });
  } catch (error) {
    console.error('Update member error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete Member and associated Income records
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const memberId = parseInt(req.params.id);
    const member = await prisma.member.findUnique({
      where: { id: memberId },
      include: { payments: true }
    });

    if (member) {
      const paymentIds = (member.payments || []).map(p => p.id);
      // Clean up linked income records
      await prisma.income.deleteMany({
        where: {
          OR: [
            { memberId: memberId },
            ...(paymentIds.length > 0 ? [{ memberPaymentId: { in: paymentIds } }] : []),
            { donorName: member.name, category: 'Member Monthly Payment' }
          ]
        }
      });

      await prisma.member.delete({
        where: { id: memberId }
      });
    }

    res.json({ success: true, message: 'Member and linked income records deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Record Member Payment(s) - Supports single month, multiple months, and opening balance
router.post('/:id/payments', authMiddleware, async (req, res) => {
  try {
    const memberId = parseInt(req.params.id);
    const {
      month = 0,
      year = new Date().getFullYear(),
      membershipAmount = 0,
      madrasaAmount = 0,
      openingBalanceAmount = 0,
      paymentMode = 'Cash in Hand',
      notes,
      months = [] // Array of { month, year } for multi-month payment
    } = req.body;

    const member = await prisma.member.findUnique({ where: { id: memberId } });
    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    // If multiple months provided
    if (Array.isArray(months) && months.length > 0) {
      // Validate none of these months are already paid
      for (const mItem of months) {
        const mN = parseInt(mItem.month);
        const yN = parseInt(mItem.year);
        const existing = await prisma.memberPayment.findFirst({
          where: { memberId, month: mN, year: yN }
        });
        if (existing) {
          return res.status(400).json({
            success: false,
            message: `${member.name} has already paid for ${monthNames[mN - 1]} ${yN}. Please uncheck already paid months.`
          });
        }
      }

      const totalMembership = parseFloat(membershipAmount) || 0;
      const totalMadrasa = parseFloat(madrasaAmount) || 0;
      const totalOpening = parseFloat(openingBalanceAmount) || 0;
      const totalOverall = totalMembership + totalMadrasa + totalOpening;

      if (totalOverall <= 0) {
        return res.status(400).json({ success: false, message: 'Payment total amount must be greater than zero.' });
      }

      const numMonths = months.length;
      const perMonthMembership = Math.round((totalMembership / numMonths) * 100) / 100;
      const perMonthMadrasa = Math.round((totalMadrasa / numMonths) * 100) / 100;

      // Unique Shared Receipt No for the entire batch payment
      const sharedReceiptNo = `RCP-${Date.now().toString().slice(-6)}-${memberId}`;

      const createdPayments = await prisma.$transaction(async (tx) => {
        const batch = [];
        for (let idx = 0; idx < numMonths; idx++) {
          const mItem = months[idx];
          const mN = parseInt(mItem.month);
          const yN = parseInt(mItem.year);
          // Include opening balance amount on the first month record
          const openBalThis = idx === 0 ? totalOpening : 0;
          const totalThis = perMonthMembership + perMonthMadrasa + openBalThis;

          const payment = await tx.memberPayment.create({
            data: {
              memberId,
              month: mN,
              year: yN,
              membershipAmount: perMonthMembership,
              madrasaAmount: perMonthMadrasa,
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
        const monthListText = months.map(m => `${monthNames[m.month - 1]} ${m.year}`).join(', ');
        let incomeDesc = `Monthly donation for ${numMonths} month(s): ${monthListText}.`;
        if (totalMadrasa > 0) incomeDesc += ` (Madrasa: ₹${totalMadrasa})`;
        if (totalOpening > 0) incomeDesc += ` (Opening Balance: ₹${totalOpening})`;
        if (notes) incomeDesc += ` Note: ${notes}`;

        await tx.income.create({
          data: {
            donorName: member.name,
            donorPhone: member.phone || '',
            donorAddress: member.address || '',
            category: 'Member Monthly Payment',
            amount: totalOverall,
            paymentMode,
            description: incomeDesc,
            receiptNo: sharedReceiptNo,
            memberPaymentId: batch[0].id,
            memberId: member.id,
            date: new Date(),
          }
        });

        return batch;
      });

      return res.status(201).json({
        success: true,
        message: `Successfully recorded payment of ₹${totalOverall} for ${numMonths} month(s) and synced as single Income entry!`,
        payments: createdPayments,
      });
    }

    // Single month payment handling
    const mNum = parseInt(month) || 0;
    const yNum = parseInt(year) || new Date().getFullYear();

    if (mNum > 0 && parseFloat(membershipAmount) > 0) {
      const existingPayment = await prisma.memberPayment.findFirst({
        where: {
          memberId,
          month: mNum,
          year: yNum,
        }
      });

      if (existingPayment) {
        const mName = monthNames[mNum - 1];
        return res.status(400).json({
          success: false,
          message: `${member.name} has already paid for ${mName} ${yNum} on ${new Date(existingPayment.paymentDate).toLocaleDateString('en-GB')}. Please select an unpaid pending month or pay towards opening balance.`
        });
      }
    }

    const parsedMembership = parseFloat(membershipAmount) || 0;
    const parsedMadrasa = parseFloat(madrasaAmount) || 0;
    const parsedOpeningBal = parseFloat(openingBalanceAmount) || 0;
    const totalAmount = parsedMembership + parsedMadrasa + parsedOpeningBal;

    if (totalAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Payment total amount must be greater than zero.' });
    }

    const receiptNo = `RCP-${yNum}${String(mNum).padStart(2, '0')}-${String(memberId).padStart(3, '0')}-${Date.now().toString().slice(-4)}`;

    const payment = await prisma.$transaction(async (tx) => {
      const p = await tx.memberPayment.create({
        data: {
          memberId,
          month: mNum,
          year: yNum,
          membershipAmount: parsedMembership,
          madrasaAmount: parsedMadrasa,
          openingBalanceAmount: parsedOpeningBal,
          totalAmount,
          paymentMode,
          receiptNo,
          notes: notes || '',
        }
      });

      const monthStr = mNum > 0 ? monthNames[mNum - 1] : '';
      let incomeDesc = '';
      if (mNum > 0 && parsedMembership > 0) {
        incomeDesc += `Monthly subscription for ${monthStr} ${yNum}.`;
      }
      if (parsedMadrasa > 0) {
        incomeDesc += ` (Includes Madrasa Fee: ₹${parsedMadrasa})`;
      }
      if (parsedOpeningBal > 0) {
        incomeDesc += ` (Opening Balance Paid: ₹${parsedOpeningBal})`;
      }
      if (!incomeDesc) {
        incomeDesc = `Payment towards opening balance`;
      }
      if (notes) incomeDesc += ` Note: ${notes}`;

      await tx.income.create({
        data: {
          donorName: member.name,
          donorPhone: member.phone || '',
          donorAddress: member.address || '',
          category: 'Member Monthly Payment',
          amount: totalAmount,
          paymentMode: paymentMode,
          description: incomeDesc,
          receiptNo,
          memberPaymentId: p.id,
          memberId: member.id,
          date: new Date(),
        }
      });

      return p;
    });

    res.status(201).json({
      success: true,
      message: 'Payment recorded and synced to Income successfully',
      payment,
    });
  } catch (error) {
    console.error('Record member payment error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Revert / Delete a Member Payment (handles single or multi-month batch)
router.delete('/:id/payments/:paymentId', authMiddleware, async (req, res) => {
  try {
    const memberId = parseInt(req.params.id);
    const paymentId = parseInt(req.params.paymentId);

    const payment = await prisma.memberPayment.findFirst({
      where: { id: paymentId, memberId }
    });

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment record not found' });
    }

    if (payment.receiptNo) {
      // Find all payments belonging to this transaction batch
      const batchPayments = await prisma.memberPayment.findMany({
        where: { memberId, receiptNo: payment.receiptNo }
      });
      const batchIds = batchPayments.map(p => p.id);

      // Delete linked Income record(s) safely
      await prisma.income.deleteMany({
        where: {
          OR: [
            { memberPaymentId: { in: batchIds } },
            { receiptNo: payment.receiptNo },
            { description: { contains: payment.receiptNo } }
          ]
        }
      }).catch(err => console.error('Income delete warning:', err));

      // Delete all payments in this transaction batch
      await prisma.memberPayment.deleteMany({
        where: { memberId, receiptNo: payment.receiptNo }
      });
    } else {
      // Single record without receiptNo
      await prisma.income.deleteMany({
        where: { memberPaymentId: paymentId }
      }).catch(err => console.error('Income delete warning:', err));
      await prisma.memberPayment.delete({
        where: { id: paymentId }
      });
    }

    res.json({
      success: true,
      message: 'Payment reverted and corresponding Income record removed successfully.'
    });
  } catch (error) {
    console.error('Revert member payment error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
