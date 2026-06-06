const express = require('express');
const bodyParser = require('body-parser');
const { getContactsFromSheet, updateRowStatus } = require('./services/googleSheets');
const { sendTemplateMessage, sendTextMessage } = require('./services/whatsapp');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
app.use(bodyParser.json());
app.use(express.static('public'));

const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'reachout_verify_token';

// Optional Database Initialization (Supabase PostgreSQL client)
let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  console.log('Supabase Database client initialized.');
} else {
  console.log('Running without Supabase. Fallback to server memory data store.');
}

// In-Memory database fallback for local prototyping
let inMemoryContacts = [];

// Simple Intent NLP Classifier
function classifyReply(text) {
  const lower = text.toLowerCase().trim();
  if (
    lower === 'stop' || 
    lower.includes('opt out') || 
    lower.includes('unsubscribe') || 
    lower.includes('commot me') || 
    lower.includes('remove') ||
    lower.includes('don\'t message') ||
    lower.includes('don\'t text') ||
    lower.includes('stop messaging')
  ) {
    return 'optout';
  }
  if (
    lower.includes('will attend') ||
    lower.includes('will come') ||
    lower.includes('interest') ||
    lower.includes('dey come') ||
    lower.includes('i will') ||
    lower.includes('amen') ||
    lower.includes('thanks') ||
    lower.includes('thank you') ||
    lower.includes('god bless') ||
    lower.includes('address') ||
    lower.includes('location') ||
    lower.includes('where') ||
    lower.includes('yes')
  ) {
    return 'promised';
  }
  return 'pending';
}

/**
 * GET /webhook
 * Meta Webhook verification endpoint. Handles challenge handshake requests.
 */
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('Meta Webhook validated successfully!');
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  }
});

/**
 * POST /webhook
 * Receives incoming WhatsApp messages in real-time.
 * Extracts text replies, classifies intent, updates DB, and triggers Google Sheet sync.
 */
app.post('/webhook', async (req, res) => {
  const body = req.body;

  // Verify this is a WhatsApp API webhook trigger
  if (body.object && body.entry && body.entry[0].changes && body.entry[0].changes[0].value.messages) {
    const message = body.entry[0].changes[0].value.messages[0];
    const fromPhone = '+' + message.from; // Sender's number (E.164)
    
    // Check if the message is a text message
    if (message.type === 'text') {
      const replyText = message.text.body;
      console.log(`Received WhatsApp reply from ${fromPhone}: "${replyText}"`);

      // 1. Run NLP classification
      const status = classifyReply(replyText);
      let attendance = 'No Response';
      if (status === 'promised') attendance = 'Promised';
      else if (status === 'optout') attendance = 'No Response'; // Opted out

      // 2. Fetch Spreadsheet ID associated with this contact
      let spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID; // Fallback default sheet env

      // 3. Update status in Database layer
      let matchedContact = null;
      if (supabase) {
        // Find contact in Postgres
        const { data } = await supabase.from('contacts').select('*').eq('phone_number', fromPhone).single();
        if (data) {
          matchedContact = data;
          await supabase.from('contacts').update({ status }).eq('id', data.id);
          
          // Log chat history
          await supabase.from('chat_logs').insert({
            contact_id: data.id,
            direction: 'Inbound',
            message_body: replyText,
            ai_classification: status
          });
        }
      } else {
        // Fallback local memory search
        matchedContact = inMemoryContacts.find(c => c.phone.replace(/[^0-9]/g, '') === fromPhone.replace(/[^0-9]/g, ''));
        if (matchedContact) {
          matchedContact.status = status;
          matchedContact.chat = matchedContact.chat || [];
          matchedContact.chat.push({ dir: 'in', msg: replyText });
        }
      }

      // 4. Sync updates back to the Google Sheet row cell in real-time
      if (spreadsheetId) {
        try {
          await updateRowStatus(spreadsheetId, 'Sheet1', fromPhone, status, attendance);
        } catch (err) {
          console.error('Failed to sync incoming response cell back to Google Sheets:', err);
        }
      }

      // 5. If response is positive, send handoff notification to assigned volunteer
      if (status === 'promised' && matchedContact) {
        const volunteerPhone = matchedContact.volunteer_phone || process.env.COORDINATOR_PHONE;
        if (volunteerPhone) {
          const handoffText = `🚨 Outreach Alert: ${matchedContact.name || 'A contact'} responded positively: "${replyText}". Tap to chat: https://wa.me/${fromPhone.replace(/[^0-9]/g, '')}`;
          try {
            await sendTextMessage(volunteerPhone, handoffText);
          } catch (err) {
            console.error('Failed to send volunteer handoff text alert:', err);
          }
        }
      }
    }
    res.sendStatus(200);
  } else {
    // Return a 200 to acknowledge other webhook events (e.g. read/delivered updates)
    res.sendStatus(200);
  }
});

