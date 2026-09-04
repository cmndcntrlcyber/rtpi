#!/usr/bin/env tsx
/**
 * Implant Certificate Provisioning Script
 * Generates client certificates for rust-nexus implants
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { createLogger } from '../../lib/logger';
const log = createLogger("provision-implant");

const CA_DIR = path.join(process.cwd(), "ca");
const IMPLANTS_DIR = path.join(process.cwd(), "implants");
const CLIENT_CERT_VALIDITY_DAYS = 90; // 90 days for client certs

interface ImplantProvisionOptions {
  name: string;
  force?: boolean;
  type?: "reconnaissance" | "exploitation" | "exfiltration" | "general";
  architecture?: "x86" | "x64" | "arm" | "arm64";
}

/**
 * Generate implant client certificate
 */
function provisionImplant(options: ImplantProvisionOptions): void {
  const { name, force = false } = options;

  log.info(`\n🔐 Provisioning implant: ${name}`);

  // Create implant directory
  const implantDir = path.join(IMPLANTS_DIR, name);
  if (fs.existsSync(implantDir)) {
    if (!force) {
      log.error(`  ✗ Implant '${name}' already exists. Use --force to regenerate.`);
      process.exit(1);
    }
    log.info(`  ⚠ Implant directory exists, regenerating certificates...`);
  } else {
    fs.mkdirSync(implantDir, { recursive: true });
  }

  // Paths
  const clientKeyPath = path.join(implantDir, "client.key");
  const clientCsrPath = path.join(implantDir, "client.csr");
  const clientCertPath = path.join(implantDir, "client.crt");
  const clientExtPath = path.join(implantDir, "client.ext");
  const configPath = path.join(implantDir, "config.toml");

  const caKeyPath = path.join(CA_DIR, "ca.key");
  const caCertPath = path.join(CA_DIR, "ca.crt");

  // Verify CA exists
  if (!fs.existsSync(caCertPath) || !fs.existsSync(caKeyPath)) {
    log.error("  ✗ CA certificate not found. Run setup-mtls-ca.ts first.");
    process.exit(1);
  }

  // Generate client private key
  log.info("  → Generating client private key...");
  execSync(`openssl genrsa -out "${clientKeyPath}" 2048`, { stdio: "pipe" });

  // Generate CSR
  log.info("  → Generating certificate signing request...");
  const subject = `/C=US/ST=California/L=San Francisco/O=RTPI/OU=Implant/CN=${name}`;
  execSync(
    `openssl req -new -key "${clientKeyPath}" -out "${clientCsrPath}" -subj "${subject}"`,
    { stdio: "pipe" }
  );

  // Create client certificate extensions
  const extConfig = `
subjectAltName = DNS:${name}
extendedKeyUsage = clientAuth
`;
  fs.writeFileSync(clientExtPath, extConfig.trim());

  // Sign client certificate
  log.info("  → Signing client certificate with CA...");
  execSync(
    `openssl x509 -req -in "${clientCsrPath}" ` +
    `-CA "${caCertPath}" -CAkey "${caKeyPath}" ` +
    `-CAcreateserial -out "${clientCertPath}" ` +
    `-days ${CLIENT_CERT_VALIDITY_DAYS} ` +
    `-sha256 -extfile "${clientExtPath}"`,
    { stdio: "pipe" }
  );

  // Set permissions
  fs.chmodSync(clientKeyPath, 0o600);
  fs.chmodSync(clientCertPath, 0o644);

  // Cleanup
  fs.unlinkSync(clientCsrPath);
  fs.unlinkSync(clientExtPath);

  // Get certificate fingerprint
  const fingerprintOutput = execSync(
    `openssl x509 -in "${clientCertPath}" -noout -fingerprint -sha256`,
    { encoding: "utf-8" }
  );
  const fingerprint = fingerprintOutput
    .split("=")[1]
    .trim()
    .replace(/:/g, "");

  // Get serial number
  const serialOutput = execSync(
    `openssl x509 -in "${clientCertPath}" -noout -serial`,
    { encoding: "utf-8" }
  );
  const serial = serialOutput.split("=")[1].trim();

  // Generate auth token
  const authToken = crypto.randomBytes(32).toString("hex");

  // Create config file
  log.info("  → Generating configuration file...");
  const config = `
# rust-nexus Implant Configuration
# Implant: ${name}
# Generated: ${new Date().toISOString()}

[implant]
name = "${name}"
type = "${options.type || 'general'}"
version = "1.0.0"
architecture = "${options.architecture || 'x64'}"

[controller]
url = "https://rtpi-server:8443"
certificate = "ca.crt"
client_certificate = "client.crt"
client_key = "client.key"

[auth]
certificate_serial = "${serial}"
certificate_fingerprint = "${fingerprint}"
token = "${authToken}"

[behavior]
heartbeat_interval = 30  # seconds
max_concurrent_tasks = 3
autonomy_level = 1
retry_attempts = 3
connection_timeout = 30  # seconds

[telemetry]
enabled = true
interval = 60  # seconds
include_system_metrics = true
include_network_metrics = true
`;

  fs.writeFileSync(configPath, config.trim());

  log.info(`✓ Implant provisioned successfully!`);
  log.info(`\nFiles generated:`);
  log.info(`  Client Certificate: ${clientCertPath}`);
  log.info(`  Client Private Key: ${clientKeyPath}`);
  log.info(`  Configuration:      ${configPath}`);
  log.info(`\nCertificate Details:`);
  log.info(`  Serial:      ${serial}`);
  log.info(`  Fingerprint: ${fingerprint}`);
  log.info(`\nNext steps:`);
  log.info(`  1. Copy the following files to the target system:`);
  log.info(`     - ${path.relative(process.cwd(), clientCertPath)}`);
  log.info(`     - ${path.relative(process.cwd(), clientKeyPath)}`);
  log.info(`     - ${path.relative(process.cwd(), configPath)}`);
  log.info(`     - ${path.relative(process.cwd(), caCertPath)}`);
  log.info(`  2. Build and deploy the rust-nexus implant binary`);
  log.info(`  3. Start the implant with the configuration file`);
}

