# Phase 5: Framework Integration - Quick Start Guide

## Installation & Setup

### 1. Apply Database Migration

```bash
# Apply schema changes
npm run db:push
```

**Expected Output:**
```
[✓] Changes applied
```

### 2. Start Development Servers

```bash
# Terminal 1: Backend API
npm run dev

# Terminal 2: Frontend UI
npm run dev:frontend
```

### 3. Import Framework Data

```bash
# Import OWASP LLM Top 10
curl -X POST http://localhost:3001/api/v1/owasp-llm/import

# Import NIST AI RMF
curl -X POST http://localhost:3001/api/v1/nist-ai/import

# Import MITRE ATLAS
curl -X POST http://localhost:3001/api/v1/atlas/import
```

**Expected Results:**
- ATLAS: 14 tactics, 91 techniques
- OWASP LLM: 10 vulnerabilities
- NIST AI RMF: 4 functions, 5 categories, 7 subcategories

## Usage

### Access Frameworks UI

1. Navigate to http://localhost:5000
2. Login to RTPI
3. Click sidebar → Intelligence → **Frameworks**
4. Select framework to explore:
   - **MITRE ATLAS** - AI/ML adversarial tactics
   - **OWASP LLM Top 10** - LLM vulnerabilities
   - **NIST AI RMF** - AI risk management
   - **MITRE ATT&CK** - Traditional adversary tactics (existing)

### Import via UI

1. Visit any framework page (e.g., /atlas)
2. Click **"Import [Framework] Matrix"** button
3. Wait for import to complete
4. Stats cards will update automatically

## API Quick Reference

### Get Framework Statistics

```bash
# ATLAS
curl http://localhost:3001/api/v1/atlas/stats

# OWASP LLM
curl http://localhost:3001/api/v1/owasp-llm/stats

# NIST AI RMF
curl http://localhost:3001/api/v1/nist-ai/stats
```

### Browse Framework Data

```bash
# List ATLAS tactics
curl http://localhost:3001/api/v1/atlas/tactics | jq '.'

# List ATLAS techniques
curl http://localhost:3001/api/v1/atlas/techniques | jq '.'

# List OWASP LLM vulnerabilities
curl http://localhost:3001/api/v1/owasp-llm/vulnerabilities | jq '.'

# List NIST AI functions
curl http://localhost:3001/api/v1/nist-ai/functions | jq '.'
```

### Get Specific Framework Element

```bash
# Get ATLAS technique by ID
curl http://localhost:3001/api/v1/atlas/techniques/{id} | jq '.'

# Get OWASP LLM vulnerability by ID
curl http://localhost:3001/api/v1/owasp-llm/vulnerabilities/{id} | jq '.'

# Get NIST AI function with categories
curl http://localhost:3001/api/v1/nist-ai/functions/{id} | jq '.'
```

### Framework Mappings

```bash
# Get mappings for ATLAS technique
curl http://localhost:3001/api/v1/framework-mappings/ATLAS/AML.T0001 | jq '.'

# Create new mapping
curl -X POST http://localhost:3001/api/v1/framework-mappings \
  -H "Content-Type: application/json" \
  -d '{
    "sourceFramework": "ATLAS",
    "sourceId": "AML.T0001",
    "sourceTableId": "...",
    "targetFramework": "ATTACK",
    "targetId": "T1592",
    "targetTableId": "...",
    "mappingType": "related",
    "confidence": 0.8
  }'
```

### Operation Coverage Tracking

```bash
# Get operation framework coverage
curl http://localhost:3001/api/v1/framework-mappings/coverage/{operationId} | jq '.'

# Update operation coverage
curl -X POST http://localhost:3001/api/v1/framework-mappings/coverage \
  -H "Content-Type: application/json" \
  -d '{
    "operationId": "...",
    "frameworkType": "ATLAS",
    "frameworkElementId": "...",
    "frameworkElementExternalId": "AML.T0001",
    "coverageStatus": "tested",
    "notes": "Successfully validated prompt injection technique"
  }'
```

## Common Use Cases

### 1. Browse AI/ML Attack Techniques

**Goal:** Understand ATLAS adversarial ML tactics

```bash
# List all ATLAS tactics
curl http://localhost:3001/api/v1/atlas/tactics | jq '.[] | {id: .atlasId, name: .name}'

# Get techniques for specific tactic
curl "http://localhost:3001/api/v1/atlas/techniques?tacticId={tacticId}" | jq '.'
```

### 2. Review LLM Security Risks

**Goal:** Assess OWASP LLM Top 10 vulnerabilities

