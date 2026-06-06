/**
 * ReachOut MVP - Client-Side Logic
 * Implementations for local state management, LocalStorage, rendering, and simulation.
 */

// Global State
let contacts = [];
let selectedContactId = null;

/**
 * loadData
 * Loads the contact state from LocalStorage. 
 * If no data exists, initializes it with mock database records.
 */
function loadData() {
  const localData = localStorage.getItem('reachout_contacts');
  if (localData) {
    try {
      contacts = JSON.parse(localData);
      // Auto-heal: If LocalStorage contains scrambled Excel binary data, restore defaults
      const hasCorruptData = contacts.some(c => 
        c.name.includes('workbook.xml') || 
        c.name.includes('rels') || 
        c.name.includes('[Content_Types]')
      );
      if (hasCorruptData) {
        console.warn('Corrupt binary spreadsheet data detected. Purging and restoring defaults.');
        initializeMockData();
      }
    } catch (e) {
      console.error('Failed to parse contacts from LocalStorage', e);
      initializeMockData();
    }
  } else {
    initializeMockData();
  }
}

/**
 * saveData
 * Persists the current state of the contacts array to LocalStorage.
 */
function saveData() {
  localStorage.setItem('reachout_contacts', JSON.stringify(contacts));
}

/**
 * renderList
 * Dynamically constructs and inserts list items for each contact into #list-root.
 * Injects a CSV export button above the list and attaches click listeners.
 */
function renderList() {
  const listRoot = document.getElementById('list-root');
  if (!listRoot) return;
  listRoot.innerHTML = '';

  // Dynamically inject Export CSV Button above list if it doesn't exist
  let exportBtn = document.getElementById('btn-export-csv');
  if (!exportBtn) {
    exportBtn = document.createElement('button');
    exportBtn.id = 'btn-export-csv';
    exportBtn.className = 'btn-submit';
    exportBtn.style.margin = '0 0 16px 0';
    exportBtn.style.background = 'var(--grad-seq)';
    exportBtn.style.width = '100%';
    exportBtn.innerText = '📤 Export Updated Sheet (CSV)';
    exportBtn.onclick = exportToCSV;
    listRoot.parentNode.insertBefore(exportBtn, listRoot);
  }

  contacts.forEach(contact => {
    const li = document.createElement('li');
    li.className = `contact-item ${contact.id === selectedContactId ? 'active' : ''}`;
    li.setAttribute('role', 'listitem');
    li.onclick = () => selectContact(contact.id);

    const initials = contact.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    
    let statusText = 'Pending';
    let pillClass = contact.status;
    
    // Map custom categories to existing CSS styling classes
    if (contact.status === 'promised') {
      statusText = 'Promised';
      pillClass = 'responded';
    } else if (contact.status === 'attended') {
      statusText = 'Attended';
      pillClass = 'responded';
    } else if (contact.status === 'absent') {
      statusText = 'Absent';
      pillClass = 'optout';
    } else if (contact.status === 'optout') {
      statusText = 'Opted-Out';
      pillClass = 'optout';
    }

    li.innerHTML = `
      <div class="avatar" aria-hidden="true">${initials}</div>
      <div class="contact-info">
        <strong>${contact.name}</strong>
        <span class="contact-phone">${contact.phone}</span>
        <div class="contact-step">
          <div class="dot ${contact.steps[0] ? 'done' : ''}" title="Step 1"></div>
          <div class="dot ${contact.steps[1] ? 'done' : ''}" title="Step 2"></div>
          <div class="dot ${contact.steps[2] ? 'done' : ''}" title="Step 3"></div>
        </div>
      </div>
      <span class="status-pill ${pillClass}" role="status">${statusText}</span>
    `;
    listRoot.appendChild(li);
  });
}

/**
 * renderInsights
 * Calculates and updates campaign KPIs, remapping metrics tiles to show:
 * Total Contacts, Promised to Come, Came to Church, and Did Not Come.
 */
