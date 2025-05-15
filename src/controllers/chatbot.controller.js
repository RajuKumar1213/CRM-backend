import asyncHandler from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import axios from 'axios';
import { Lead } from '../models/Lead.models.js';
import { User } from '../models/User.models.js';
import { FollowUp } from '../models/FollowUp.models.js';
import { Activity } from '../models/Activity.models.js';
import { CallLog } from '../models/CallLogs.models.js';
import { WhatsAppMessage } from '../models/WatsappMessage.models.js';
import { CompanySetting } from '../models/CompanySettings.models.js';

// Add your Deepseek API key here once you get access
const DEEPSEEK_API_KEY = process.env.DEPPSEEK_API_KEY;

// Add your Gemini API key here once you get access from Google AI Studio
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Knowledge base for the chatbot
const knowledgeBase = {
  features: {
    patterns: ['feature', 'capabilities', 'what can', 'functions'],
    response: 'Our CRM system offers several key features:\n1. Lead Management\n2. Follow-up Scheduling\n3. WhatsApp Integration\n4. Team Performance Tracking\n5. Theme Customization\nWhich feature would you like to know more about?'
  },
  leadManagement: {
    patterns: ['lead', 'leads', 'manage lead', 'track lead'],
    response: 'Our lead management system helps you track and organize potential customers. You can add new leads, update their status, and monitor their progress through the sales pipeline.'
  },
  followUps: {
    patterns: ['follow', 'schedule', 'reminder', 'following up'],
    response: 'The follow-up system allows you to schedule and track interactions with leads. You can set reminders, add notes, and never miss an important follow-up.'
  },
  whatsapp: {
    patterns: ['whatsapp', 'message', 'messaging', 'send'],
    response: 'Our WhatsApp integration enables direct communication with leads through WhatsApp. You can send messages, templates, and track conversations all within the CRM.'
  },
  performance: {
    patterns: ['performance', 'track', 'monitoring', 'stats', 'statistics'],
    response: 'The performance tracking feature provides insights into team and individual performance metrics, including lead conversion rates, follow-up effectiveness, and overall sales performance.'
  },
  theme: {
    patterns: ['theme', 'customize', 'dark mode', 'light mode'],
    response: 'You can customize the CRM interface with different themes, including dark and light modes, to suit your preferences and working environment.'
  }
};

// Utility to minimize and highlight key terms in the AI response
function minimizeAndHighlight(text) {
  if (!text) return '';
  // Only keep the first 2-3 sentences
  const sentences = text.split(/(?<=[.!?])\s+/).slice(0, 3).join(' ');
  // Highlight CRM and other key terms (case-insensitive, first occurrence only)
  let highlighted = sentences.replace(/\b(CRM)\b/i, '<mark>$1</mark>');
  highlighted = highlighted.replace(/\b(customer relationship management)\b/i, '<mark>$1</mark>');
  // Optionally, highlight other terms as needed
  return highlighted;
}

