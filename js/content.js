/* Single source of truth for skill data.
   Every entry below comes straight off the resume. Nothing added. */

export const SKILL_GROUPS = [
  { slot: 'sg-os', items: ['Windows', 'macOS', 'Linux', 'Android', 'iOS'] },
  { slot: 'sg-net', items: ['TCP/IP', 'DNS', 'DHCP', 'VPN basics', 'Wi-Fi troubleshooting'] },
  { slot: 'sg-tools', items: ['Microsoft 365', 'Google Workspace', 'Jira', 'Confluence', 'Active Directory', 'Remote Desktop'] },
  { slot: 'sg-support', items: ['Hardware troubleshooting', 'Software installation', 'Printer support', 'Ticket triaging', 'User account management', 'Documentation'] },
  { slot: 'sg-data', items: ['SQL', 'Power BI', 'Excel', 'Python (beginner)'] },
  { slot: 'sg-soft', items: ['Problem solving', 'Critical thinking', 'Clear communication', 'Conflict resolution', 'Time management', 'Detail oriented'] },
  { slot: 'sg-familiar', items: ['ServiceNow', 'Entra ID (Azure AD)', 'Okta'] }
];


/* Short labels floating beside the road markers in the experience scene. */
export const MILESTONE_TAGS = ['Mercor', 'NPower Canada', 'BodyWellnessAI', 'Sarjen', 'B.E. IT'];

export const CERT_TAGS = ['CompTIA A+', 'Google IT Support', 'Google AI Essentials'];
