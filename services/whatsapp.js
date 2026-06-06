const axios = require('axios');
require('dotenv').config();

const API_VERSION = process.env.META_API_VERSION || 'v18.0';
const PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID;
const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;

const BASE_URL = `https://graph.facebook.com/${API_VERSION}/${PHONE_NUMBER_ID}/messages`;

/**
 * sendTemplateMessage
 * Dispatches an approved template message to a contact.
 * Meta requires pre-approved templates for business-initiated conversations.
 * 
 * @param {string} to - Contact's E.164 phone number (e.g., '+2348031234567')
 * @param {string} templateName - Approved Meta template name
 * @param {string} languageCode - Locale identifier (e.g. 'en_US')
 * @param {Array} parameters - Array of dynamic values for the template placeholders (e.g., [{{1}}, {{2}}])
 */
async function sendTemplateMessage(to, templateName, languageCode = 'en', parameters = []) {
  try {
    const formattedParams = parameters.map(p => ({
      type: 'text',
      text: p.toString()
    }));

    const response = await axios.post(
      BASE_URL,
      {
        messaging_product: 'whatsapp',
        to: to.replace('+', ''), // Meta requires numbers without the '+' prefix
        type: 'template',
        template: {
          name: templateName,
          language: {
            code: languageCode
          },
          components: formattedParams.length > 0 ? [
            {
              type: 'body',
              parameters: formattedParams
            }
          ] : []
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(`WhatsApp template message '${templateName}' sent to ${to}. Msg ID: ${response.data.messages[0].id}`);
    return response.data;
  } catch (error) {
    console.error(`Error sending template message to ${to}:`, error.response ? error.response.data : error.message);
    throw error;
  }
}

/**
 * sendTextMessage
 * Sends a standard text message. Can only be used within the 24-hour customer service window.
 * 
 * @param {string} to - E.164 phone number
 * @param {string} textBody - Text content
 */
async function sendTextMessage(to, textBody) {
  try {
    const response = await axios.post(
      BASE_URL,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: to.replace('+', ''),
        type: 'text',
        text: {
          preview_url: false,
          body: textBody
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(`WhatsApp text message sent to ${to}. Msg ID: ${response.data.messages[0].id}`);
    return response.data;
  } catch (error) {
    console.error(`Error sending text message to ${to}:`, error.response ? error.response.data : error.message);
    throw error;
  }
}

module.exports = {
  sendTemplateMessage,
  sendTextMessage
};
