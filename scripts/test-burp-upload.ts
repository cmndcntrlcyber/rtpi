/**
 * Minimal test server to verify BurpSuite JAR upload functionality.
 * Tests the burp-builder route in isolation (no DB, no AI clients).
 *
 * Usage: npx tsx scripts/test-burp-upload.ts
 * Then:  curl -X POST http://localhost:3099/api/v1/burp-builder/upload \
 *          -F "jarFile=@/home/cmndcntrl/code/rtpi/burpsuite_pro_v2025.12.5.jar" \
 *          -F "userId=test-user"
 */

import express from 'express';
import burpBuilderRoutes from '../server/api/v1/burp-builder';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mount the burp-builder routes
app.use('/api/v1/burp-builder', burpBuilderRoutes);

const PORT = 3099;
app.listen(PORT, () => {
  console.log(`[Test Server] Burp upload test server running on port ${PORT}`);
  console.log(`[Test Server] Upload endpoint: POST http://localhost:${PORT}/api/v1/burp-builder/upload`);
  console.log(`[Test Server] Health check:    GET  http://localhost:${PORT}/api/v1/burp-builder/health`);
});
