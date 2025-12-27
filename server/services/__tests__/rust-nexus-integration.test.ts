import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  endToEndEncryption,
  certificatePinning,
  binaryObfuscation,
  protocolHardening,
  EndToEndEncryption,
  CertificatePinning,
  BinaryObfuscation,
  ProtocolHardening,
} from "../rust-nexus-security";
import { taskDistributor } from "../rust-nexus-task-distributor";
import { distributedWorkflowOrchestrator } from "../distributed-workflow-orchestrator";

/**
 * rust-nexus Integration Tests
 *
 * Phase 5: Security & Testing
 * - #AI-29: Integration tests for all components
 */

describe("rust-nexus Integration Tests", () => {
  // ============================================================================
  // #AI-25: END-TO-END ENCRYPTION TESTS
  // ============================================================================

  describe("End-to-End Encryption", () => {
    let e2e: EndToEndEncryption;
    let encryptionKey: Buffer;

    beforeEach(() => {
      e2e = new EndToEndEncryption();
      encryptionKey = e2e.generateKey();
    });

    it("should generate a valid encryption key", () => {
      const key = e2e.generateKey();
      expect(key).toBeInstanceOf(Buffer);
      expect(key.length).toBe(32); // 256 bits
    });

    it("should derive a key from a password", async () => {
      const password = "test-password-123";
      const { key, salt } = await e2e.deriveKey(password);

      expect(key).toBeInstanceOf(Buffer);
      expect(key.length).toBe(32);
      expect(salt).toBeInstanceOf(Buffer);
      expect(salt.length).toBe(32);

      // Derived key should be deterministic with same salt
      const { key: key2 } = await e2e.deriveKey(password, salt);
      expect(key.toString("hex")).toBe(key2.toString("hex"));
    });

    it("should encrypt and decrypt data correctly", () => {
      const plaintext = "Hello, rust-nexus!";
      const { ciphertext, iv, tag } = e2e.encrypt(plaintext, encryptionKey);

      expect(ciphertext).toBeInstanceOf(Buffer);
      expect(iv).toBeInstanceOf(Buffer);
      expect(tag).toBeInstanceOf(Buffer);

      // Decrypt
      const decrypted = e2e.decrypt(ciphertext, encryptionKey, iv, tag);
      expect(decrypted.toString("utf8")).toBe(plaintext);
    });

    it("should fail decryption with wrong key", () => {
      const plaintext = "Secret message";
      const { ciphertext, iv, tag } = e2e.encrypt(plaintext, encryptionKey);

      const wrongKey = e2e.generateKey();

      expect(() => {
        e2e.decrypt(ciphertext, wrongKey, iv, tag);
      }).toThrow();
    });

    it("should encrypt and decrypt task payloads", () => {
      const payload = {
        taskId: "task-123",
        command: "whoami",
        parameters: { timeout: 30 },
      };

      const encrypted = e2e.encryptTaskPayload(payload, encryptionKey);
      expect(typeof encrypted).toBe("string");

      const decrypted = e2e.decryptTaskPayload(encrypted, encryptionKey);
      expect(decrypted).toEqual(payload);
    });

    it("should detect tampered ciphertext", () => {
      const payload = { data: "important" };
      const encrypted = e2e.encryptTaskPayload(payload, encryptionKey);

      // Tamper with the encrypted data
      const tampered = encrypted.slice(0, -5) + "xxxxx";

      expect(() => {
        e2e.decryptTaskPayload(tampered, encryptionKey);
      }).toThrow();
    });
  });

  // ============================================================================
  // #AI-26: CERTIFICATE PINNING TESTS
  // ============================================================================

  describe("Certificate Pinning", () => {
    let pinning: CertificatePinning;

    beforeEach(() => {
      pinning = new CertificatePinning();
    });

    it("should verify pinned certificate fingerprints", () => {
      // Simulate a pinned certificate
      const testFingerprint = "a".repeat(64); // SHA-256 hash

      // Mock pinning (in real test, would use actual certificate)
      (pinning as any).pinnedCertificates.set(testFingerprint, {
        fingerprint: testFingerprint,
        publicKeyHash: "test-pk-hash",
        subject: "CN=test",
        issuer: "CN=test-ca",
        validFrom: new Date(Date.now() - 86400000), // Yesterday
        validTo: new Date(Date.now() + 86400000), // Tomorrow
        pinned: true,
      });

      expect(pinning.verifyCertificate(testFingerprint)).toBe(true);
      expect(pinning.verifyCertificate("invalid-fingerprint")).toBe(false);
    });

    it("should reject expired certificates", () => {
      const testFingerprint = "b".repeat(64);

      (pinning as any).pinnedCertificates.set(testFingerprint, {
        fingerprint: testFingerprint,
        publicKeyHash: "test-pk-hash",
        subject: "CN=test",
        issuer: "CN=test-ca",
        validFrom: new Date(Date.now() - 2 * 86400000), // 2 days ago
        validTo: new Date(Date.now() - 86400000), // Yesterday (expired)
        pinned: true,
      });

      expect(pinning.verifyCertificate(testFingerprint)).toBe(false);
    });

    it("should verify public key hashes", () => {
      const testPkHash = "test-public-key-hash";

      (pinning as any).pinnedCertificates.set("cert-1", {
        fingerprint: "c".repeat(64),
        publicKeyHash: testPkHash,
        subject: "CN=test",
        issuer: "CN=test-ca",
        validFrom: new Date(),
        validTo: new Date(Date.now() + 86400000),
        pinned: true,
      });

      expect(pinning.verifyPublicKeyHash(testPkHash)).toBe(true);
      expect(pinning.verifyPublicKeyHash("wrong-hash")).toBe(false);
    });

    it("should revoke pinned certificates", () => {
      const testFingerprint = "d".repeat(64);

      (pinning as any).pinnedCertificates.set(testFingerprint, {
        fingerprint: testFingerprint,
        publicKeyHash: "test",
        subject: "CN=test",
        issuer: "CN=test-ca",
        validFrom: new Date(),
        validTo: new Date(Date.now() + 86400000),
        pinned: true,
      });

      expect(pinning.verifyCertificate(testFingerprint)).toBe(true);

      pinning.revokeCertificate(testFingerprint);

      expect(pinning.verifyCertificate(testFingerprint)).toBe(false);
    });
  });

  // ============================================================================
  // #AI-27: BINARY OBFUSCATION TESTS
  // ============================================================================

  describe("Binary Obfuscation", () => {
    let obfuscation: BinaryObfuscation;

    beforeEach(() => {
      obfuscation = new BinaryObfuscation();
    });

    it("should obfuscate and deobfuscate strings", () => {
      const original = "sensitive-api-key-12345";
      const { obfuscated, key } = obfuscation.obfuscateString(original);

      expect(obfuscated).not.toBe(original);
      expect(obfuscated.length).toBeGreaterThan(0);

      const deobfuscated = obfuscation.deobfuscateString(obfuscated, key);
      expect(deobfuscated).toBe(original);
    });

    it("should generate polymorphic identifiers", () => {
      const base = "functionName";
      const id1 = obfuscation.generatePolymorphicIdentifier(base);
      const id2 = obfuscation.generatePolymorphicIdentifier(base);

      expect(id1).not.toBe(id2); // Should be different each time
      expect(id1).toMatch(/^_[a-f0-9]{16}$/);
    });

    it("should obfuscate configuration data", () => {
      const config = {
        apiEndpoint: "https://api.example.com",
        apiKey: "secret-key",
        timeout: 30000,
      };

      const { obfuscated, key } = obfuscation.obfuscateConfig(config);

      expect(typeof obfuscated).toBe("string");
      expect(key).toBeInstanceOf(Buffer);

      // Verify we can decrypt it
      const e2e = new EndToEndEncryption();
      const decrypted = e2e.decryptTaskPayload(obfuscated, key);
      expect(decrypted).toEqual(config);
    });

    it("should generate anti-debugging checks", () => {
      const antiDebug = obfuscation.generateAntiDebugCheck();

      expect(antiDebug).toContain("checkDebugger");
      expect(antiDebug).toContain("checkTiming");
      expect(antiDebug).toContain("debugger");
    });

    it("should generate integrity checks", () => {
      const codeHash = "a".repeat(64);
      const integrityCheck = obfuscation.generateIntegrityCheck(codeHash);

      expect(integrityCheck).toContain("verifyIntegrity");
      expect(integrityCheck).toContain(codeHash);
      expect(integrityCheck).toContain("Integrity check failed");
    });
  });

  // ============================================================================
  // #AI-28: PROTOCOL HARDENING TESTS
  // ============================================================================

  describe("Protocol Hardening", () => {
    let protocol: ProtocolHardening;

    beforeEach(() => {
      protocol = new ProtocolHardening();
    });

    it("should validate message size limits", () => {
      const smallMessage = Buffer.alloc(1024); // 1 KB
      const largeMessage = Buffer.alloc(2 * 1024 * 1024); // 2 MB

      expect(protocol.validateMessageSize(smallMessage)).toBe(true);
      expect(protocol.validateMessageSize(largeMessage)).toBe(false);
    });

    it("should enforce rate limiting", () => {
      const connectionId = "conn-123";

      // First 100 messages should pass
      for (let i = 0; i < 100; i++) {
        expect(protocol.checkRateLimit(connectionId)).toBe(true);
      }

      // 101st message should be rate limited
      expect(protocol.checkRateLimit(connectionId)).toBe(false);
    });

    it("should validate timestamps within allowed skew", () => {
      const now = Date.now();
      const validTimestamp = now - 1000; // 1 second ago
      const invalidTimestamp = now - 60000; // 1 minute ago (exceeds 30s limit)

      expect(protocol.validateTimestamp(validTimestamp)).toBe(true);
      expect(protocol.validateTimestamp(invalidTimestamp)).toBe(false);
    });

    it("should validate sequence numbers", () => {
      expect(protocol.validateSequenceNumber(1, 1)).toBe(true);
      expect(protocol.validateSequenceNumber(1, 2)).toBe(false);
      expect(protocol.validateSequenceNumber(5, 5)).toBe(true);
    });

    it("should detect replay attacks", () => {
      const messageId1 = "msg-unique-123";
      const messageId2 = "msg-unique-456";

      // First time should pass
      expect(protocol.checkReplayAttack(messageId1)).toBe(true);
      expect(protocol.checkReplayAttack(messageId2)).toBe(true);

      // Replay should be detected
      expect(protocol.checkReplayAttack(messageId1)).toBe(false);
    });

    it("should create and verify secure message wrappers", () => {
      const payload = { command: "test", data: "hello" };
      const connectionId = "conn-456";
      const sequenceNumber = 1;
      const encryptionKey = endToEndEncryption.generateKey();

      // Wrap message
      const wrapped = protocol.wrapMessage(
        payload,
        connectionId,
        sequenceNumber,
        encryptionKey
      );

      expect(wrapped.messageId).toBeDefined();
      expect(wrapped.timestamp).toBeDefined();
      expect(wrapped.sequenceNumber).toBe(sequenceNumber);
      expect(wrapped.payload).toBeDefined();
      expect(wrapped.signature).toBeDefined();

      // Verify message
      const verification = protocol.verifyMessage(
        wrapped,
        connectionId,
        sequenceNumber,
        encryptionKey
      );

      expect(verification.valid).toBe(true);
      expect(verification.payload).toEqual(payload);
      expect(verification.errors).toHaveLength(0);
    });

    it("should reject tampered messages", () => {
      const payload = { command: "test" };
      const connectionId = "conn-789";
      const sequenceNumber = 1;

      const wrapped = protocol.wrapMessage(payload, connectionId, sequenceNumber);

      // Tamper with the payload
      wrapped.payload = wrapped.payload + "xxx";

      const verification = protocol.verifyMessage(
        wrapped,
        connectionId,
        sequenceNumber
      );

      expect(verification.valid).toBe(false);
      expect(verification.errors).toContain("Invalid signature");
    });

    it("should maintain replay protection sliding window", () => {
      // Add messages up to window size
      for (let i = 0; i < 1000; i++) {
        const messageId = `msg-${i}`;
        expect(protocol.checkReplayAttack(messageId)).toBe(true);
      }

      // Add one more to trigger window slide
      expect(protocol.checkReplayAttack("msg-1000")).toBe(true);

      // First message should now be allowed again (outside window)
      expect(protocol.checkReplayAttack("msg-0")).toBe(true);
    });
  });

  // ============================================================================
  // INTEGRATION: TASK DISTRIBUTION + SECURITY
  // ============================================================================

  describe("Task Distribution Integration", () => {
    it("should handle task queue operations", async () => {
      const queue = await taskDistributor.getPrioritizedQueue({
        limit: 10,
        includeBlocked: false,
      });

      expect(Array.isArray(queue)).toBe(true);
    });

    it("should get queue statistics", async () => {
      const stats = await taskDistributor.getQueueStats();

      expect(stats).toHaveProperty("totalQueued");
      expect(stats).toHaveProperty("totalRunning");
      expect(stats).toHaveProperty("totalCompleted");
      expect(stats).toHaveProperty("totalFailed");
      expect(stats).toHaveProperty("successRate");
    });
  });

  // ============================================================================
  // INTEGRATION: DISTRIBUTED WORKFLOWS + SECURITY
  // ============================================================================

  describe("Distributed Workflow Integration", () => {
    it("should validate safety limits", async () => {
      const workflowId = "test-workflow-123";
      const tasks = [
        {
          taskId: "task-1",
          taskName: "Test Task",
          command: "echo 'test'",
          requiredCapabilities: ["command_execution"],
        },
      ];

      // This should not throw - simple task within limits
      await expect(async () => {
        const limits = (distributedWorkflowOrchestrator as any).getSafetyLimits(5);
        await (distributedWorkflowOrchestrator as any).validateSafetyLimits(
          workflowId,
          tasks,
          limits
        );
      }).not.toThrow();
    });

    it("should reject forbidden commands", async () => {
      const workflowId = "test-workflow-456";
      const dangerousTasks = [
        {
          taskId: "task-1",
          taskName: "Dangerous Task",
          command: "rm -rf /",
          requiredCapabilities: [],
        },
      ];

      const limits = (distributedWorkflowOrchestrator as any).getSafetyLimits(2); // Low autonomy

      await expect(async () => {
        await (distributedWorkflowOrchestrator as any).validateSafetyLimits(
          workflowId,
          dangerousTasks,
          limits
        );
      }).rejects.toThrow("Forbidden command");
    });
  });

  // ============================================================================
  // END-TO-END: ENCRYPTED TASK EXECUTION
  // ============================================================================

  describe("End-to-End Encrypted Task Flow", () => {
    it("should encrypt task, send, and decrypt result", () => {
      // Simulate full encrypted task flow
      const sharedKey = endToEndEncryption.generateKey();

      // Step 1: Create task
      const task = {
        taskId: "e2e-task-001",
        taskType: "command_execution",
        command: "whoami",
        parameters: { timeout: 30 },
      };

      // Step 2: Encrypt task payload
      const encryptedTask = endToEndEncryption.encryptTaskPayload(task, sharedKey);

      // Step 3: Wrap in protocol message
      const wrappedMessage = protocolHardening.wrapMessage(
        { encrypted: encryptedTask },
        "conn-e2e-test",
        1,
        sharedKey
      );

      // Step 4: Verify message
      const verification = protocolHardening.verifyMessage(
        wrappedMessage,
        "conn-e2e-test",
        1,
        sharedKey
      );

      expect(verification.valid).toBe(true);

      // Step 5: Decrypt task
      const decryptedTask = endToEndEncryption.decryptTaskPayload(
        verification.payload!.encrypted,
        sharedKey
      );

      expect(decryptedTask).toEqual(task);
    });
  });
});
