import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

/**
 * rust-nexus Security Hardening Module
 *
 * Phase 5: Security & Testing
 * - #AI-25: End-to-end encryption
 * - #AI-26: Certificate pinning
 * - #AI-27: Binary obfuscation
 * - #AI-28: Protocol hardening
 */

// ============================================================================
// #AI-25: END-TO-END ENCRYPTION
// ============================================================================

export interface E2EEncryptionConfig {
  algorithm: string;
  keyLength: number;
  ivLength: number;
  tagLength?: number; // For AEAD modes
  saltLength: number;
  iterations: number; // For key derivation
}

export const DEFAULT_E2E_CONFIG: E2EEncryptionConfig = {
  algorithm: "aes-256-gcm", // Authenticated encryption
  keyLength: 32, // 256 bits
  ivLength: 16, // 128 bits
  tagLength: 16, // 128 bits for GCM
  saltLength: 32,
  iterations: 100000, // PBKDF2 iterations
};

export class EndToEndEncryption {
  private config: E2EEncryptionConfig;

  constructor(config: E2EEncryptionConfig = DEFAULT_E2E_CONFIG) {
    this.config = config;
  }

  /**
   * Generate a random encryption key
   */
  generateKey(): Buffer {
    return crypto.randomBytes(this.config.keyLength);
  }

  /**
   * Derive a key from a password using PBKDF2
   */
  async deriveKey(password: string, salt?: Buffer): Promise<{ key: Buffer; salt: Buffer }> {
    const actualSalt = salt || crypto.randomBytes(this.config.saltLength);

    return new Promise((resolve, reject) => {
      crypto.pbkdf2(
        password,
        actualSalt,
        this.config.iterations,
        this.config.keyLength,
        "sha256",
        (err, derivedKey) => {
          if (err) reject(err);
          else resolve({ key: derivedKey, salt: actualSalt });
        }
      );
    });
  }

  /**
   * Encrypt data with authenticated encryption (AES-256-GCM)
   */
  encrypt(plaintext: Buffer | string, key: Buffer): {
    ciphertext: Buffer;
    iv: Buffer;
    tag: Buffer;
  } {
    const iv = crypto.randomBytes(this.config.ivLength);
    const cipher = crypto.createCipheriv(this.config.algorithm, key, iv);

    const plaintextBuffer = Buffer.isBuffer(plaintext)
      ? plaintext
      : Buffer.from(plaintext, "utf8");

    const encrypted = Buffer.concat([
      cipher.update(plaintextBuffer),
      cipher.final(),
    ]);

    // Get authentication tag for GCM mode
    const tag = (cipher as any).getAuthTag();

    return {
      ciphertext: encrypted,
      iv,
      tag,
    };
  }

  /**
   * Decrypt data with authenticated encryption
   */
  decrypt(
    ciphertext: Buffer,
    key: Buffer,
    iv: Buffer,
    tag: Buffer
  ): Buffer {
    const decipher = crypto.createDecipheriv(this.config.algorithm, key, iv);
    (decipher as any).setAuthTag(tag);

    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
  }

  /**
   * Encrypt task payload for implant communication
   */
  encryptTaskPayload(payload: any, sharedKey: Buffer): string {
    const jsonPayload = JSON.stringify(payload);
    const { ciphertext, iv, tag } = this.encrypt(jsonPayload, sharedKey);

    // Combine all components into a single base64 string
    const combined = Buffer.concat([
      iv,
      tag,
      ciphertext,
    ]);

    return combined.toString("base64");
  }

  /**
   * Decrypt task payload from implant communication
   */
  decryptTaskPayload(encryptedPayload: string, sharedKey: Buffer): any {
    const combined = Buffer.from(encryptedPayload, "base64");

    // Extract components
    const iv = combined.subarray(0, this.config.ivLength);
    const tag = combined.subarray(
      this.config.ivLength,
      this.config.ivLength + (this.config.tagLength || 16)
    );
    const ciphertext = combined.subarray(this.config.ivLength + (this.config.tagLength || 16));

    const decrypted = this.decrypt(ciphertext, sharedKey, iv, tag);
    return JSON.parse(decrypted.toString("utf8"));
  }

  /**
   * Establish shared key using Diffie-Hellman key exchange
   */
  async establishSharedKey(
    implantPublicKey: Buffer,
    serverPrivateKey: Buffer
  ): Promise<Buffer> {
    // Use ECDH for key exchange
    const ecdh = crypto.createECDH("secp256k1");
    ecdh.setPrivateKey(serverPrivateKey);

    const sharedSecret = ecdh.computeSecret(implantPublicKey);

    // Derive encryption key from shared secret
    const { key } = await this.deriveKey(sharedSecret.toString("hex"));
    return key;
  }
}

