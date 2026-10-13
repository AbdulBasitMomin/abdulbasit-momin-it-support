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

/* The 18 orbs in the constellation. `note` shows on hover or tap. */
export const ORBS = [
  { label: 'Windows', ring: 0, note: 'Daily driver. Setup, configuration and the fault finding that follows.' },
  { label: 'Linux', ring: 0, note: 'Disk partitions and filesystems, practised in the NPower program.' },
  { label: 'macOS', ring: 0, note: 'Supported alongside Windows for mixed fleets.' },
  { label: 'Android / iOS', ring: 0, note: 'Mobile device support for the users who live on their phone.' },
  { label: 'TCP/IP', ring: 1, note: 'How the traffic actually moves, and where it stops moving.' },
  { label: 'DNS', ring: 1, note: 'It is usually DNS. Resolution checks come first.' },
  { label: 'DHCP', ring: 1, note: 'Address assignment, leases and the no network complaint.' },
  { label: 'VPN basics', ring: 1, note: 'Remote access troubleshooting for people working off site.' },
  { label: 'Wi-Fi', ring: 1, note: 'Signal, authentication and the difference between slow and broken.' },
  { label: 'Active Directory', ring: 2, note: 'User accounts, access and password resets. OpenLDAP too.' },
  { label: 'Microsoft 365', ring: 2, note: 'Accounts, licensing questions and the Office apps everyone depends on.' },
  { label: 'Jira', ring: 2, note: 'Triage, track and resolve. Four years of living in a ticket queue.' },
  { label: 'Confluence', ring: 2, note: 'Where the documentation lives so the answer is findable next time.' },
  { label: 'Remote Desktop', ring: 2, note: 'Fixing the machine without standing over it.' },
  { label: 'Power BI', ring: 3, note: 'Built 8 dashboards at Sarjen, improving reporting efficiency by about 20 percent.' },
  { label: 'SQL', ring: 3, note: 'Query the data instead of guessing at it.' },
  { label: 'Documentation', ring: 3, note: 'Replication steps, user guides and release notes people actually read.' },
  { label: 'Ticket triage', ring: 3, note: 'Decide what is urgent, say so clearly, escalate without drama.' },
  { label: 'ServiceNow', ring: 4, note: 'Enterprise ticketing. Familiar with it; Jira and Confluence are where the hours are.' },
  { label: 'Entra ID', ring: 4, note: 'Cloud identity. The same accounts and access work as Active Directory, which I know better.' },
  { label: 'Okta', ring: 4, note: 'Single sign on and access. Familiar with it, not yet day to day.' }
];

/* Short labels floating beside the road markers in the experience scene. */
export const MILESTONE_TAGS = ['Mercor', 'NPower Canada', 'BodyWellnessAI', 'Sarjen', 'B.E. IT'];

export const CERT_TAGS = ['CompTIA A+', 'Google IT Support', 'Google AI Essentials'];