/**
 * List all provisioned implants
 */
function listImplants(): void {
  if (!fs.existsSync(IMPLANTS_DIR)) {
    log.info("No implants provisioned yet.");
    return;
  }

  const implants = fs.readdirSync(IMPLANTS_DIR, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);

  if (implants.length === 0) {
    log.info("No implants provisioned yet.");
    return;
  }

  log.info("\n📋 Provisioned Implants:\n");

  for (const implantName of implants) {
    const implantDir = path.join(IMPLANTS_DIR, implantName);
    const certPath = path.join(implantDir, "client.crt");

    if (!fs.existsSync(certPath)) {
      log.info(`  • ${implantName} (incomplete)`);
      continue;
    }

    try {
      const datesOutput = execSync(
        `openssl x509 -in "${certPath}" -noout -dates`,
        { encoding: "utf-8" }
      );

      const notBefore = datesOutput.match(/notBefore=(.+)/)?.[1];
      const notAfter = datesOutput.match(/notAfter=(.+)/)?.[1];

      const expiryDate = new Date(notAfter || "");
      const now = new Date();
      const daysRemaining = Math.floor(
        (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      const status = daysRemaining > 0 ? "✓ Valid" : "✗ Expired";
      const daysStr = daysRemaining > 0 ? `${daysRemaining} days remaining` : "expired";

      log.info(`  • ${implantName}`);
      log.info(`    Status:  ${status}`);
      log.info(`    Expires: ${notAfter} (${daysStr})`);
    } catch (error) {
      log.info(`  • ${implantName} (error reading certificate)`);
    }
  }

  log.info("");
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--list") || args.includes("-l")) {
    listImplants();
    return;
  }

  const nameIndex = args.indexOf("--name");
  if (nameIndex === -1 || !args[nameIndex + 1]) {
    log.error("Usage: provision-implant.ts --name <implant-name> [--force] [--type <type>] [--arch <arch>]");
    log.error("       provision-implant.ts --list");
    log.error("\nOptions:");
    log.error("  --name <name>        Implant name (required)");
    log.error("  --force              Regenerate if exists");
    log.error("  --type <type>        Implant type: reconnaissance, exploitation, exfiltration, general (default: general)");
    log.error("  --arch <arch>        Architecture: x86, x64, arm, arm64 (default: x64)");
    log.error("  --list, -l           List all provisioned implants");
    process.exit(1);
  }

  const options: ImplantProvisionOptions = {
    name: args[nameIndex + 1],
    force: args.includes("--force"),
  };

  const typeIndex = args.indexOf("--type");
  if (typeIndex !== -1 && args[typeIndex + 1]) {
    options.type = args[typeIndex + 1] as any;
  }

  const archIndex = args.indexOf("--arch");
  if (archIndex !== -1 && args[archIndex + 1]) {
    options.architecture = args[archIndex + 1] as any;
  }

  provisionImplant(options);
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { provisionImplant, listImplants };
