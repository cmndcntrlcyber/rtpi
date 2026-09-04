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
    log.info(`✓ Created CA directory: ${CA_DIR}`);
  } else {
    log.info(`✓ CA directory already exists: ${CA_DIR}`);
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
  log.info("\n📜 Generating Certificate Authority...");

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
    log.info("  ⚠ CA certificate already exists, skipping generation");
    return;
  }

  // Generate CA private key (4096-bit RSA)
  log.info("  → Generating CA private key...");
  execSync(
    `openssl genrsa -out "${caKeyPath}" 4096`,
    { stdio: "inherit" }
  );

  // Generate CA certificate
  log.info("  → Generating CA certificate...");
  execSync(
    `openssl req -new -x509 -days ${CERT_VALIDITY_DAYS} ` +
    `-key "${caKeyPath}" -out "${caCertPath}" ` +
    `-subj "${generateSubject(caConfig)}"`,
    { stdio: "inherit" }
  );

  // Set restrictive permissions
  fs.chmodSync(caKeyPath, 0o600);
  fs.chmodSync(caCertPath, 0o644);

  log.info(`✓ CA certificate generated: ${caCertPath}`);
  log.info(`✓ CA private key secured: ${caKeyPath}`);
}

/**
 * Generate Server Certificate
 */
function generateServerCertificate(): void {
  log.info("\n🔐 Generating Server Certificate...");

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
    log.info("  ⚠ Server certificate already exists, skipping generation");
    return;
  }

  // Generate server private key
  log.info("  → Generating server private key...");
  execSync(
    `openssl genrsa -out "${serverKeyPath}" 2048`,
    { stdio: "inherit" }
  );

  // Generate server CSR
  log.info("  → Generating server certificate signing request...");
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
  log.info("  → Signing server certificate with CA...");
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

  log.info(`✓ Server certificate generated: ${serverCertPath}`);
  log.info(`✓ Server private key secured: ${serverKeyPath}`);
}

/**
 * Verify certificates
 */
function verifyCertificates(): void {
  log.info("\n🔍 Verifying Certificates...");

  const caCertPath = path.join(CA_DIR, "ca.crt");
  const serverCertPath = path.join(CA_DIR, "server.crt");

  // Verify CA certificate
  log.info("  → Verifying CA certificate...");
  try {
    execSync(`openssl x509 -in "${caCertPath}" -noout -text | grep "CA:TRUE"`, {
      stdio: "pipe",
    });
    log.info("    ✓ CA certificate is valid");
  } catch (error) {
    log.error("    ✗ CA certificate verification failed");
    process.exit(1);
  }

  // Verify server certificate chain
  log.info("  → Verifying server certificate chain...");
  try {
    execSync(`openssl verify -CAfile "${caCertPath}" "${serverCertPath}"`, {
      stdio: "inherit",
    });
    log.info("    ✓ Server certificate chain is valid");
  } catch (error) {
    log.error("    ✗ Server certificate verification failed");
    process.exit(1);
  }

  // Display certificate information
  log.info("\n📋 Certificate Information:");

  log.info("\n  CA Certificate:");
  execSync(`openssl x509 -in "${caCertPath}" -noout -subject -dates`, {
    stdio: "inherit",
  });

  log.info("\n  Server Certificate:");
  execSync(`openssl x509 -in "${serverCertPath}" -noout -subject -dates`, {
    stdio: "inherit",
  });
}

/**
 * Main execution
 */
async function main() {
  log.info("═══════════════════════════════════════════════════════════");
  log.info("  rust-nexus mTLS Certificate Authority Setup");
  log.info("═══════════════════════════════════════════════════════════\n");

  try {
    // Check if OpenSSL is available
    try {
      execSync("openssl version", { stdio: "pipe" });
    } catch (error) {
      log.error("✗ OpenSSL is not installed or not in PATH");
      log.error("  Please install OpenSSL to continue");
      process.exit(1);
    }

    ensureCaDirectory();
    generateCA();
    generateServerCertificate();
    verifyCertificates();

    log.info("\n═══════════════════════════════════════════════════════════");
    log.info("✓ mTLS Certificate Authority setup completed successfully!");
    log.info("═══════════════════════════════════════════════════════════\n");
    log.info("Certificate files:");
    log.info(`  CA Certificate:     ${path.join(CA_DIR, "ca.crt")}`);
    log.info(`  CA Private Key:     ${path.join(CA_DIR, "ca.key")} (keep secure!)`);
    log.info(`  Server Certificate: ${path.join(CA_DIR, "server.crt")}`);
    log.info(`  Server Private Key: ${path.join(CA_DIR, "server.key")} (keep secure!)`);
    log.info("\nNext steps:");
    log.info("  1. Start the rust-nexus controller service");
    log.info("  2. Generate client certificates for implants");
    log.info("  3. Deploy implants to target systems\n");
  } catch (error) {
    log.error("\n✗ Setup failed:", error);
    process.exit(1);
  }
}

// Run if executed directly
import { fileURLToPath } from "url";
import { createLogger } from '../../lib/logger';
const log = createLogger("setup-mtls-ca");
const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] === __filename || process.argv[1]?.endsWith("setup-mtls-ca.ts")) {
  main();
}

export { main as setupMtlsCA };