const handleChatRequest = asyncHandler(async (req, res) => {
  const { message } = req.body;

  if (!message?.trim()) {
    throw new ApiError(400, "Message is required");
  }

  try {
    const userMessage = message.toLowerCase();
    let bestResponse = null;
    let maxMatches = 0;

    // 1. Specific lead info extraction (priority over knowledge base)
    // e.g., "show me information about the lead Mr vikash", "lead details for John Doe"
    const leadInfoRegex = /(?:lead|about the lead|details for lead|info(?:rmation)? about lead)\s+([\w .'-]+)/i;
    const leadMatch = message.match(leadInfoRegex);
    if (leadMatch && leadMatch[1]) {
      // Use the full extracted name for searching
      const leadName = leadMatch[1].trim();
      // Try exact (case-insensitive) match first
      let lead = await Lead.findOne({ name: { $regex: `^${leadName}$`, $options: 'i' } }).lean();
      // If not found, try partial match (phrase, not split into words)
      if (!lead) {
        lead = await Lead.findOne({ name: { $regex: leadName, $options: 'i' } }).lean();
      }
      if (lead) {
        // Format all available fields for the lead
        let details = `<b>Lead Information:</b><br>`;
        for (const [key, value] of Object.entries(lead)) {
          if (['_id', '__v'].includes(key)) continue;
          details += `${key.charAt(0).toUpperCase() + key.slice(1)}: <b>${value || 'N/A'}</b><br>`;
        }
        bestResponse = details;
      } else {
        bestResponse = `Sorry, I couldn't find a lead named <b>${leadName}</b>.`;
      }
    }

    // 2. Specific employee info extraction (priority over knowledge base)
    // e.g., "tell me about your employee Rajiv", "employee details for Jane"
    const employeeInfoRegex = /(?:employee|about (?:the|your) employee|details for employee|info(?:rmation)? about employee)\s+([\w .'-]+)/i;
    const employeeMatch = message.match(employeeInfoRegex);
    if (!bestResponse && employeeMatch && employeeMatch[1]) {
      // Use the full extracted name for searching
      const employeeName = employeeMatch[1].trim();
      // Try exact (case-insensitive) match first
      let employee = await User.findOne({ name: { $regex: `^${employeeName}$`, $options: 'i' } }).lean();
      // If not found, try partial match (phrase, not split into words)
      if (!employee) {
        employee = await User.findOne({ name: { $regex: employeeName, $options: 'i' } }).lean();
      }
      if (employee) {
        // Format all available fields for the employee, but hide sensitive info
        let details = `<b>Employee Information:</b><br>`;
        for (const [key, value] of Object.entries(employee)) {
          // Skip sensitive, internal, or non-useful fields
          if (['_id', '__v', 'password', 'createdAt', 'updatedAt', 'refreshToken'].includes(key)) continue;
          details += `${key.charAt(0).toUpperCase() + key.slice(1)}: <b>${value || 'N/A'}</b><br>`;
        }
        bestResponse = details;
      } else {
        bestResponse = `Sorry, I couldn't find an employee named <b>${employeeName}</b>.`;
      }
    }

    // 3. Check for less specific lead queries that still need full details
    // e.g., "tell me about the lead vikash", "show lead vikash"
    if (!bestResponse) {
      const leadQueryRegex = /(?:about|show|tell|get|find).*?\b(lead|leads)\b\s+([\w .'-]+)/i;
      const specificLeadMatch = message.match(leadQueryRegex);
      
      if (specificLeadMatch && specificLeadMatch[2]) {
        const leadName = specificLeadMatch[2].trim();
        // Try exact (case-insensitive) match first
        let lead = await Lead.findOne({ name: { $regex: `^${leadName}$`, $options: 'i' } }).lean();
        // If not found, try partial match
        if (!lead) {
          lead = await Lead.findOne({ name: { $regex: leadName, $options: 'i' } }).lean();
        }
        
        if (lead) {
          // Format all available fields for the lead
          let details = `<b>Lead Information:</b><br>`;
          for (const [key, value] of Object.entries(lead)) {
            if (['_id', '__v'].includes(key)) continue;
            details += `${key.charAt(0).toUpperCase() + key.slice(1)}: <b>${value || 'N/A'}</b><br>`;
          }
          bestResponse = details;
        }
      }
    }
    
    // Remove the old code that splits lead names and always returns a list
    /*
    // --- NEW: Check for specific lead queries first ---
    // e.g., "show me information about the lead Mr vikash", "details for lead John Doe"
    const leadQueryRegex = /(?:about|information|details|show|find|tell me|who is|show me|give me|display|fetch)[^\n]{0,40}?lead\s+([\w .'-]+)/i;
    let specificLeadMatch = message.match(leadQueryRegex);
    let probableLeadName = null;
    if (specificLeadMatch && specificLeadMatch[1]) {
      probableLeadName = specificLeadMatch[1].trim();
    } else {
      // fallback: try to extract name after 'lead' if present
      const afterLead = message.match(/lead\s+([\w .'-]+)/i);
      if (afterLead && afterLead[1]) {
        probableLeadName = afterLead[1].trim();
      }
    }
    if (probableLeadName) {
      // Try to find a lead with a similar name (case-insensitive, partial match)
      const leadRegex = new RegExp(probableLeadName.split(/\s+/).join('|'), 'i');
      const leads = await Lead.find({ name: leadRegex }).limit(3).lean();
      if (leads.length > 0) {
        bestResponse = `Found ${leads.length} matching lead(s):<br>` + leads.map(l => `• <b>${l.name}</b> (${l.email || l.phone || 'no contact'})`).join('<br>');
      }
    }
    // --- END NEW ---
    */
    
    // 4. Check for general employee queries similar to lead queries
    if (!bestResponse) {
      const employeeQueryRegex = /(?:about|show|tell|get|find).*?\b(employee|employees|staff|team member)\b\s+([\w .'-]+)/i;
      const specificEmployeeMatch = message.match(employeeQueryRegex);
      
      if (specificEmployeeMatch && specificEmployeeMatch[2]) {
        const employeeName = specificEmployeeMatch[2].trim();
        // Try exact (case-insensitive) match first
        let employee = await User.findOne({ name: { $regex: `^${employeeName}$`, $options: 'i' } }).lean();
        // If not found, try partial match
        if (!employee) {
          employee = await User.findOne({ name: { $regex: employeeName, $options: 'i' } }).lean();
        }
        
        if (employee) {
          // Format all available fields for the employee, but hide sensitive info
          let details = `<b>Employee Information:</b><br>`;
          for (const [key, value] of Object.entries(employee)) {
            // Skip sensitive, internal, or non-useful fields
            if (['_id', '__v', 'password', 'createdAt', 'updatedAt', 'refreshToken'].includes(key)) continue;
            details += `${key.charAt(0).toUpperCase() + key.slice(1)}: <b>${value || 'N/A'}</b><br>`;
          }
          bestResponse = details;
        }
      }
    }
    
    // Dynamic: Lead count
    if (!bestResponse && /how many leads|number of leads|total leads|leads are there/.test(userMessage)) {
      const leadCount = await Lead.countDocuments();
      bestResponse = `There are <b>${leadCount}</b> leads in the system.`;
    }
    // Dynamic: Employee count
    else if (!bestResponse && /how many employees|number of employees|total employees|employees in your company/.test(userMessage)) {
      const employeeCount = await User.countDocuments({ role: /employee/i });
      bestResponse = `There are <b>${employeeCount}</b> employees in the company.`;
    }
    // Company information: owner and company name
    else if (!bestResponse && /who is (?:the|your) owner|owner of (?:the|this) company|who owns/.test(userMessage)) {
      // Try to find the admin user (assuming owner is an admin)
      const owner = await User.findOne({ role: 'admin' }).lean();
      if (owner) {
        bestResponse = `The owner of the company is <b>${owner.name}</b>. You can reach them at ${owner.email}.`;
      } else {
        bestResponse = "I don't have information about the company owner in my records.";
      }
    }
    else if (!bestResponse && /what is (?:the|your) company name|company name|name of (?:the|this|your) company|what company is this/.test(userMessage)) {
      // Get company name from settings
      const companySetting = await CompanySetting.findOne().sort({ createdAt: 1 }).lean();
      if (companySetting && companySetting.companyName) {
        bestResponse = `The name of the company is <b>${companySetting.companyName}</b>.`;
      } else {
        bestResponse = "I don't have the company name in my records.";
      }
    }    // Show all employees - simpler pattern for direct queries
    else if (!bestResponse && 
      (/(?:show|list|get|display|tell about) (?:me |us )?(?:the |a |all )?(?:list of |all )?(?:employees|staff|team|workers|personnel|users)/i.test(userMessage) || 
       /^(?:employees|staff|team|personnel|workers|users|members)$/i.test(userMessage) ||
       /^(?:show|list|give|get) (?:me|us)? (?:the|a)? (?:list|details|info|information) (?:of|about) (?:the|all|our)? (?:employees|staff|team|members|workers|personnel|users)$/i.test(userMessage) ||
       // Additional catch-all patterns
       /show.*?employees/i.test(userMessage) || 
       /employees.*?list/i.test(userMessage) ||
       userMessage.includes('employee') && userMessage.includes('list'))
    ) {
      console.log("Employee list query matched:", userMessage);
      // Include both employees and admins, but mark admins distinctly
      const employees = await User.find({role : "employee"}).select('name email phone role').lean();
      if (employees && employees.length > 0) {
        bestResponse = `<b>All Team Members (${employees.length}):</b><br>`;
        employees.forEach(emp => {
          const roleLabel = emp.role === 'admin' ? 'Admin/Owner' : 'Employee';
          bestResponse += `• <b>${emp.name}</b> - ${roleLabel} (${emp.email || emp.phone || 'no contact'})<br>`;
        });
      } else {
        bestResponse = "I couldn't find any team members in the system.";
      }
    }
    // First try to find a match in our local knowledge base
    else if (!bestResponse) {
      for (const [key, data] of Object.entries(knowledgeBase)) {
        const matches = data.patterns.filter(pattern => 
          userMessage.includes(pattern.toLowerCase())
        ).length;

        if (matches > maxMatches) {
          maxMatches = matches;
          bestResponse = data.response;
        }
      }

      // If no match found in local knowledge base and Deepseek API key is available, use Deepseek
      if (!bestResponse && DEEPSEEK_API_KEY) {
        let deepseekFailed = false;
        try {
          const deepseekResponse = await axios.post('https://api.deepseek.com/v1/chat/completions', {
            model: "deepseek-chat",
            messages: [
              {
                role: "system",
                content: "You are a CRM assistant. Help users with CRM-related questions and provide concise, helpful responses."
              },
              {
                role: "user",
                content: message
              }
            ],
            temperature: 0.7,
            max_tokens: 150
          }, {
            headers: {
              'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
              'Content-Type': 'application/json'
            }
          });
          bestResponse = deepseekResponse.data.choices[0].message.content;
          bestResponse = minimizeAndHighlight(bestResponse);
        } catch (apiError) {
          console.error("Deepseek API Error:", apiError.message);
          // If Deepseek returns 402, try Gemini if available
          if (apiError.response && apiError.response.status === 402 && GEMINI_API_KEY) {
            try {
              const geminiResponse = await axios.post(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`,
                {
                  contents: [
                    {
                      role: "user",
                      parts: [
                        { text: message }
                      ]
                    }
                  ]
                },
                {
                  headers: {
                    'Content-Type': 'application/json'
                  }
                }
              );
              bestResponse = geminiResponse.data.candidates?.[0]?.content?.parts?.[0]?.text ||
                "I'm here to help with our CRM system. You can ask about:\n- Features and capabilities\n- Lead management\n- Follow-up scheduling\n- WhatsApp integration\n- Performance tracking\n- Theme customization\nWhat would you like to know more about?";
              bestResponse = minimizeAndHighlight(bestResponse);
            } catch (geminiError) {
              console.error("Gemini API Error:", geminiError.message);
              bestResponse = "I'm here to help with our CRM system. You can ask about:\n- Features and capabilities\n- Lead management\n- Follow-up scheduling\n- WhatsApp integration\n- Performance tracking\n- Theme customization\nWhat would you like to know more about?";
            }
          } else {
            bestResponse = "I'm here to help with our CRM system. You can ask about:\n- Features and capabilities\n- Lead management\n- Follow-up scheduling\n- WhatsApp integration\n- Performance tracking\n- Theme customization\nWhat would you like to know more about?";
          }
        }
      } else if (!bestResponse && GEMINI_API_KEY) {
        // If no match found in local knowledge base and Gemini API key is available, use Gemini
        try {
          const geminiResponse = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
              contents: [
                {
                  role: "user",
                  parts: [
                    { text: message }
                  ]
                }
              ]
            },
            {
              headers: {
                'Content-Type': 'application/json'
              }
            }
          );
          bestResponse = geminiResponse.data.candidates?.[0]?.content?.parts?.[0]?.text ||
            "I'm here to help with our CRM system. You can ask about:\n- Features and capabilities\n- Lead management\n- Follow-up scheduling\n- WhatsApp integration\n- Performance tracking\n- Theme customization\nWhat would you like to know more about?";
          bestResponse = minimizeAndHighlight(bestResponse);
        } catch (apiError) {
          console.error("Gemini API Error:", apiError.message);
          // Fallback to default response if API call fails
          bestResponse = "I'm here to help with our CRM system. You can ask about:\n- Features and capabilities\n- Lead management\n- Follow-up scheduling\n- WhatsApp integration\n- Performance tracking\n- Theme customization\nWhat would you like to know more about?";
        }
      } else if (!bestResponse) {
        // Default response if no match found and no Deepseek or Gemini API key available
        bestResponse = "I'm here to help with our CRM system. You can ask about:\n- Features and capabilities\n- Lead management\n- Follow-up scheduling\n- WhatsApp integration\n- Performance tracking\n- Theme customization\nWhat would you like to know more about?";
      }
    }

    // Fallback: General database search if no match found
    if (!bestResponse) {
      // Extract keywords (very basic: split by space, remove stopwords)
      const stopwords = ['the','is','in','at','of','a','an','to','for','on','with','and','or','by','from','as','are','was','were','be','has','have','had','do','does','did','can','could','should','would','will','may','might','must','shall','this','that','these','those','it','its','their','my','your','our','his','her','him','them','us','you','i'];
      const keywords = userMessage.split(/\W+/).filter(word => word && !stopwords.includes(word));
      if (keywords.length > 0) {
        const regex = new RegExp(keywords.join('|'), 'i');
        // Search Leads
        const leads = await Lead.find({
          $or: [
            { name: regex },
            { email: regex },
            { phone: regex },
            { product: regex },
            { notes: regex }
          ]
        }).limit(3).lean();
        if (leads.length > 0) {
          bestResponse = `Found ${leads.length} matching lead(s):<br>` + leads.map(l => `• <b>${l.name}</b> (${l.email || l.phone || 'no contact'})`).join('<br>');
        }
        // Search Users
        if (!bestResponse) {
          const users = await User.find({
            $or: [
              { name: regex },
              { email: regex }
            ]
          }).limit(3).lean();
          if (users.length > 0) {
            bestResponse = `Found ${users.length} matching user(s):<br>` + users.map(u => `• <b>${u.name}</b> (${u.email})`).join('<br>');
          }
        }
        // Search FollowUps
        if (!bestResponse) {
          const followups = await FollowUp.find({ notes: regex }).limit(3).lean();
          if (followups.length > 0) {
            bestResponse = `Found ${followups.length} matching follow-up(s) (by notes).`;
          }
        }
        // Search Activities
        if (!bestResponse) {
          const activities = await Activity.find({ notes: regex }).limit(3).lean();
          if (activities.length > 0) {
            bestResponse = `Found ${activities.length} matching activity(ies) (by notes).`;
          }
        }
        // Search WhatsApp Messages
        if (!bestResponse) {
          const messages = await WhatsAppMessage.find({ content: regex }).limit(3).lean();
          if (messages.length > 0) {
            bestResponse = `Found ${messages.length} matching WhatsApp message(s).`;
          }
        }
        // Search Call Logs
        if (!bestResponse) {
          const calls = await CallLog.find({ description: regex }).limit(3).lean();
          if (calls.length > 0) {
            bestResponse = `Found ${calls.length} matching call log(s) (by description).`;
          }
        }
      }
    }

    res.json(new ApiResponse(
      200,
      { response: bestResponse },
      "Chatbot response generated successfully"
    ));
  } catch (error) {
    console.error("Chatbot Error:", error.message);
    
    const errorResponse = "I apologize, but I'm having trouble processing your request. Please try asking your question again, or contact support if the issue persists.";
    
    res.json(new ApiResponse(
      200,
      { response: errorResponse },
      "Fallback response sent successfully"
    ));
  }
});

export { handleChatRequest };
