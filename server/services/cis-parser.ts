import { db } from "../db";
import { cisControls, cisSafeguards } from "@shared/schema";
import { eq } from "drizzle-orm";

interface CISSafeguard {
  id: string;
  name: string;
  description: string;
  implementationGroup: number;
  assetType?: string;
  securityFunction?: string;
}

interface CISControl {
  id: string;
  name: string;
  description: string;
  assetType?: string;
  securityFunction?: string;
  safeguards: CISSafeguard[];
}

const CIS_CONTROLS_V8: CISControl[] = [
  {
    id: "CIS.1",
    name: "Inventory and Control of Enterprise Assets",
    description: "Actively manage all enterprise assets connected to the infrastructure physically, virtually, remotely, and those within cloud environments to accurately know the totality of assets that need to be monitored and protected.",
    assetType: "Devices",
    securityFunction: "Identify",
    safeguards: [
      { id: "1.1", name: "Establish and Maintain Detailed Enterprise Asset Inventory", description: "Establish and maintain an accurate, detailed, and up-to-date inventory of all enterprise assets with the potential to store or process data.", implementationGroup: 1, assetType: "Devices", securityFunction: "Identify" },
      { id: "1.2", name: "Address Unauthorized Assets", description: "Ensure that a process exists to address unauthorized assets on a weekly basis.", implementationGroup: 1, assetType: "Devices", securityFunction: "Respond" },
      { id: "1.3", name: "Utilize an Active Discovery Tool", description: "Utilize an active discovery tool to identify assets connected to the enterprise network.", implementationGroup: 2, assetType: "Devices", securityFunction: "Detect" },
      { id: "1.4", name: "Use Dynamic Host Configuration Protocol (DHCP) Logging", description: "Use DHCP logging on all DHCP servers or Internet Protocol (IP) address management tools to update the enterprise asset inventory.", implementationGroup: 2, assetType: "Devices", securityFunction: "Identify" },
      { id: "1.5", name: "Use a Passive Asset Discovery Tool", description: "Use a passive discovery tool to identify assets connected to the enterprise network.", implementationGroup: 3, assetType: "Devices", securityFunction: "Detect" },
    ],
  },
  {
    id: "CIS.2",
    name: "Inventory and Control of Software Assets",
    description: "Actively manage all software on the network so that only authorized software is installed and can execute, and that unauthorized and unmanaged software is found and prevented from installation or execution.",
    assetType: "Applications",
    securityFunction: "Identify",
    safeguards: [
      { id: "2.1", name: "Establish and Maintain a Software Inventory", description: "Establish and maintain a detailed inventory of all licensed software installed on enterprise assets.", implementationGroup: 1, assetType: "Applications", securityFunction: "Identify" },
      { id: "2.2", name: "Ensure Authorized Software is Currently Supported", description: "Ensure that only currently supported software is designated as authorized in the software inventory.", implementationGroup: 1, assetType: "Applications", securityFunction: "Identify" },
      { id: "2.3", name: "Address Unauthorized Software", description: "Ensure that unauthorized software is either removed or the inventory is updated in a timely manner.", implementationGroup: 1, assetType: "Applications", securityFunction: "Respond" },
      { id: "2.4", name: "Utilize Automated Software Inventory Tools", description: "Utilize software inventory tools throughout the enterprise to automate the discovery and documentation of installed software.", implementationGroup: 2, assetType: "Applications", securityFunction: "Detect" },
      { id: "2.5", name: "Allowlist Authorized Software", description: "Use technical controls such as application allowlisting to ensure that only authorized software can execute or be accessed.", implementationGroup: 2, assetType: "Applications", securityFunction: "Protect" },
      { id: "2.6", name: "Allowlist Authorized Libraries", description: "Use technical controls to ensure that only authorized software libraries can load into a system process.", implementationGroup: 2, assetType: "Applications", securityFunction: "Protect" },
      { id: "2.7", name: "Allowlist Authorized Scripts", description: "Use technical controls such as digital signatures and version control to ensure that only authorized scripts can execute.", implementationGroup: 3, assetType: "Applications", securityFunction: "Protect" },
    ],
  },
  {
    id: "CIS.3",
    name: "Data Protection",
    description: "Develop processes and technical controls to identify, classify, securely handle, retain, and dispose of data.",
    assetType: "Data",
    securityFunction: "Protect",
    safeguards: [
      { id: "3.1", name: "Establish and Maintain a Data Management Process", description: "Establish and maintain a data management process including data sensitivity levels, data owner, handling of data, data retention limits, and disposal requirements.", implementationGroup: 1, assetType: "Data", securityFunction: "Identify" },
      { id: "3.2", name: "Establish and Maintain a Data Inventory", description: "Establish and maintain a data inventory based on the enterprise data management process.", implementationGroup: 1, assetType: "Data", securityFunction: "Identify" },
      { id: "3.3", name: "Configure Data Access Control Lists", description: "Configure data access control lists based on a user's need to know.", implementationGroup: 1, assetType: "Data", securityFunction: "Protect" },
      { id: "3.4", name: "Enforce Data Retention", description: "Retain data according to the enterprise data management process. Data retention must include both minimum and maximum timelines.", implementationGroup: 1, assetType: "Data", securityFunction: "Protect" },
      { id: "3.5", name: "Securely Dispose of Data", description: "Securely dispose of data as outlined in the enterprise data management process.", implementationGroup: 1, assetType: "Data", securityFunction: "Protect" },
      { id: "3.6", name: "Encrypt Data on End-User Devices", description: "Encrypt data on end-user devices containing sensitive data.", implementationGroup: 1, assetType: "Devices", securityFunction: "Protect" },
    ],
  },
  {
    id: "CIS.4",
    name: "Secure Configuration of Enterprise Assets and Software",
    description: "Establish and maintain the secure configuration of enterprise assets and software.",
    assetType: "Applications",
    securityFunction: "Protect",
    safeguards: [
      { id: "4.1", name: "Establish and Maintain a Secure Configuration Process", description: "Establish and maintain a secure configuration process for enterprise assets and software.", implementationGroup: 1, assetType: "Applications", securityFunction: "Protect" },
      { id: "4.2", name: "Establish and Maintain a Secure Configuration Process for Network Infrastructure", description: "Establish and maintain a secure configuration process for network devices.", implementationGroup: 1, assetType: "Network", securityFunction: "Protect" },
      { id: "4.3", name: "Configure Automatic Session Locking on Enterprise Assets", description: "Configure automatic session locking on enterprise assets after a defined period of inactivity.", implementationGroup: 1, assetType: "Users", securityFunction: "Protect" },
      { id: "4.4", name: "Implement and Manage a Firewall on Servers", description: "Implement and manage a firewall on servers where supported.", implementationGroup: 1, assetType: "Devices", securityFunction: "Protect" },
      { id: "4.5", name: "Implement and Manage a Firewall on End-User Devices", description: "Implement and manage a host-based firewall or port-filtering tool on end-user devices.", implementationGroup: 1, assetType: "Devices", securityFunction: "Protect" },
      { id: "4.6", name: "Securely Manage Enterprise Assets and Software", description: "Securely manage enterprise assets and software. Example implementations include managing configuration through version-controlled-infrastructure-as-code.", implementationGroup: 1, assetType: "Devices", securityFunction: "Protect" },
    ],
  },
  {
    id: "CIS.5",
    name: "Account Management",
    description: "Use processes and tools to assign and manage authorization to credentials for user accounts.",
    assetType: "Users",
    securityFunction: "Identify",
    safeguards: [
      { id: "5.1", name: "Establish and Maintain an Inventory of Accounts", description: "Establish and maintain an inventory of all accounts managed in the enterprise.", implementationGroup: 1, assetType: "Users", securityFunction: "Identify" },
      { id: "5.2", name: "Use Unique Passwords", description: "Use unique passwords for all enterprise assets. Best practice implementation includes at minimum an 8-character password for accounts using MFA.", implementationGroup: 1, assetType: "Users", securityFunction: "Protect" },
      { id: "5.3", name: "Disable Dormant Accounts", description: "Delete or disable any dormant accounts after a period of 45 days of inactivity.", implementationGroup: 1, assetType: "Users", securityFunction: "Respond" },
      { id: "5.4", name: "Restrict Administrator Privileges to Dedicated Administrator Accounts", description: "Restrict administrator privileges to dedicated administrator accounts on enterprise assets.", implementationGroup: 1, assetType: "Users", securityFunction: "Protect" },
    ],
  },
  {
    id: "CIS.6",
    name: "Access Control Management",
    description: "Use processes and tools to create, assign, manage, and revoke access credentials and privileges for user, administrator, and service accounts.",
    assetType: "Users",
    securityFunction: "Protect",
    safeguards: [
      { id: "6.1", name: "Establish an Access Granting Process", description: "Establish and follow a process to grant access to enterprise assets and software.", implementationGroup: 1, assetType: "Users", securityFunction: "Protect" },
      { id: "6.2", name: "Establish an Access Revoking Process", description: "Establish and follow a process to revoke access to enterprise assets and software through disabling accounts.", implementationGroup: 1, assetType: "Users", securityFunction: "Protect" },
      { id: "6.3", name: "Require MFA for Externally-Exposed Applications", description: "Require all externally-exposed enterprise or third-party applications to enforce MFA.", implementationGroup: 1, assetType: "Users", securityFunction: "Protect" },
      { id: "6.4", name: "Require MFA for Remote Network Access", description: "Require MFA for remote network access.", implementationGroup: 1, assetType: "Users", securityFunction: "Protect" },
      { id: "6.5", name: "Require MFA for Administrative Access", description: "Require MFA for all administrative access accounts.", implementationGroup: 1, assetType: "Users", securityFunction: "Protect" },
    ],
  },
  {
    id: "CIS.7",
    name: "Continuous Vulnerability Management",
    description: "Develop a plan to continuously assess and track vulnerabilities on all enterprise assets.",
    assetType: "Applications",
    securityFunction: "Protect",
    safeguards: [
      { id: "7.1", name: "Establish and Maintain a Vulnerability Management Process", description: "Establish and maintain a documented vulnerability management process for enterprise assets.", implementationGroup: 1, assetType: "Applications", securityFunction: "Protect" },
      { id: "7.2", name: "Establish and Maintain a Remediation Process", description: "Establish and maintain a risk-based remediation strategy documented in a remediation process.", implementationGroup: 1, assetType: "Applications", securityFunction: "Respond" },
      { id: "7.3", name: "Perform Automated Operating System Patch Management", description: "Perform operating system updates on enterprise assets through automated patch management on a monthly basis.", implementationGroup: 1, assetType: "Applications", securityFunction: "Protect" },
      { id: "7.4", name: "Perform Automated Application Patch Management", description: "Perform application updates on enterprise assets through automated patch management on a monthly basis.", implementationGroup: 1, assetType: "Applications", securityFunction: "Protect" },
    ],
  },
  {
    id: "CIS.8",
    name: "Audit Log Management",
    description: "Collect, alert, review, and retain audit logs of events that could help detect, understand, or recover from an attack.",
    assetType: "Network",
    securityFunction: "Detect",
    safeguards: [
      { id: "8.1", name: "Establish and Maintain an Audit Log Management Process", description: "Establish and maintain an audit log management process that defines the enterprise's logging requirements.", implementationGroup: 1, assetType: "Network", securityFunction: "Protect" },
      { id: "8.2", name: "Collect Audit Logs", description: "Collect audit logs. Ensure that logging per the enterprise audit log management process is enforced on all enterprise assets.", implementationGroup: 1, assetType: "Network", securityFunction: "Detect" },
      { id: "8.3", name: "Ensure Adequate Audit Log Storage", description: "Ensure that logging destinations maintain adequate storage to comply with the enterprise's audit log management process.", implementationGroup: 1, assetType: "Network", securityFunction: "Protect" },
    ],
  },
  {
    id: "CIS.9",
    name: "Email and Web Browser Protections",
    description: "Improve protections and detections of threats from email and web vectors.",
    assetType: "Applications",
    securityFunction: "Protect",
    safeguards: [
      { id: "9.1", name: "Ensure Use of Only Fully Supported Browsers and Email Clients", description: "Ensure only fully supported browsers and email clients are allowed to execute in the enterprise.", implementationGroup: 1, assetType: "Applications", securityFunction: "Protect" },
      { id: "9.2", name: "Use DNS Filtering Services", description: "Use DNS filtering services on all enterprise assets to block access to known malicious domains.", implementationGroup: 1, assetType: "Network", securityFunction: "Protect" },
    ],
  },
  {
    id: "CIS.10",
    name: "Malware Defenses",
    description: "Prevent or control the installation, spread, and execution of malicious applications, code, or scripts on enterprise assets.",
    assetType: "Devices",
    securityFunction: "Detect",
    safeguards: [
      { id: "10.1", name: "Deploy and Maintain Anti-Malware Software", description: "Deploy and maintain anti-malware software on all enterprise assets.", implementationGroup: 1, assetType: "Devices", securityFunction: "Detect" },
      { id: "10.2", name: "Configure Automatic Anti-Malware Signature Updates", description: "Configure automatic updates for anti-malware signature files on all enterprise assets.", implementationGroup: 1, assetType: "Devices", securityFunction: "Protect" },
      { id: "10.3", name: "Disable Autorun and Autoplay for Removable Media", description: "Disable autorun and autoplay auto-execute functionality for removable media.", implementationGroup: 1, assetType: "Devices", securityFunction: "Protect" },
    ],
  },
  {
    id: "CIS.11",
    name: "Data Recovery",
    description: "Establish and maintain data recovery practices sufficient to restore in-scope enterprise assets to a pre-incident and trusted state.",
    assetType: "Data",
    securityFunction: "Recover",
    safeguards: [
      { id: "11.1", name: "Establish and Maintain a Data Recovery Process", description: "Establish and maintain a data recovery process.", implementationGroup: 1, assetType: "Data", securityFunction: "Recover" },
      { id: "11.2", name: "Perform Automated Backups", description: "Perform automated backups of in-scope enterprise assets.", implementationGroup: 1, assetType: "Data", securityFunction: "Recover" },
      { id: "11.3", name: "Protect Recovery Data", description: "Protect recovery data with equivalent controls to the original data.", implementationGroup: 1, assetType: "Data", securityFunction: "Protect" },
      { id: "11.4", name: "Establish and Maintain an Isolated Instance of Recovery Data", description: "Establish and maintain an isolated instance of recovery data using versioned backups.", implementationGroup: 1, assetType: "Data", securityFunction: "Recover" },
    ],
  },
  {
    id: "CIS.12",
    name: "Network Infrastructure Management",
    description: "Establish and maintain the secure configuration and management of network infrastructure.",
    assetType: "Network",
    securityFunction: "Protect",
    safeguards: [
      { id: "12.1", name: "Ensure Network Infrastructure is Up-to-Date", description: "Ensure network infrastructure is kept up-to-date.", implementationGroup: 1, assetType: "Network", securityFunction: "Protect" },
      { id: "12.2", name: "Establish and Maintain a Secure Network Architecture", description: "Establish and maintain a secure network architecture.", implementationGroup: 2, assetType: "Network", securityFunction: "Protect" },
      { id: "12.3", name: "Securely Manage Network Infrastructure", description: "Securely manage network infrastructure through standardized and approved practices.", implementationGroup: 2, assetType: "Network", securityFunction: "Protect" },
    ],
  },
  {
    id: "CIS.13",
    name: "Network Monitoring and Defense",
    description: "Operate processes and tooling to establish and maintain comprehensive network monitoring and defense against security threats.",
    assetType: "Network",
    securityFunction: "Detect",
    safeguards: [
      { id: "13.1", name: "Centralize Security Event Alerting", description: "Centralize security event alerting across enterprise assets.", implementationGroup: 2, assetType: "Network", securityFunction: "Detect" },
      { id: "13.2", name: "Deploy a Host-Based Intrusion Detection Solution", description: "Deploy a host-based intrusion detection solution on enterprise assets.", implementationGroup: 2, assetType: "Devices", securityFunction: "Detect" },
      { id: "13.3", name: "Deploy a Network Intrusion Detection Solution", description: "Deploy a network intrusion detection solution on enterprise assets.", implementationGroup: 2, assetType: "Network", securityFunction: "Detect" },
    ],
  },
  {
    id: "CIS.14",
    name: "Security Awareness and Skills Training",
    description: "Establish and maintain a security awareness program to influence behavior among the workforce.",
    assetType: "Users",
    securityFunction: "Protect",
    safeguards: [
      { id: "14.1", name: "Establish and Maintain a Security Awareness Program", description: "Establish and maintain a security awareness program for the entire workforce.", implementationGroup: 1, assetType: "Users", securityFunction: "Protect" },
      { id: "14.2", name: "Train Workforce Members to Recognize Social Engineering Attacks", description: "Train workforce members to recognize social engineering attacks such as phishing, pre-texting, and tailgating.", implementationGroup: 1, assetType: "Users", securityFunction: "Protect" },
      { id: "14.3", name: "Train Workforce Members on Authentication Best Practices", description: "Train workforce members on authentication best practices including MFA, password composition, and credential management.", implementationGroup: 1, assetType: "Users", securityFunction: "Protect" },
    ],
  },
  {
    id: "CIS.15",
    name: "Service Provider Management",
    description: "Develop a process to evaluate service providers who hold sensitive data or are responsible for an enterprise's critical IT platforms.",
    assetType: "Data",
    securityFunction: "Identify",
    safeguards: [
      { id: "15.1", name: "Establish and Maintain an Inventory of Service Providers", description: "Establish and maintain an inventory of service providers.", implementationGroup: 1, assetType: "Data", securityFunction: "Identify" },
      { id: "15.2", name: "Establish and Maintain a Service Provider Management Policy", description: "Establish and maintain a service provider management policy.", implementationGroup: 2, assetType: "Data", securityFunction: "Identify" },
      { id: "15.3", name: "Classify Service Providers", description: "Classify service providers based on data classification and level of access to enterprise systems.", implementationGroup: 2, assetType: "Data", securityFunction: "Identify" },
    ],
  },
  {
    id: "CIS.16",
    name: "Application Software Security",
    description: "Manage the security life cycle of in-house developed, hosted, or acquired software.",
    assetType: "Applications",
    securityFunction: "Protect",
    safeguards: [
      { id: "16.1", name: "Establish and Maintain a Secure Application Development Process", description: "Establish and maintain a secure application development process.", implementationGroup: 2, assetType: "Applications", securityFunction: "Protect" },
      { id: "16.2", name: "Establish and Maintain a Process to Accept and Address Software Vulnerabilities", description: "Establish and maintain a process to accept and address reports of software vulnerabilities.", implementationGroup: 2, assetType: "Applications", securityFunction: "Protect" },
      { id: "16.3", name: "Perform Root Cause Analysis on Security Vulnerabilities", description: "Perform root cause analysis on security vulnerabilities.", implementationGroup: 2, assetType: "Applications", securityFunction: "Protect" },
    ],
  },
  {
    id: "CIS.17",
    name: "Incident Response Management",
    description: "Establish a program to develop and maintain an incident response capability.",
    assetType: "Network",
    securityFunction: "Respond",
    safeguards: [
      { id: "17.1", name: "Designate Personnel to Manage Incident Handling", description: "Designate one key person and at least one backup who will manage the enterprise incident handling process.", implementationGroup: 1, assetType: "Network", securityFunction: "Respond" },
      { id: "17.2", name: "Establish and Maintain Contact Information for Reporting Security Incidents", description: "Establish and maintain contact information for parties that need to be informed of security incidents.", implementationGroup: 1, assetType: "Network", securityFunction: "Respond" },
      { id: "17.3", name: "Establish and Maintain an Enterprise Process for Reporting Incidents", description: "Establish and maintain an enterprise process for the workforce to report security incidents.", implementationGroup: 1, assetType: "Network", securityFunction: "Respond" },
    ],
  },
  {
    id: "CIS.18",
    name: "Penetration Testing",
    description: "Test the effectiveness and resiliency of enterprise assets through identifying and exploiting weaknesses in controls.",
    assetType: "Network",
    securityFunction: "Identify",
    safeguards: [
      { id: "18.1", name: "Establish and Maintain a Penetration Testing Program", description: "Establish and maintain a penetration testing program appropriate to the size, complexity, and maturity of the enterprise.", implementationGroup: 2, assetType: "Network", securityFunction: "Identify" },
      { id: "18.2", name: "Perform Periodic External Penetration Tests", description: "Perform periodic external penetration tests based on program requirements. External penetration testing must include enterprise and environmental reconnaissance.", implementationGroup: 2, assetType: "Network", securityFunction: "Identify" },
      { id: "18.3", name: "Remediate Penetration Test Findings", description: "Remediate penetration test findings based on the enterprise's policy for remediation scope and prioritization.", implementationGroup: 2, assetType: "Network", securityFunction: "Respond" },
      { id: "18.4", name: "Validate Security Measures", description: "Validate security measures after each penetration test.", implementationGroup: 3, assetType: "Network", securityFunction: "Protect" },
      { id: "18.5", name: "Perform Periodic Internal Penetration Tests", description: "Perform periodic internal penetration tests based on program requirements.", implementationGroup: 3, assetType: "Network", securityFunction: "Identify" },
    ],
  },
];