function renderInsights() {
  const total = contacts.length;
  const promised = contacts.filter(c => c.status === 'promised').length;
  const attended = contacts.filter(c => c.status === 'attended').length;
  const absent = contacts.filter(c => c.status === 'absent').length;

  const totalEl = document.getElementById('metric-total');
  const deliveryEl = document.getElementById('metric-delivery');
  const responseEl = document.getElementById('metric-response');
  const optoutEl = document.getElementById('metric-optout');

  // Remap dashboard cards dynamically to display requested status columns
  if (totalEl) totalEl.innerText = total;
  
  if (deliveryEl) {
    deliveryEl.innerText = promised;
    deliveryEl.nextElementSibling.innerText = "Promised to Come";
  }
  
  if (responseEl) {
    responseEl.innerText = attended;
    responseEl.nextElementSibling.innerText = "Came to Church (Attended)";
  }
  
  if (optoutEl) {
    optoutEl.innerText = absent;
    optoutEl.nextElementSibling.innerText = "Did Not Come (Absent)";
  }

  // Sequence Fills
  const step1Count = contacts.filter(c => c.steps[0]).length;
  const step2Count = contacts.filter(c => c.steps[1]).length;
  const step3Count = contacts.filter(c => c.steps[2]).length;

  const label1 = document.getElementById('label-step1');
  const fill1 = document.getElementById('fill-step1');
  if (label1 && fill1) {
    label1.innerText = `${step1Count} / ${total}`;
    fill1.style.width = total > 0 ? (step1Count / total) * 100 + '%' : '0%';
  }

  const label2 = document.getElementById('label-step2');
  const fill2 = document.getElementById('fill-step2');
  if (label2 && fill2) {
    label2.innerText = `${step2Count} / ${total}`;
    fill2.style.width = total > 0 ? (step2Count / total) * 100 + '%' : '0%';
  }

  const label3 = document.getElementById('label-step3');
  const fill3 = document.getElementById('fill-step3');
  if (label3 && fill3) {
    label3.innerText = `${step3Count} / ${total}`;
    fill3.style.width = total > 0 ? (step3Count / total) * 100 + '%' : '0%';
  }

  // Render Volunteer List
  const volunteerList = document.getElementById('volunteer-list');
  if (volunteerList) {
    volunteerList.innerHTML = '';
    const vMap = {};
    contacts.forEach(c => {
      if (c.volunteer && c.volunteer !== 'None') {
        vMap[c.volunteer] = (vMap[c.volunteer] || 0) + 1;
      }
    });

    Object.keys(vMap).forEach(vName => {
      const count = vMap[vName];
      const initials = vName.split(' ').map(n => n[0]).join('');
      const row = document.createElement('div');
      row.className = 'volunteer-row';
      row.innerHTML = `
        <div class="v-left">
          <div class="v-avatar">${initials}</div>
          <div class="v-info">
            <strong>${vName}</strong>
            <span>Outreach Follow-up Team</span>
          </div>
        </div>
        <span class="v-count" aria-label="${count} active leads">${count} active</span>
      `;
      volunteerList.appendChild(row);
    });
  }
}

/**
 * updateHeroStats
 * Sets elements in the hero dashboard strip to display real-time follow-up statistics.
 */
function updateHeroStats() {
  const statContainers = document.querySelectorAll('.hero-stat strong');
  if (statContainers && statContainers.length >= 3) {
    const activeFollowups = contacts.filter(c => c.status === 'pending').length;
    statContainers[0].innerText = '3×';
    statContainers[1].innerText = contacts.length > 0 ? 'AI Live' : 'AI Ready';
    statContainers[2].innerText = activeFollowups;
    const labelSpan = statContainers[2].nextElementSibling;
    if (labelSpan) labelSpan.innerText = 'Active Followups';
  }
}

/**
 * init
 * Bootstraps the application. Injects Dedicated Chatbot WhatsApp Number field dynamically,
 * attaches CSV parser triggers, and binds simulated AI response logic.
 */
