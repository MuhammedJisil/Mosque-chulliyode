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
  message += `This is a gentle notification from *Masjid al noor (sirajul huda sangam chulliyode)* regarding your monthly subscription.\n\n`;
  message += `📌 *Due Details:*\n`;

  if (member.dueMonthsCount > 0) {
    message += `• *Pending Months:* ${member.dueMonthsCount} month(s) (${monthsText})\n`;
    message += `• *Monthly Membership:* ₹${member.monthlyDonation || 0}/mo\n`;
  }

  if ((member.netOpeningBalanceDue || 0) > 0) {
    message += `• *Opening Balance Arrears:* ₹${member.netOpeningBalanceDue}\n`;
  }

  message += `\n💵 *Total Outstanding Due:* *₹${member.totalDueAmount || 0}*\n\n`;
  message += `Kindly remit your contribution at your earliest convenience to support the Masjid operations.\n\n`;
  message += `You may pay via UPI / GPay / PhonePe to the Masjid QR code or hand over directly to the Cashier at the Masjid office.\n\n`;
  message += `*JazakAllahu Khairan wa Ahsanal Jaza!* 🤲\n_Masjid al noor — sirajul huda sangam chulliyode_`;

  const encoded = encodeURIComponent(message);
  const url = `https://wa.me/${cleanPhone}?text=${encoded}`;

  window.open(url, '_blank');
};

/**
 * Generates a WhatsApp share URL and prefilled reminder message for Madrasa students with fee dues.
 */
export const openWhatsAppMadrasaDueReminder = (student) => {
  const phone = student.parentPhone || student.member?.phone;
  if (!phone) {
    alert('No phone number registered for this student or parent/guardian.');
    return;
  }

  let cleanPhone = phone.replace(/[^0-9]/g, '');
  if (cleanPhone.length === 10) {
    cleanPhone = `91${cleanPhone}`;
  }

  const monthsText = student.dueMonths && student.dueMonths.length > 0
    ? student.dueMonths.map(m => m.label).join(', ')
    : `${student.dueMonthsCount || 0} Month(s)`;

  const parentName = student.parentName || student.member?.name || 'Parent/Guardian';

  let message = `*Assalamu Alaikum wa Rahmatullahi wa Barakatuhu, ${parentName}* 🕌📚\n\n`;
  message += `This is a reminder from *Madrasa Sirajul Huda (Masjid al noor, Chulliyode)* regarding Madrasa fees for student: *${student.studentName}* (${student.classLevel || 'Class'})\n\n`;
  message += `📌 *Madrasa Fee Due Details:*\n`;

  if (student.dueMonthsCount > 0) {
    message += `• *Pending Months:* ${student.dueMonthsCount} month(s) (${monthsText})\n`;
    message += `• *Monthly Fee:* ₹${student.monthlyFee || 0}/mo\n`;
  }

  if ((student.netOpeningBalanceDue || 0) > 0) {
    message += `• *Fee Arrears / Opening Balance:* ₹${student.netOpeningBalanceDue}\n`;
  }

  message += `\n💵 *Total Outstanding Fee:* *₹${student.totalDueAmount || 0}*\n\n`;
  message += `Kindly remit the Madrasa fees at your earliest convenience to support our teachers and madrasa activities.\n\n`;
  message += `Payment can be made via UPI / Cash at the Madrasa / Masjid office.\n\n`;
  message += `*JazakAllahu Khairan wa Ahsanal Jaza!* 🤲\n_Madrasa Sirajul Huda — Masjid al noor Chulliyode_`;

  const encoded = encodeURIComponent(message);
  const url = `https://wa.me/${cleanPhone}?text=${encoded}`;

  window.open(url, '_blank');
};

/**
 * Generates a WhatsApp reminder message for Usthad's daily food duty turns.
 */
export const openWhatsAppFoodReminder = (duty) => {
  const phone = duty.phone || duty.member?.phone;
  if (!phone) {
    alert('No phone number recorded for this house/member.');
    return;
  }

  let cleanPhone = phone.replace(/[^0-9]/g, '');
  if (cleanPhone.length === 10) {
    cleanPhone = `91${cleanPhone}`;
  }

  const memberName = duty.member?.name || duty.customName || 'Dear Mahallu Member';
  const dutyDate = new Date(duty.date).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  let message = `*Assalamu Alaikum wa Rahmatullahi wa Barakatuhu, ${memberName}* 🕌\n\n`;
  message += `ഉസ്താദിന്റെ ഭക്ഷണപ്പടി (Usthad's Food Duty) ഓർമ്മപ്പെടുത്തൽ:\n`;
  message += `🗓️ *തീയതി (Date):* ${dutyDate}\n`;
  message += `🍲 *സമയം / തരം (Meal):* ${duty.mealType || 'All Day'}\n`;
  if (duty.division || duty.member?.division) {
    message += `📍 *ഏരിയ (Division):* ${duty.division || duty.member?.division}\n`;
  }
  message += `\nഅന്നേ ദിവസത്തെ ഭക്ഷണം താങ്കളുടെ വീട്ടിൽ നിന്നാണ് തയ്യാറാക്കേണ്ടത്. സാധിക്കാത്ത സാഹചര്യമുണ്ടെങ്കിൽ ദയവായി മറ്റ് ദിവസത്തിലേക്ക് മാറ്റുന്നതിനായി മുൻകൂട്ടി കമ്മിറ്റിയെ അറിയിക്കുക.\n\n`;
  message += `*JazakAllahu Khairan wa Ahsanal Jaza!* 🤲\n_Masjid al noor (sirajul huda sangam chulliyode)_`;

  const encoded = encodeURIComponent(message);
  const url = `https://wa.me/${cleanPhone}?text=${encoded}`;

  window.open(url, '_blank');
};