export async function importCISControls(): Promise<{ controls: number; safeguards: number }> {
  const stats = { controls: 0, safeguards: 0 };

  for (let i = 0; i < CIS_CONTROLS_V8.length; i++) {
    const control = CIS_CONTROLS_V8[i];

    const [inserted] = await db.insert(cisControls).values({
      controlId: control.id,
      name: control.name,
      description: control.description,
      assetType: control.assetType,
      securityFunction: control.securityFunction,
      sortOrder: i + 1,
    }).onConflictDoNothing().returning();

    if (inserted) stats.controls++;

    // Get the control's DB ID
    const dbControls = await db.select().from(cisControls).where(eq(cisControls.controlId, control.id));
    const dbControl = dbControls[0];

    for (let j = 0; j < control.safeguards.length; j++) {
      const sg = control.safeguards[j];

      const [insertedSg] = await db.insert(cisSafeguards).values({
        safeguardId: sg.id,
        controlId: dbControl.id,
        name: sg.name,
        description: sg.description,
        implementationGroup: sg.implementationGroup,
        assetType: sg.assetType,
        securityFunction: sg.securityFunction,
        sortOrder: j + 1,
      }).onConflictDoNothing().returning();

      if (insertedSg) stats.safeguards++;
    }
  }

  return stats;
}

export async function getCISStats() {
  const controlsCount = await db.select().from(cisControls);
  const safeguardsCount = await db.select().from(cisSafeguards);

  return {
    controls: controlsCount.length,
    safeguards: safeguardsCount.length,
  };
}