function init() {
  loadData();

  // Dynamically Inject Dedicated Chatbot WhatsApp Number field into the Form
  const importForm = document.getElementById('import-form');
  if (importForm) {
    let chatbotPhoneField = document.getElementById('field-chatbot-phone');
    if (!chatbotPhoneField) {
      chatbotPhoneField = document.createElement('div');
      chatbotPhoneField.id = 'field-chatbot-phone';
      chatbotPhoneField.className = 'form-field';
      chatbotPhoneField.innerHTML = `
        <label for="input-chatbot-phone">Dedicated Chatbot WhatsApp Number</label>
        <input id="input-chatbot-phone" type="tel" placeholder="e.g. +234 803 000 0000" value="+234 803 000 0000" />
      `;
      // Find event date label container to inject before it
      const eventDateField = document.getElementById('input-event-date');
      if (eventDateField) {
        const parentField = eventDateField.parentNode;
        parentField.parentNode.insertBefore(chatbotPhoneField, parentField);
      }
    }
  }

  renderList();
  renderInsights();
  updateHeroStats();

  // Handle Import Submission & CSV File Processing
  if (importForm) {
    importForm.onsubmit = function(e) {
      e.preventDefault();
      
      const churchName = document.getElementById('input-church-name').value || 'Global Impact Church';
      const chatbotPhone = document.getElementById('input-chatbot-phone').value || '+234 803 000 0000';
      const fileInput = document.getElementById('input-file');
      
      const churchDisplay = document.getElementById('church-display');
      if (churchDisplay) churchDisplay.innerText = churchName;
      
      const submitBtn = importForm.querySelector('.btn-submit');
      
      if (fileInput.files[0]) {
        const file = fileInput.files[0];
        const extension = file.name.split('.').pop().toLowerCase();
        
        if (extension === 'xlsx' || extension === 'xls') {
          showToast('❌ Error: Excel files (.xlsx) are binary files and cannot be read as plain text. Please save your Excel sheet as a CSV (Comma Separated Values) file and upload it again!');
          fileInput.value = '';
          const fileLabel = document.getElementById('file-label-text');
          if (fileLabel) fileLabel.innerText = "Tap to choose simulated sheet";
          return;
        }

        showToast(`Uploading and parsing ${file.name}...`);
        
        if (submitBtn) {
          submitBtn.innerText = '⏳ Processing Sheet...';
          submitBtn.disabled = true;
        }

        const reader = new FileReader();
        reader.onload = function(evt) {
          try {
            const imported = parseCSV(evt.target.result, chatbotPhone);
            if (imported.length > 0) {
              contacts.push(...imported);
              saveData();
              renderList();
              renderInsights();
              updateHeroStats();
              showToast(`Success! Imported ${imported.length} contacts associated with Chatbot ${chatbotPhone}.`);
            } else {
              showToast('Could not parse any valid contacts. Check file columns.');
            }
          } catch (err) {
            console.error(err);
            showToast('Error parsing file. Please ensure it is a valid CSV.');
          } finally {
            if (submitBtn) {
              submitBtn.innerText = '✅ Upload & Begin Follow-up';
              submitBtn.disabled = false;
            }
            const fileLabel = document.getElementById('file-label-text');
            if (fileLabel) fileLabel.innerText = "Tap to choose simulated sheet";
            fileInput.value = '';
          }
        };
        reader.readAsText(file);
      } else {
        // Fallback to simulation if no file is present
        showToast('No file selected. Generating 2 simulated contacts...');
        if (submitBtn) {
          submitBtn.innerText = '⏳ Processing...';
          submitBtn.disabled = true;
        }
        setTimeout(() => {
          const newContacts = [
            {
              id: Date.now() + 1,
              name: "Kelechi Nnamdi",
              phone: normalizePhoneNumber("08039998877"),
              steps: [true, false, false],
              status: "pending",
              volunteer: "Sister Blessing",
              chatbotPhone: chatbotPhone,
              chat: [{ dir: "out", msg: `[Chatbot ${chatbotPhone}]: Hi Kelechi, it was great meeting you yesterday at Maryland! We'd love to welcome you to our parish this season.` }]
            },
            {
              id: Date.now() + 2,
              name: "Oluwaseun Alao",
              phone: normalizePhoneNumber("09021112233"),
              steps: [true, false, false],
              status: "pending",
              volunteer: "Brother Timothy",
              chatbotPhone: chatbotPhone,
              chat: [{ dir: "out", msg: `[Chatbot ${chatbotPhone}]: Hi Oluwaseun, it was great meeting you yesterday at Gbagada! We'd love to welcome you to our parish this season.` }]
            }
          ];
          
          contacts.push(...newContacts);
          saveData();
          renderList();
          renderInsights();
          updateHeroStats();
          
          if (submitBtn) {
            submitBtn.innerText = '✅ Upload & Begin Follow-up';
            submitBtn.disabled = false;
          }
          
          showToast("Success! 2 simulated contacts added.");
        }, 1200);
      }
    };
  }

  // Handle Sandbox Message Sends
  const sendBtn = document.getElementById('btn-sim-send');
  if (sendBtn) {
    sendBtn.onclick = simulateReply;
  }
  const replyInput = document.getElementById('sim-reply-input');
  if (replyInput) {
    replyInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') simulateReply();
    });
  }

  // Handle Sheet Input Selection Styling
  const fileInput = document.getElementById('input-file');
  if (fileInput) {
    fileInput.onchange = function() {
      if (fileInput.files[0]) {
        const fileLabel = document.getElementById('file-label-text');
        if (fileLabel) fileLabel.innerText = `📄 ${fileInput.files[0].name}`;
      }
    };
  }

  // Scroll Shortcut
  const heroPrimary = document.getElementById('btn-primary');
  if (heroPrimary) {
    heroPrimary.onclick = function() {
      const importSec = document.getElementById('import-sec');
      if (importSec) importSec.scrollIntoView({ behavior: 'smooth' });
    };
  }
}