/**
 * POST /api/import-sheet
 * Triggered by the frontend dashboard. Connects to the provided Google Sheet URL,
 * parses contacts, saves them to database, and kicks off sequence step 1.
 */
app.post('/api/import-sheet', async (req, res) => {
  const { spreadsheetId, sheetRange, chatbotPhone } = req.body;
  if (!spreadsheetId) {
    return res.status(400).json({ error: 'spreadsheetId is required' });
  }

  try {
    const parsedContacts = await getContactsFromSheet(spreadsheetId, sheetRange || 'Sheet1!A:C');
    console.log(`Retrieved ${parsedContacts.length} contacts from spreadsheet.`);

    const imported = [];
    for (const c of parsedContacts) {
      // Create Database records
      if (supabase) {
        const { data, error } = await supabase.from('contacts').insert({
          first_name: c.name.split(' ')[0] || c.name,
          last_name: c.name.split(' ')[1] || '',
          phone_number: c.phone,
          status: 'pending'
        }).select().single();

        if (data) {
          imported.push(data);
          // Insert first sequence queue job
          await supabase.from('sequence_jobs').insert({
            contact_id: data.id,
            step_number: 1,
            scheduled_at: new Date(), // Dispatch immediately
            status: 'Pending'
          });
        }
      } else {
        // Store in memory
        const contactObj = {
          id: Date.now() + Math.random(),
          name: c.name,
          phone: c.phone,
          volunteer: c.volunteer,
          chatbotPhone: chatbotPhone || '+234 803 000 0000',
          status: 'pending',
          steps: [true, false, false],
          chat: []
        };
        inMemoryContacts.push(contactObj);
        imported.push(contactObj);
      }

      // Simulate sending Step 1 template message on WhatsApp Cloud API
      try {
        const templateName = 'outreach_warmup';
        const params = [c.name, 'Ikeja Parish'];
        await sendTemplateMessage(c.phone, templateName, 'en', params);
      } catch (waErr) {
        console.error(`Failed to trigger WhatsApp message dispatch for ${c.phone}:`, waErr.message);
      }
    }

    res.status(200).json({
      message: `Successfully imported ${imported.length} contacts and initiated sequences.`,
      contactsCount: imported.length
    });
  } catch (error) {
    console.error('Import spreadsheet api error:', error);
    res.status(500).json({ error: 'Failed to import spreadsheet records' });
  }
});

/**
 * POST /api/manual-update
 * Triggers status updates manually and syncs immediately to the spreadsheet.
 */
app.post('/api/manual-update', async (req, res) => {
  const { phone, status, attendance } = req.body;
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;

  if (!phone || !status) {
    return res.status(400).json({ error: 'Phone number and status are required' });
  }

  try {
    // 1. Update Database layer
    if (supabase) {
      await supabase.from('contacts').update({ status }).eq('phone_number', phone);
    } else {
      const contact = inMemoryContacts.find(c => c.phone === phone);
      if (contact) {
        contact.status = status;
        contact.chat.push({ dir: 'out', msg: `[Manual Update]: Status changed to ${status}.` });
      }
    }

    // 2. Sync to Spreadsheet cell
    if (spreadsheetId) {
      await updateRowStatus(spreadsheetId, 'Sheet1', phone, status, attendance || 'No Response');
    }

    res.status(200).json({ message: 'Status updated and synced to sheet successfully.' });
  } catch (error) {
    console.error('Manual status update API failure:', error);
    res.status(500).json({ error: 'Failed to update status on spreadsheet' });
  }
});

app.listen(PORT, () => {
  console.log(`ReachOut AI Backend Server listening on http://localhost:${PORT}`);
});
