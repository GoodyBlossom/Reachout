const { google } = require('googleapis');
require('dotenv').config();

// JWT Client Authentication using GCP Service Account Keys
const auth = new google.auth.JWT(
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  null,
  process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : '',
  ['https://www.googleapis.com/auth/spreadsheets']
);

const sheets = google.sheets({ version: 'v4', auth });

/**
 * Normalizes phone numbers to facilitate matching rows.
 */
function cleanPhone(num) {
  if (!num) return '';
  return num.toString().replace(/\s+/g, '').replace(/[^0-9]/g, '');
}

/**
 * getContactsFromSheet
 * Fetches rows from a Google Sheet and maps them to clean objects.
 * Expects sheet format: Name (Col A), Phone (Col B), Assigned Volunteer (Col C).
 */
async function getContactsFromSheet(spreadsheetId, range = 'Sheet1!A:C') {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      console.log('No data found in sheet.');
      return [];
    }

    const headers = rows[0].map(h => h.toLowerCase().trim());
    let nameIdx = 0;
    let phoneIdx = 1;
    let volunteerIdx = 2;

    headers.forEach((h, index) => {
      if (h.includes('name')) nameIdx = index;
      else if (h.includes('phone') || h.includes('number') || h.includes('contact')) phoneIdx = index;
      else if (h.includes('volunteer') || h.includes('member')) volunteerIdx = index;
    });

    const contacts = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row[phoneIdx]) {
        contacts.push({
          rowIndex: i + 1, // Store 1-indexed spreadsheet row number
          name: row[nameIdx] || 'Unknown',
          phone: row[phoneIdx].trim(),
          volunteer: row[volunteerIdx] || 'None'
        });
      }
    }
    return contacts;
  } catch (error) {
    console.error('Error fetching data from Google Sheet:', error);
    throw error;
  }
}

/**
 * updateRowStatus
 * Scans the sheet for a matching phone number and writes back the follow-up or
 * attendance status directly to column D (Status) and column E (Attendance).
 * 
 * @param {string} spreadsheetId - The target Google Sheet ID
 * @param {string} sheetName - Target worksheet tab (e.g. 'Sheet1')
 * @param {string} targetPhone - Contact phone number to find
 * @param {string} status - Follow-up status ('promised', 'optout', 'pending')
 * @param {string} attendance - Attendance status ('Came', 'Did Not Come', 'No Response')
 */
async function updateRowStatus(spreadsheetId, sheetName = 'Sheet1', targetPhone, status, attendance = 'No Response') {
  try {
    // 1. Fetch entire sheet values in phone number column to locate row index
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:C`,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) return false;

    // Resolve phone column header index
    const headers = rows[0].map(h => h.toLowerCase().trim());
    let phoneIdx = 1;
    headers.forEach((h, idx) => {
      if (h.includes('phone') || h.includes('number') || h.includes('contact')) phoneIdx = idx;
    });

    const cleanedTarget = cleanPhone(targetPhone);
    let matchedRowIndex = -1;

    for (let i = 1; i < rows.length; i++) {
      if (rows[i][phoneIdx] && cleanPhone(rows[i][phoneIdx]) === cleanedTarget) {
        matchedRowIndex = i + 1; // row index in spreadsheet (1-indexed)
        break;
      }
    }

    if (matchedRowIndex === -1) {
      console.log(`No matching contact row found in sheet for phone number: ${targetPhone}`);
      return false;
    }

    // 2. Write follow-up status (Col D) and attendance (Col E) to spreadsheet
    const request = {
      spreadsheetId,
      range: `${sheetName}!D${matchedRowIndex}:E${matchedRowIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[status.toUpperCase(), attendance]]
      }
    };

    const updateResponse = await sheets.spreadsheets.values.update(request);
    console.log(`Successfully synced spreadsheet row ${matchedRowIndex} cells D/E: status=${status}, attendance=${attendance}`);
    return true;
  } catch (error) {
    console.error(`Error updating Google Sheet cell:`, error);
    throw error;
  }
}

module.exports = {
  getContactsFromSheet,
  updateRowStatus
};