// ============================================================================
// #AI-26: CERTIFICATE PINNING
// ============================================================================

export interface PinnedCertificate {
  fingerprint: string;
  publicKeyHash: string;
  subject: string;
  issuer: string;
  validFrom: Date;
  validTo: Date;
  pinned: boolean;
}

export class CertificatePinning {
  private pinnedCertificates: Map<string, PinnedCertificate> = new Map();

  /**
   * Pin a certificate by its fingerprint
   */
  async pinCertificate(certPath: string): Promise<PinnedCertificate> {
    const certData = await fs.readFile(certPath, "utf8");

    // Parse certificate
    const cert = this.parseCertificate(certData);

    // Calculate fingerprint (SHA-256 of DER-encoded cert)
    const fingerprint = this.calculateFingerprint(certData);

    // Calculate public key hash (SPKI hash for HPKP)
    const publicKeyHash = this.calculatePublicKeyHash(certData);

    const pinnedCert: PinnedCertificate = {
      fingerprint,
      publicKeyHash,
      subject: cert.subject,
      issuer: cert.issuer,
      validFrom: cert.validFrom,
      validTo: cert.validTo,
      pinned: true,
    };

    this.pinnedCertificates.set(fingerprint, pinnedCert);

    console.log(`[CertificatePinning] Pinned certificate: ${fingerprint}`);
    return pinnedCert;
  }

  /**
   * Verify certificate against pinned certificates
   */
  verifyCertificate(fingerprint: string): boolean {
    const pinnedCert = this.pinnedCertificates.get(fingerprint);

    if (!pinnedCert) {
      console.warn(`[CertificatePinning] Certificate not pinned: ${fingerprint}`);
      return false;
    }

    // Check if certificate is still valid
    const now = new Date();
    if (now < pinnedCert.validFrom || now > pinnedCert.validTo) {
      console.error(`[CertificatePinning] Certificate expired: ${fingerprint}`);
      return false;
    }

    return true;
  }

  /**
   * Verify public key hash (HPKP - HTTP Public Key Pinning)
   */
  verifyPublicKeyHash(publicKeyHash: string): boolean {
    for (const [_, cert] of this.pinnedCertificates) {
      if (cert.publicKeyHash === publicKeyHash) {
        return true;
      }
    }

    console.warn(`[CertificatePinning] Public key not pinned: ${publicKeyHash}`);
    return false;
  }

  /**
   * Calculate certificate fingerprint (SHA-256)
   */
  private calculateFingerprint(certData: string): string {
    // Remove PEM headers and decode base64
    const base64Cert = certData
      .replace(/-----BEGIN CERTIFICATE-----/, "")
      .replace(/-----END CERTIFICATE-----/, "")
      .replace(/\s/g, "");

    const derCert = Buffer.from(base64Cert, "base64");

    // Calculate SHA-256 hash
    const hash = crypto.createHash("sha256");
    hash.update(derCert);

    return hash.digest("hex");
  }

  /**
   * Calculate public key hash for HPKP
   */
  private calculatePublicKeyHash(certData: string): string {
    // This is a simplified version - in production, extract actual SPKI
    const hash = crypto.createHash("sha256");
    hash.update(certData);
    return hash.digest("base64");
  }

  /**
   * Parse certificate (simplified)
   */
  private parseCertificate(certData: string): {
    subject: string;
    issuer: string;
    validFrom: Date;
    validTo: Date;
  } {
    // In production, use a proper X.509 parser
    // This is a placeholder implementation
    return {
      subject: "CN=rust-nexus-implant",
      issuer: "CN=rust-nexus-ca",
      validFrom: new Date(),
      validTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
    };
  }

  /**
   * Get all pinned certificates
   */
  getPinnedCertificates(): PinnedCertificate[] {
    return Array.from(this.pinnedCertificates.values());
  }

  /**
   * Revoke a pinned certificate
   */
  revokeCertificate(fingerprint: string): boolean {
    return this.pinnedCertificates.delete(fingerprint);
  }
}

// ============================================================================
// #AI-27: BINARY OBFUSCATION
// ============================================================================

export class BinaryObfuscation {
  /**
   * Obfuscate string constants in binary
   */
  obfuscateString(input: string): { obfuscated: string; key: string } {
    // Generate random key
    const key = crypto.randomBytes(16).toString("hex");

    // XOR encryption for string obfuscation
    const obfuscated = Buffer.from(input)
      .map((byte, i) => byte ^ key.charCodeAt(i % key.length))
      .toString("hex");

    return { obfuscated, key };
  }

  /**
   * Deobfuscate string
   */
  deobfuscateString(obfuscated: string, key: string): string {
    const buffer = Buffer.from(obfuscated, "hex");
    const deobfuscated = buffer
      .map((byte, i) => byte ^ key.charCodeAt(i % key.length))
      .toString("utf8");

    return deobfuscated;
  }