// Helper: Initialize Mock Database Contacts
function initializeMockData() {
  const defaultBot = "+234 803 000 0000";
  contacts = [
    {
      id: 1,
      name: "Adaeze Okonkwo",
      phone: "+234 803 123 4567",
      steps: [true, true, false],
      status: "promised",
      volunteer: "Sister Blessing",
      chatbotPhone: defaultBot,
      chat: [
        { dir: "out", msg: `[Chatbot ${defaultBot}]: Hi Adaeze, it was great meeting you yesterday at Ikeja! We'd love to welcome you to our parish this season.` },
        { dir: "out", msg: `[Chatbot ${defaultBot}]: Hi Adaeze, hope your week is off to a great start. Here is a short devotional word from our pastor.` },
        { dir: "in", msg: "Thank you so much! I will come this Sunday." }
      ]
    },
    {
      id: 2,
      name: "Emeka Obi",
      phone: "+234 812 345 6789",
      steps: [true, false, false],
      status: "pending",
      volunteer: "Brother Timothy",
      chatbotPhone: defaultBot,
      chat: [
        { dir: "out", msg: `[Chatbot ${defaultBot}]: Hi Emeka, it was great meeting you yesterday at Surulere! We'd love to welcome you to our parish this season.` }
      ]
    },
    {
      id: 3,
      name: "Tunde Bakare",
      phone: "+234 905 555 4321",
      steps: [true, true, false],
      status: "promised",
      volunteer: "Sister Blessing",
      chatbotPhone: defaultBot,
      chat: [
        { dir: "out", msg: `[Chatbot ${defaultBot}]: Hi Tunde, it was great meeting you yesterday at Maryland! We'd love to welcome you to our parish this season.` },
        { dir: "out", msg: `[Chatbot ${defaultBot}]: Hi Tunde, hope your week is off to a great start.` },
        { dir: "in", msg: "I dey come this Sunday! Can I get address?" }
      ]
    },
    {
      id: 4,
      name: "Chioma Nwachukwu",
      phone: "+234 806 777 8899",
      steps: [true, false, false],
      status: "optout",
      volunteer: "None",
      chatbotPhone: defaultBot,
      chat: [
        { dir: "out", msg: `[Chatbot ${defaultBot}]: Hi Chioma, it was great meeting you yesterday at Yaba! We'd love to welcome you to our parish this season.` },
        { dir: "in", msg: "STOP" }
      ]
    }
  ];
  saveData();
}

