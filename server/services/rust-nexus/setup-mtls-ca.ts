#!/usr/bin/env tsx
/**
 * mTLS Certificate Authority Setup Script
 * Generates CA certificate and server certificate for rust-nexus controller
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const CA_DIR = path.join(process.cwd(), "ca");
const CERT_VALIDITY_DAYS = 3650; // 10 years for CA
const SERVER_CERT_VALIDITY_DAYS = 365; // 1 year for server cert

interface CertificateConfig {
  country?: string;
  state?: string;
  locality?: string;
  organization?: string;
  organizationalUnit?: string;
  commonName: string;
  emailAddress?: string;
}

/**
 * Create CA directory if it doesn't exist
 */
function ensureCaDirectory(): void {
  if (!fs.existsSync(CA_DIR)) {
    fs.mkdirSync(CA_DIR, { recursive: true });
    console.log(`✓ Created CA directory: ${CA_DIR}`);
  } else {
    console.log(`✓ CA directory already exists: ${CA_DIR}`);
  }
}

/**
 * Generate OpenSSL subject string from config
 */
function generateSubject(config: CertificateConfig): string {
  const parts: string[] = [];

  if (config.country) parts.push(`C=${config.country}`);
  if (config.state) parts.push(`ST=${config.state}`);
  if (config.locality) parts.push(`L=${config.locality}`);
  if (config.organization) parts.push(`O=${config.organization}`);
  if (config.organizationalUnit) parts.push(`OU=${config.organizationalUnit}`);
  parts.push(`CN=${config.commonName}`);
  if (config.emailAddress) parts.push(`emailAddress=${config.emailAddress}`);

  return "/" + parts.join("/");
}

/**
 * Generate Certificate Authority
 */
function generateCA(): void {
  console.log("\n📜 Generating Certificate Authority...");

  const caConfig: CertificateConfig = {
    country: "US",
    state: "California",
    locality: "San Francisco",
    organization: "RTPI",
    organizationalUnit: "Security Operations",
    commonName: "RTPI rust-nexus Certificate Authority",
    emailAddress: "security@rtpi.local",
  };

  const caKeyPath = path.join(CA_DIR, "ca.key");
  const caCertPath = path.join(CA_DIR, "ca.crt");

  if (fs.existsSync(caCertPath)) {
    console.log("  ⚠ CA certificate already exists, skipping generation");
    return;
  }

  // Generate CA private key (4096-bit RSA)
  console.log("  → Generating CA private key...");
  execSync(
    `openssl genrsa -out "${caKeyPath}" 4096`,
    { stdio: "inherit" }
  );

  // Generate CA certificate
  console.log("  → Generating CA certificate...");
  execSync(
    `openssl req -new -x509 -days ${CERT_VALIDITY_DAYS} ` +
    `-key "${caKeyPath}" -out "${caCertPath}" ` +
    `-subj "${generateSubject(caConfig)}"`,
    { stdio: "inherit" }
  );

  // Set restrictive permissions
  fs.chmodSync(caKeyPath, 0o600);
  fs.chmodSync(caCertPath, 0o644);

  console.log(`✓ CA certificate generated: ${caCertPath}`);
  console.log(`✓ CA private key secured: ${caKeyPath}`);
}

/**
 * Generate Server Certificate
 */