  /**
   * Generate polymorphic code identifiers
   * Uses cryptographically secure random bytes to ensure uniqueness
   */
  generatePolymorphicIdentifier(base: string): string {
    const hash = crypto.createHash("sha256");
    const randomBytes = crypto.randomBytes(16); // 128 bits of cryptographic entropy

    hash.update(base);
    hash.update(randomBytes);

    return "_" + hash.digest("hex").substring(0, 16);
  }

  /**
   * Obfuscate configuration data
   */
  obfuscateConfig(config: Record<string, any>): {
    obfuscated: string;
    key: Buffer;
  } {
    const key = crypto.randomBytes(32);
    const e2e = new EndToEndEncryption();

    const configJson = JSON.stringify(config);
    const { ciphertext, iv, tag } = e2e.encrypt(configJson, key);

    const combined = Buffer.concat([iv, tag, ciphertext]);

    return {
      obfuscated: combined.toString("base64"),
      key,
    };
  }

  /**
   * Generate anti-debugging checks
   */
  generateAntiDebugCheck(): string {
    return `
// Anti-debugging check
function checkDebugger() {
  const start = Date.now();
  debugger;
  const end = Date.now();

  if (end - start > 100) {
    // Debugger detected
    return true;
  }
  return false;
}

// Timing check
function checkTiming() {
  const iterations = 1000000;
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {}
  const end = performance.now();

  // If execution is too slow, might be debugged
  return (end - start) > 100;
}
`;
  }

  /**
   * Generate code integrity check
   */
  generateIntegrityCheck(codeHash: string): string {
    return `
function verifyIntegrity() {
  const expectedHash = "${codeHash}";
  const actualHash = calculateCodeHash();

  if (actualHash !== expectedHash) {
    // Code has been tampered with
    throw new Error("Integrity check failed");
  }
}

function calculateCodeHash() {
  // Calculate hash of code section
  const code = Function.prototype.toString.call(verifyIntegrity);
  return crypto.createHash('sha256').update(code).digest('hex');
}
`;
  }
}

// ============================================================================
// #AI-28: PROTOCOL HARDENING
// ============================================================================

export interface ProtocolSecurityConfig {
  maxMessageSize: number;
  maxMessagesPerSecond: number;
  requireSequenceNumbers: boolean;
  requireTimestamps: boolean;
  maxClockSkewMs: number;
  enableReplayProtection: boolean;
  replayWindowSize: number;
}

export const DEFAULT_PROTOCOL_CONFIG: ProtocolSecurityConfig = {
  maxMessageSize: 1024 * 1024, // 1 MB
  maxMessagesPerSecond: 100,
  requireSequenceNumbers: true,
  requireTimestamps: true,
  maxClockSkewMs: 30000, // 30 seconds
  enableReplayProtection: true,
  replayWindowSize: 1000,
};

export class ProtocolHardening {
  private config: ProtocolSecurityConfig;
  private messageCount: Map<string, { count: number; resetAt: number }> = new Map();
  private seenMessages: Set<string> = new Set(); // For replay protection
  private messageWindow: string[] = []; // Sliding window for replay protection

  constructor(config: ProtocolSecurityConfig = DEFAULT_PROTOCOL_CONFIG) {
    this.config = config;
  }

  /**
   * Validate message size
   */
  validateMessageSize(message: Buffer | string): boolean {
    const size = Buffer.isBuffer(message) ? message.length : Buffer.from(message).length;

    if (size > this.config.maxMessageSize) {
      console.error(
        `[ProtocolHardening] Message too large: ${size} > ${this.config.maxMessageSize}`
      );
      return false;
    }

    return true;
  }

  /**
   * Rate limiting per connection
   */
  checkRateLimit(connectionId: string): boolean {
    const now = Date.now();
    const record = this.messageCount.get(connectionId);

    if (!record || now >= record.resetAt) {
      // New window
      this.messageCount.set(connectionId, {
        count: 1,
        resetAt: now + 1000, // 1 second window
      });
      return true;
    }

    if (record.count >= this.config.maxMessagesPerSecond) {
      console.warn(
        `[ProtocolHardening] Rate limit exceeded for connection: ${connectionId}`
      );
      return false;
    }

    record.count++;
    return true;
  }

  /**
   * Validate message timestamp
   */
  validateTimestamp(timestamp: number): boolean {
    if (!this.config.requireTimestamps) {
      return true;
    }

    const now = Date.now();
    const diff = Math.abs(now - timestamp);

    if (diff > this.config.maxClockSkewMs) {
      console.error(
        `[ProtocolHardening] Timestamp out of range: ${diff}ms > ${this.config.maxClockSkewMs}ms`
      );
      return false;
    }

    return true;
  }