// Helper: Open Contact details in AI Sandbox
function selectContact(id) {
  selectedContactId = id;
  const contact = contacts.find(c => c.id === id);
  if (!contact) return;

  const panel = document.getElementById('sim-panel');
  if (panel) panel.classList.add('visible');

  const nameEl = document.getElementById('sim-contact-name');
  const phoneEl = document.getElementById('sim-contact-phone');
  if (nameEl) nameEl.innerText = `${contact.name} (Bot: ${contact.chatbotPhone || '+234 803 000 0000'})`;
  if (phoneEl) phoneEl.innerText = contact.phone;

  // Dynamically inject manual status modification buttons in Sandbox
  let actionsDiv = document.getElementById('sandbox-status-actions');
  if (!actionsDiv) {
    actionsDiv = document.createElement('div');
    actionsDiv.id = 'sandbox-status-actions';
    actionsDiv.style.display = 'flex';
    actionsDiv.style.gap = '8px';
    actionsDiv.style.marginBottom = '12px';
    actionsDiv.style.marginTop = '10px';
    
    const simInputs = document.querySelector('.sim-inputs');
    if (simInputs) {
      simInputs.parentNode.insertBefore(actionsDiv, simInputs);
    }
  }

  // Bind actions dynamically for the selected contact
  actionsDiv.innerHTML = `
    <button class="btn-sim-send" style="background:var(--jade); flex:1; padding: 6px 4px; font-size: 0.72rem" onclick="updateContactStatus('promised')">Promised</button>
    <button class="btn-sim-send" style="background:#7c6fcd; flex:1; padding: 6px 4px; font-size: 0.72rem" onclick="updateContactStatus('attended')">Attended</button>
    <button class="btn-sim-send" style="background:#e8a030; flex:1; padding: 6px 4px; font-size: 0.72rem" onclick="updateContactStatus('absent')">Absent</button>
  `;

  renderChatLog(contact);
  renderList();
}

// Helper: Dynamic Status Update Handler triggered by buttons
window.updateContactStatus = function(newStatus) {
  if (selectedContactId === null) return;
  const contact = contacts.find(c => c.id === selectedContactId);
  if (!contact) return;

  contact.status = newStatus;
  let label = 'Pending';
  if (newStatus === 'promised') {
    label = 'Promised to Come';
    contact.chat.push({ dir: 'out', msg: '✅ [System]: Marked as Promised to Come to Church.' });
  } else if (newStatus === 'attended') {
    label = 'Attended Church';
    contact.chat.push({ dir: 'out', msg: '🎉 [System]: Attendance confirmed. Came to Church!' });
  } else if (newStatus === 'absent') {
    label = 'Absent';
    contact.chat.push({ dir: 'out', msg: '❌ [System]: Marked as Did Not Come (Absent).' });
  }

  saveData();
  renderList();
  renderInsights();
  updateHeroStats();
  renderChatLog(contact);
  showToast(`Contact marked as: ${label}`);
};

// Helper: Parse raw CSV strings into contact objects
function parseCSV(text, chatbotPhone) {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  if (lines.length < 2) return [];

  // Parse headers & resolve column indexes
  const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase());
  let nameIndex = 0;
  let phoneIndex = 1;
  let volunteerIndex = 2;

  headers.forEach((header, idx) => {
    if (header.includes('name')) nameIndex = idx;
    else if (header.includes('phone') || header.includes('number') || header.includes('contact')) phoneIndex = idx;
    else if (header.includes('volunteer') || header.includes('assign') || header.includes('member')) volunteerIndex = idx;
  });

  const imported = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.replace(/"/g, '').trim());
    if (cols.length > Math.max(nameIndex, phoneIndex)) {
      const name = cols[nameIndex];
      const phone = normalizePhoneNumber(cols[phoneIndex]);
      const volunteer = cols[volunteerIndex] || 'None';
      if (name && phone) {
        imported.push({
          id: Date.now() + i,
          name: name,
          phone: phone,
          steps: [true, false, false],
          status: 'pending',
          volunteer: volunteer,
          chatbotPhone: chatbotPhone,
          chat: [{ dir: "out", msg: `[Chatbot ${chatbotPhone}]: Hi ${name}, it was great meeting you yesterday! We'd love to welcome you to our parish this season.` }]
        });
      }
    }
  }
  return imported;
}