function generateServerCertificate(): void {
  console.log("\n🔐 Generating Server Certificate...");

  const serverConfig: CertificateConfig = {
    country: "US",
    state: "California",
    locality: "San Francisco",
    organization: "RTPI",
    organizationalUnit: "rust-nexus Controller",
    commonName: "localhost",
    emailAddress: "admin@rtpi.local",
  };

  const serverKeyPath = path.join(CA_DIR, "server.key");
  const serverCsrPath = path.join(CA_DIR, "server.csr");
  const serverCertPath = path.join(CA_DIR, "server.crt");
  const serverExtPath = path.join(CA_DIR, "server.ext");

  if (fs.existsSync(serverCertPath)) {
    console.log("  ⚠ Server certificate already exists, skipping generation");
    return;
  }

  // Generate server private key
  console.log("  → Generating server private key...");
  execSync(
    `openssl genrsa -out "${serverKeyPath}" 2048`,
    { stdio: "inherit" }
  );

  // Generate server CSR
  console.log("  → Generating server certificate signing request...");
  execSync(
    `openssl req -new -key "${serverKeyPath}" -out "${serverCsrPath}" ` +
    `-subj "${generateSubject(serverConfig)}"`,
    { stdio: "inherit" }
  );

  // Create server certificate extensions file
  const extConfig = `
subjectAltName = @alt_names
extendedKeyUsage = serverAuth

[alt_names]
DNS.1 = localhost
DNS.2 = rust-nexus-controller
DNS.3 = rtpi-server
IP.1 = 127.0.0.1
IP.2 = 0.0.0.0
`;
  fs.writeFileSync(serverExtPath, extConfig.trim());

  // Sign server certificate with CA
  console.log("  → Signing server certificate with CA...");
  const caKeyPath = path.join(CA_DIR, "ca.key");
  const caCertPath = path.join(CA_DIR, "ca.crt");

  execSync(
    `openssl x509 -req -in "${serverCsrPath}" ` +
    `-CA "${caCertPath}" -CAkey "${caKeyPath}" ` +
    `-CAcreateserial -out "${serverCertPath}" ` +
    `-days ${SERVER_CERT_VALIDITY_DAYS} ` +
    `-sha256 -extfile "${serverExtPath}"`,
    { stdio: "inherit" }
  );

  // Set restrictive permissions
  fs.chmodSync(serverKeyPath, 0o600);
  fs.chmodSync(serverCertPath, 0o644);

  // Cleanup temporary files
  fs.unlinkSync(serverCsrPath);
  fs.unlinkSync(serverExtPath);

  console.log(`✓ Server certificate generated: ${serverCertPath}`);
  console.log(`✓ Server private key secured: ${serverKeyPath}`);
}

/**
 * Verify certificates
 */
function verifyCertificates(): void {
  console.log("\n🔍 Verifying Certificates...");

  const caCertPath = path.join(CA_DIR, "ca.crt");
  const serverCertPath = path.join(CA_DIR, "server.crt");

  // Verify CA certificate
  console.log("  → Verifying CA certificate...");
  try {
    execSync(`openssl x509 -in "${caCertPath}" -noout -text | grep "CA:TRUE"`, {
      stdio: "pipe",
    });
    console.log("    ✓ CA certificate is valid");
  } catch (error) {
    console.error("    ✗ CA certificate verification failed");
    process.exit(1);
  }

  // Verify server certificate chain
  console.log("  → Verifying server certificate chain...");
  try {
    execSync(`openssl verify -CAfile "${caCertPath}" "${serverCertPath}"`, {
      stdio: "inherit",
    });
    console.log("    ✓ Server certificate chain is valid");
  } catch (error) {
    console.error("    ✗ Server certificate verification failed");
    process.exit(1);
  }

  // Display certificate information
  console.log("\n📋 Certificate Information:");

  console.log("\n  CA Certificate:");
  execSync(`openssl x509 -in "${caCertPath}" -noout -subject -dates`, {
    stdio: "inherit",
  });

  console.log("\n  Server Certificate:");
  execSync(`openssl x509 -in "${serverCertPath}" -noout -subject -dates`, {
    stdio: "inherit",
  });
}

/**
 * Main execution
 */
async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  rust-nexus mTLS Certificate Authority Setup");
  console.log("═══════════════════════════════════════════════════════════\n");

  try {
    // Check if OpenSSL is available
    try {
      execSync("openssl version", { stdio: "pipe" });
    } catch (error) {
      console.error("✗ OpenSSL is not installed or not in PATH");
      console.error("  Please install OpenSSL to continue");
      process.exit(1);
    }

    ensureCaDirectory();
    generateCA();
    generateServerCertificate();
    verifyCertificates();

    console.log("\n═══════════════════════════════════════════════════════════");
    console.log("✓ mTLS Certificate Authority setup completed successfully!");
    console.log("═══════════════════════════════════════════════════════════\n");
    console.log("Certificate files:");
    console.log(`  CA Certificate:     ${path.join(CA_DIR, "ca.crt")}`);
    console.log(`  CA Private Key:     ${path.join(CA_DIR, "ca.key")} (keep secure!)`);
    console.log(`  Server Certificate: ${path.join(CA_DIR, "server.crt")}`);
    console.log(`  Server Private Key: ${path.join(CA_DIR, "server.key")} (keep secure!)`);
    console.log("\nNext steps:");
    console.log("  1. Start the rust-nexus controller service");
    console.log("  2. Generate client certificates for implants");
    console.log("  3. Deploy implants to target systems\n");
  } catch (error) {
    console.error("\n✗ Setup failed:", error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { main as setupMtlsCA };