```bash
# Get all vulnerabilities with risk ratings
curl http://localhost:3001/api/v1/owasp-llm/vulnerabilities | \
  jq '.[] | {id: .owaspId, name: .name, risk: .riskRating}'

# Get detailed vulnerability info
curl http://localhost:3001/api/v1/owasp-llm/vulnerabilities/{id} | \
  jq '{name, examples: .commonExamples, preventions: .preventionStrategies}'
```

### 3. Implement AI Risk Management

**Goal:** Follow NIST AI RMF framework

```bash
# Get all RMF functions
curl http://localhost:3001/api/v1/nist-ai/functions | \
  jq '.[] | {id: .functionId, name: .name, description: .description}'

# Get detailed function with categories
curl http://localhost:3001/api/v1/nist-ai/functions/{id} | \
  jq '{function: .name, categories: .categories[] | {id: .categoryId, name: .name}}'
```

### 4. Cross-Reference Frameworks

**Goal:** Map OWASP LLM vulnerabilities to ATLAS techniques

```bash
# Get mappings for LLM01 (Prompt Injection)
curl http://localhost:3001/api/v1/framework-mappings/OWASP_LLM/LLM01 | jq '.'
```

## Troubleshooting

### Import Fails

**Problem:** Import returns error

**Solution:**
```bash
# Check if file exists
ls -lh docs/enhancements/2.3/framework/Atlas_Matrix.json

# Check database connection
curl http://localhost:3001/api/v1/health

# Check server logs
# Terminal running npm run dev
```

### Stats Show Zero

**Problem:** Stats endpoint returns all zeros

**Solution:**
```bash
# Import the framework first
curl -X POST http://localhost:3001/api/v1/atlas/import

# Verify import succeeded
curl http://localhost:3001/api/v1/atlas/stats
```

### Frontend Page Not Loading

**Problem:** Framework page shows 404

**Solution:**
```bash
# Verify route registered in App.tsx
grep -n "atlas\|owasp-llm\|nist-ai" client/src/App.tsx

# Check frontend server running
curl http://localhost:5000

# Clear browser cache and reload
```

### Database Schema Mismatch

**Problem:** TypeScript errors about missing tables

**Solution:**
```bash
# Regenerate Drizzle types
npm run db:push

# Restart TypeScript server in IDE
```

## Development Tips

### Adding Custom Framework Data

1. Create parser service in `server/services/{framework}-parser.ts`
2. Define data structure interface
3. Implement import function
4. Add API routes in `server/api/v1/{framework}.ts`
5. Register routes in `server/index.ts`
6. Create frontend page in `client/src/pages/{Framework}.tsx`
7. Add route to `client/src/App.tsx`

### Extending Framework Mappings

```typescript
// Add mapping programmatically
await db.insert(frameworkMappings).values({
  sourceFramework: 'ATLAS',
  sourceId: 'AML.T0001',
  sourceTableId: atlasId,
  targetFramework: 'ATTACK',
  targetId: 'T1592',
  targetTableId: attackId,
  mappingType: 'related',
  confidence: 0.8,
  description: 'Both involve reconnaissance phase'
});
```

### Querying Framework Data

```typescript
// Get ATLAS techniques with tactic info
const techniques = await db
  .select()
  .from(atlasTechniques)
  .leftJoin(atlasTactics, eq(atlasTechniques.tacticId, atlasTactics.id));

// Get OWASP vulnerability with mitigations
const vuln = await db.query.owaspLlmVulnerabilities.findFirst({
  where: eq(owaspLlmVulnerabilities.id, vulnId),
  with: {
    mitigations: true,
    attackVectors: true
  }
});
```

## Next Steps

After completing Phase 5 setup:

1. **Explore Frameworks** - Browse ATLAS, OWASP LLM, NIST AI RMF
2. **Map Operations** - Link operations to framework elements
3. **Track Coverage** - Monitor framework coverage per operation
4. **Cross-Reference** - Identify relationships between frameworks
5. **Generate Reports** - Include framework analysis in reports

For v2.4 enhancements, see:
- `docs/enhancements/2.4/automated-framework-analysis.md`
- `docs/enhancements/2.4/ai-powered-mapping.md`
- `docs/enhancements/2.4/multi-framework-visualization.md`

## Support

For issues or questions:
- Check implementation summary: `docs/enhancements/2.3/phase-5-implementation-summary.md`
- Review verification checklist: `docs/enhancements/2.3/phase-5-verification-checklist.md`
- Check API documentation: http://localhost:3001/api/v1 (when server running)

## Version Info

- **Phase:** 5 of 7 (RTPI v2.3)
- **Implementation Date:** 2026-02-11
- **ATLAS Version:** MITRE ATLAS Matrix (2024)
- **OWASP LLM Version:** Top 10 v1.1
- **NIST AI RMF Version:** AI 100-1 (2023)
