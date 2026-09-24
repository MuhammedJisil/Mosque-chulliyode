/**
 * Generates a WhatsApp share URL and prefilled reminder message for members with dues.
 */
export const openWhatsAppDueReminder = (member) => {
  if (!member.phone) {
    alert('This member does not have a phone number registered.');
    return;
  }

  // Format phone number: remove non-digits
  let cleanPhone = member.phone.replace(/[^0-9]/g, '');
  // If Indian 10 digits without country code, prepend 91
  if (cleanPhone.length === 10) {
    cleanPhone = `91${cleanPhone}`;
  }

  const monthsText = member.dueMonths && member.dueMonths.length > 0
    ? member.dueMonths.map(m => m.label).join(', ')
    : `${member.dueMonthsCount || 0} Month(s)`;

  let message = `*Assalamu Alaikum wa Rahmatullahi wa Barakatuhu, ${member.name}* 🕌\n\n`;
  message += `This is a gentle notification from *جامعة النور (Jamia An-Noor) Masjid Committee* regarding your monthly subscription.\n\n`;
  message += `📌 *Due Details:*\n`;

  if (member.dueMonthsCount > 0) {
    message += `• *Pending Months:* ${member.dueMonthsCount} month(s) (${monthsText})\n`;
    message += `• *Monthly Membership:* ₹${member.monthlyDonation || 0}/mo\n`;
  }

  if (member.hasMadrasa && member.madrasaMonthlyFee > 0) {
    message += `• *Madrasa Children:* ${member.madrasaChildrenCount || 1} child(ren)\n`;
    message += `• *Madrasa Monthly Fee:* ₹${member.madrasaMonthlyFee}/mo\n`;
  }

  if ((member.netOpeningBalanceDue || 0) > 0) {
    message += `• *Past Arrears (Opening Balance):* ₹${member.netOpeningBalanceDue}\n`;
  }

  message += `\n💵 *Total Outstanding Due:* *₹${member.totalDueAmount || 0}*\n\n`;
  message += `Kindly remit your contribution at your earliest convenience to support the Masjid expenses and Madrasa operations.\n\n`;
  message += `You may pay via UPI / GPay / PhonePe to the Masjid QR code or hand over directly to the Cashier at the Masjid office.\n\n`;
  message += `*JazakAllahu Khairan wa Ahsanal Jaza!* 🤲\n_جامعة النور — Jamia An-Noor Management Committee_`;

  const encoded = encodeURIComponent(message);
  const url = `https://wa.me/${cleanPhone}?text=${encoded}`;

  window.open(url, '_blank');
};