  /**
   * Validate sequence number
   */
  validateSequenceNumber(expected: number, received: number): boolean {
    if (!this.config.requireSequenceNumbers) {
      return true;
    }

    if (received !== expected) {
      console.error(
        `[ProtocolHardening] Sequence number mismatch: expected ${expected}, got ${received}`
      );
      return false;
    }

    return true;
  }

  /**
   * Check for replay attacks
   */
  checkReplayAttack(messageId: string): boolean {
    if (!this.config.enableReplayProtection) {
      return true;
    }

    if (this.seenMessages.has(messageId)) {
      console.error(`[ProtocolHardening] Replay attack detected: ${messageId}`);
      return false;
    }

    // Add to seen messages
    this.seenMessages.add(messageId);
    this.messageWindow.push(messageId);

    // Maintain sliding window
    if (this.messageWindow.length > this.config.replayWindowSize) {
      const removed = this.messageWindow.shift();
      if (removed) {
        this.seenMessages.delete(removed);
      }
    }

    return true;
  }

  /**
   * Generate secure message ID
   */
  generateMessageId(connectionId: string, sequenceNumber: number): string {
    const data = `${connectionId}-${sequenceNumber}-${Date.now()}`;
    return crypto.createHash("sha256").update(data).digest("hex");
  }

  /**
   * Create secure message wrapper
   */
  wrapMessage(
    payload: any,
    connectionId: string,
    sequenceNumber: number,
    encryptionKey?: Buffer
  ): {
    messageId: string;
    timestamp: number;
    sequenceNumber: number;
    payload: string;
    signature?: string;
  } {
    const messageId = this.generateMessageId(connectionId, sequenceNumber);
    const timestamp = Date.now();

    let payloadString: string;

    if (encryptionKey) {
      const e2e = new EndToEndEncryption();
      payloadString = e2e.encryptTaskPayload(payload, encryptionKey);
    } else {
      payloadString = JSON.stringify(payload);
    }

    // Generate HMAC signature
    const signature = this.signMessage(messageId, timestamp, sequenceNumber, payloadString);

    return {
      messageId,
      timestamp,
      sequenceNumber,
      payload: payloadString,
      signature,
    };
  }

  /**
   * Verify message wrapper
   */
  verifyMessage(
    message: {
      messageId: string;
      timestamp: number;
      sequenceNumber: number;
      payload: string;
      signature?: string;
    },
    connectionId: string,
    expectedSequence: number,
    encryptionKey?: Buffer
  ): { valid: boolean; payload?: any; errors: string[] } {
    const errors: string[] = [];

    // Check message size
    if (!this.validateMessageSize(message.payload)) {
      errors.push("Message size exceeded");
    }

    // Check rate limit
    if (!this.checkRateLimit(connectionId)) {
      errors.push("Rate limit exceeded");
    }

    // Check timestamp
    if (!this.validateTimestamp(message.timestamp)) {
      errors.push("Invalid timestamp");
    }

    // Check sequence number
    if (!this.validateSequenceNumber(expectedSequence, message.sequenceNumber)) {
      errors.push("Invalid sequence number");
    }

    // Check replay attack
    if (!this.checkReplayAttack(message.messageId)) {
      errors.push("Replay attack detected");
    }

    // Verify signature
    if (message.signature) {
      const expectedSignature = this.signMessage(
        message.messageId,
        message.timestamp,
        message.sequenceNumber,
        message.payload
      );

      if (message.signature !== expectedSignature) {
        errors.push("Invalid signature");
      }
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    // Decrypt payload if encrypted
    let payload: any;
    try {
      if (encryptionKey) {
        const e2e = new EndToEndEncryption();
        payload = e2e.decryptTaskPayload(message.payload, encryptionKey);
      } else {
        payload = JSON.parse(message.payload);
      }
    } catch (error) {
      errors.push("Failed to decrypt/parse payload");
      return { valid: false, errors };
    }

    return { valid: true, payload, errors: [] };
  }

  /**
   * Sign message with HMAC
   */
  private signMessage(
    messageId: string,
    timestamp: number,
    sequenceNumber: number,
    payload: string
  ): string {
    // In production, use a proper HMAC key from configuration
    const hmacKey = process.env.RUST_NEXUS_HMAC_KEY || "default-hmac-key-change-me";

    const data = `${messageId}|${timestamp}|${sequenceNumber}|${payload}`;
    const hmac = crypto.createHmac("sha256", hmacKey);
    hmac.update(data);

    return hmac.digest("hex");
  }
}

// Export singleton instances
export const endToEndEncryption = new EndToEndEncryption();
export const certificatePinning = new CertificatePinning();
export const binaryObfuscation = new BinaryObfuscation();
export const protocolHardening = new ProtocolHardening();