// Helper: Generates and downloads the updated Excel/CSV sheet
function exportToCSV() {
  if (contacts.length === 0) {
    showToast('No contacts to export.');
    return;
  }

  let csvContent = 'Name,Phone Number,Assigned Volunteer,Chatbot Number,Status,Attendance Status\n';
  contacts.forEach(c => {
    let attendance = 'No Response';
    if (c.status === 'attended') attendance = 'Came';
    else if (c.status === 'absent') attendance = 'Did Not Come';
    else if (c.status === 'promised') attendance = 'Promised';
    
    csvContent += `"${c.name}","${c.phone}","${c.volunteer}","${c.chatbotPhone || '+234 803 000 0000'}","${c.status}","${attendance}"\n`;
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'reachout_outreach_followups.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('Spreadsheet exported successfully as CSV!');
}

// Helper: Render Sandbox chat bubbles
function renderChatLog(contact) {
  const log = document.getElementById('sim-chat-log');
  if (!log) return;
  log.innerHTML = '';

  contact.chat.forEach(msg => {
    const div = document.createElement('div');
    div.className = `chat-msg ${msg.dir}`;
    div.innerText = msg.msg;
    log.appendChild(div);
  });
  log.scrollTop = log.scrollHeight;
}

// Helper: Normalize Phone Number strings to E.164 standard
function normalizePhoneNumber(num) {
  let cleaned = num.replace(/\s+/g, '').replace(/[^0-9+]/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '+234' + cleaned.substring(1);
  } else if (cleaned.length === 10 && !cleaned.startsWith('+')) {
    cleaned = '+234' + cleaned;
  } else if (cleaned.startsWith('234') && !cleaned.startsWith('+')) {
    cleaned = '+' + cleaned;
  }
  return cleaned.replace(/(\+234)(\d{3})(\d{3})(\d{4})/, '$1 $2 $3 $4');
}

// Helper: Simple Local AI Classifier
function classifyIntent(text) {
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

// Helper: Simulated Incoming Reply Handler
function simulateReply() {
  const input = document.getElementById('sim-reply-input');
  if (!input || !input.value.trim() || selectedContactId === null) return;
  const text = input.value.trim();

  const contact = contacts.find(c => c.id === selectedContactId);
  if (!contact) return;

  contact.chat.push({ dir: 'in', msg: text });

  const result = classifyIntent(text);
  const botNumber = contact.chatbotPhone || '+234 803 000 0000';
  if (result === 'optout') {
    contact.status = 'optout';
    contact.volunteer = 'None';
    showToast('AI Classifier: Opt-out request detected. Sequence stopped.');
    contact.chat.push({ dir: 'out', msg: `⚠️ [Chatbot ${botNumber}]: Opted-out. You will no longer receive follow-up messages.` });
  } else if (result === 'promised') {
    contact.status = 'promised';
    showToast(`AI Classifier: Positive response. Handoff alert sent from chatbot ${botNumber}.`);
    setTimeout(() => {
      showToast(`💬 Handoff notification to ${contact.volunteer || 'General Pool'}: wa.me/${contact.phone.replace(/[^0-9]/g, '')}`);
    }, 1200);
  }

  input.value = '';
  saveData();
  renderChatLog(contact);
  renderList();
  renderInsights();
  updateHeroStats();
}

// Helper: Dispatch Toast Alert
function showToast(message) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerText = message;
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Start Application
window.onload = init;
