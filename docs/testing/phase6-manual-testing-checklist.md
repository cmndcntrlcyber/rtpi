# Phase 6 Manual Testing Checklist
**Version:** v2.3.6
**Feature:** Vulnerability Investigation Workflow & BurpSuite Integration

Use this checklist to manually verify Phase 6 functionality. Check off items as you complete them.

---

## Pre-Testing Setup

### Environment Verification
- [ ] All Docker containers are running: `docker compose ps`
- [ ] Database migrations applied (check burp_setup table exists)
- [ ] Server is accessible at http://localhost:3001
- [ ] Frontend is accessible at http://localhost:5000
- [ ] You have admin credentials
- [ ] At least one operation exists with targets

### Required Test Files
- [ ] BurpSuite Pro JAR file available (burpsuite_pro_*.jar)
- [ ] Valid BurpSuite Pro license file (.txt format)
- [ ] License is not expired

### Optional Configuration
- [ ] TAVILY_API_KEY configured in .env (recommended for full testing)
- [ ] Ollama/RKLLama running with models loaded
- [ ] Internet connectivity available

---

## Test Session 1: BurpSuite Activation System

### 1.1 Initial Status Check
- [ ] Navigate to Surface Assessment → Overview tab
- [ ] Locate "BurpSuite Pro Activation" panel
- [ ] Verify status badge shows "Dormant" (gray)
- [ ] Verify "Activate BurpSuite" button is disabled

### 1.2 JAR Upload
- [ ] Click or drag-and-drop JAR file into upload area
- [ ] Verify upload progress indicator appears
- [ ] Verify success toast notification
- [ ] Verify file info card shows:
  - [ ] Filename
  - [ ] File size
  - [ ] SHA-256 hash
- [ ] Verify status still shows "Dormant"
- [ ] Verify "Activate BurpSuite" button still disabled (license missing)

### 1.3 License Upload
- [ ] Click or drag-and-drop license file into upload area
- [ ] Verify upload success notification
- [ ] Verify license info card shows:
  - [ ] License type (Pro/Enterprise)
  - [ ] Expiry date
- [ ] Verify "Activate BurpSuite" button is now ENABLED

### 1.4 Activation
- [ ] Click "Activate BurpSuite" button
- [ ] Verify status changes to "Activating" (yellow)
- [ ] Wait for health check (max 60 seconds)
- [ ] Verify status changes to "Active" (green)
- [ ] Verify MCP server URL populated
- [ ] Verify button text changed to "Deactivate BurpSuite"
- [ ] Check browser console for polling logs (optional)

### 1.5 Health Check Validation
Open terminal and run:
```bash
# Check container logs
docker logs rtpi-burp-agent --tail 50

# Verify activation flag
docker exec rtpi-burp-agent ls -la /opt/burp-setup/.activate

# Test MCP server
docker exec rtpi-burp-agent curl -sf http://localhost:9876/health
```

- [ ] Activation flag file exists
- [ ] MCP server responds with 200 OK
- [ ] Burp Pro process is running

### 1.6 Deactivation
- [ ] Click "Deactivate BurpSuite" button
- [ ] Confirm in dialog
- [ ] Verify status changes back to "Dormant"
- [ ] Verify MCP health check fails (expected)
- [ ] Verify button text changed to "Activate BurpSuite"

### 1.7 File Removal
- [ ] Click "Remove" on JAR file card
- [ ] Verify file info cleared
- [ ] Re-upload JAR file
- [ ] Click "Remove" on License file card
- [ ] Verify license info cleared
- [ ] Verify "Activate BurpSuite" button disabled

**Session 1 Score:** _____ / 22 checks passed

---

## Test Session 2: Automatic Investigation Workflow

### 2.1 Setup
- [ ] Re-activate BurpSuite (if deactivated in Session 1)
- [ ] Verify status shows "Active"
- [ ] Ensure you have an active operation with at least one target

### 2.2 Create High Severity Vulnerability
- [ ] Navigate to Vulnerabilities page
- [ ] Click "Add Vulnerability" button
- [ ] Fill in details:
  - Title: "Test SQL Injection - Auto Investigation"
  - Description: "Testing automatic investigation trigger"
  - Severity: **High**
  - CVE ID: "CVE-2024-TEST-AUTO"
  - Operation: Select your test operation
  - Target: Select a target
- [ ] Click "Create"

### 2.3 Observe Automatic Investigation
Watch server logs in terminal:
```bash
docker compose logs -f server | grep -E "(Investigation Workflow|R&D Team|BurpSuite Orchestrator)"
```

- [ ] Vulnerability appears in list
- [ ] Investigation status badge shows "Pending" initially
- [ ] Within 5 seconds, status changes to "Investigating"
- [ ] Logs show workflow triggered
- [ ] Logs show R&D Team checking for template
- [ ] Logs show R&D Team researching CVE (if TAVILY_API_KEY set)
- [ ] Logs show BurpSuite Orchestrator investigating
- [ ] Status eventually changes to "Validated", "False Positive", or "Inconclusive"

### 2.4 Verify Investigation Results
- [ ] Click on the vulnerability to view details
- [ ] Verify "Investigation" tab/section exists
- [ ] Verify investigation timestamps shown:
  - [ ] Assigned At
  - [ ] Completed At
- [ ] Verify validation evidence panel shows:
  - [ ] Evidence type
  - [ ] Description
  - [ ] Indicators (if any)
  - [ ] Timestamp
- [ ] Verify agent ID is populated
- [ ] Verify Burp scan reference (if available)

### 2.5 Severity Gating Test
- [ ] Create another vulnerability with **Low** severity
- [ ] Wait 10 seconds
- [ ] Verify investigation status remains "Pending" (should NOT auto-trigger)
- [ ] Check logs confirm: "Severity below investigation threshold"

**Session 2 Score:** _____ / 19 checks passed

---

## Test Session 3: R&D Team Agent

### 3.1 CVE Research Test
Open terminal and run:
```bash
curl -X POST http://localhost:3001/api/v1/agents/rd-team/execute \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=YOUR_SESSION" \
  -d '{
    "taskType": "cve_research",
    "operationId": "YOUR_OPERATION_ID",
    "parameters": {
      "cveId": "CVE-2024-1234",
      "description": "SQL Injection vulnerability"
    }
  }'
```

- [ ] API returns 200 OK
- [ ] Response includes research data
- [ ] CVE ID matches input
- [ ] References array populated (if Tavily available)

### 3.2 Nuclei Template Generation Test
```bash
curl -X POST http://localhost:3001/api/v1/agents/rd-team/execute \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=YOUR_SESSION" \
  -d '{
    "taskType": "nuclei_template_generation",
    "operationId": "YOUR_OPERATION_ID",
    "parameters": {
      "cveId": "CVE-2024-TEMPLATE-TEST",
      "description": "XSS in search parameter",
      "severity": "high"
    }
  }'
```

- [ ] API returns 200 OK
- [ ] Response includes templateId
- [ ] Response includes yamlContent
- [ ] YAML contains "id:" field
- [ ] YAML contains "info:" section
- [ ] Response shows deployed: true

### 3.3 Verify Template in Database
```bash
docker compose exec -T postgres psql -U rtpi -d rtpi_main -c \
  "SELECT template_id, name, severity, generated_by_ai FROM nuclei_templates WHERE generated_by_ai = true LIMIT 5;"
```

- [ ] Template appears in database
- [ ] generated_by_ai = true
- [ ] is_custom = true
- [ ] Metadata includes AI provider info

### 3.4 Verify Template Deployed to Container
```bash
docker exec rtpi-tools ls -lah /home/rtpi-tools/nuclei-templates/custom/
```

- [ ] Custom templates directory exists
- [ ] Generated template file exists
- [ ] File is readable YAML format

**Session 3 Score:** _____ / 12 checks passed

---

## Test Session 4: BurpSuite Orchestrator Agent

### 4.1 Manual Investigation Trigger
- [ ] Navigate to Vulnerabilities page
- [ ] Find a medium+ severity vulnerability with status "Pending"
- [ ] Click "Investigate" button (if visible)
- [ ] Verify toast notification: "Investigation triggered"
- [ ] Verify status badge changes to "Investigating"
- [ ] Wait 5-10 seconds
- [ ] Refresh page
- [ ] Verify status updated (Validated/False Positive/Inconclusive)

### 4.2 Review Investigation Evidence
- [ ] Click on investigated vulnerability
- [ ] Open investigation details panel
- [ ] Verify evidence section populated:
  - [ ] Evidence type shown
  - [ ] Description text
  - [ ] Indicators list (may be empty)
  - [ ] Timestamp
- [ ] If validated, verify positive indicators shown
- [ ] If false positive, verify no indicators or contradictory evidence

### 4.3 Dormancy Behavior Test
- [ ] Deactivate BurpSuite (Surface Assessment → Overview)
- [ ] Create new high-severity vulnerability
- [ ] Observe investigation workflow
- [ ] Verify R&D Team Agent still runs (if no template exists)
- [ ] Verify BurpSuite Orchestrator is **skipped** (dormant)
- [ ] Verify status remains "Investigating" (not completed)
- [ ] Check logs: "BurpSuite not active, skipping Burp delegation"

### 4.4 Re-activate and Continue
- [ ] Re-activate BurpSuite
- [ ] Manually trigger investigation on the pending vulnerability
- [ ] Verify BurpSuite Orchestrator now executes
- [ ] Verify investigation completes

**Session 4 Score:** _____ / 17 checks passed

---

## Test Session 5: End-to-End Integration

### 5.1 Complete BBOT Scan Flow
- [ ] Create new operation: "Phase 6 E2E Test"
- [ ] Add target: `testphp.vulnweb.com`
- [ ] Navigate to Surface Assessment
- [ ] Start BBOT scan with Nuclei modules enabled
- [ ] Wait for scan completion (5-10 minutes)
- [ ] Navigate to Vulnerabilities page
- [ ] Verify vulnerabilities created (5-15 expected)
- [ ] Verify medium+ vulns show "Investigating" status
- [ ] Wait 2-3 minutes for investigations to complete
- [ ] Refresh page
- [ ] Verify status badges updated (Validated/False Positive)
- [ ] Click on a validated vulnerability
- [ ] Verify investigation evidence populated

### 5.2 Operations Manager Integration
- [ ] Navigate to Operations page
- [ ] Click on "Phase 6 E2E Test" operation
- [ ] Click "Open Chat" button (floating chat)
- [ ] Verify chat window opens
- [ ] Check for any blocker messages from agents
- [ ] If blockers exist, read details
- [ ] Close chat window

### 5.3 Batch Investigation Test
Open terminal:
```bash
curl -X POST http://localhost:3001/api/v1/vulnerability-investigation/batch/YOUR_OPERATION_ID \
  -H "Cookie: connect.sid=YOUR_SESSION"
```

- [ ] API returns 200 OK
- [ ] Response shows total count
- [ ] Response shows investigated count
- [ ] Response shows skipped count
- [ ] Navigate to Vulnerabilities page
- [ ] Verify all medium+ vulns have been processed

**Session 5 Score:** _____ / 17 checks passed

---

## Test Session 6: Error Handling & Edge Cases

### 6.1 Network Failure Handling
- [ ] Stop rtpi-burp-agent container: `docker stop rtpi-burp-agent`
- [ ] Create high-severity vulnerability
- [ ] Observe investigation behavior
- [ ] Verify no crash or hang
- [ ] Verify status becomes "Inconclusive" or remains "Investigating"
- [ ] Restart container: `docker start rtpi-burp-agent`

### 6.2 Missing API Key Test
- [ ] Temporarily remove TAVILY_API_KEY from .env
- [ ] Restart server
- [ ] Create vulnerability with unknown CVE
- [ ] Observe logs: Should show "TAVILY_API_KEY not configured"
- [ ] Verify graceful degradation (no crash)
- [ ] Restore TAVILY_API_KEY
- [ ] Restart server

### 6.3 Invalid File Upload Tests
- [ ] Try uploading a .txt file as JAR → Should reject
- [ ] Try uploading corrupted license → Should reject or warn
- [ ] Try uploading JAR > 750MB → Should reject with size error

### 6.4 Duplicate Investigation Prevention
- [ ] Create high-severity vulnerability
- [ ] Wait for auto-investigation to start
- [ ] Quickly click "Investigate" button multiple times
- [ ] Verify only one investigation runs
- [ ] Check logs for "Already being investigated" message

**Session 6 Score:** _____ / 13 checks passed

---

## Overall Test Summary

| Test Session | Score | Pass Rate |
|--------------|-------|-----------|
| Session 1: BurpSuite Activation | ___/22 | ____ % |
| Session 2: Automatic Investigation | ___/19 | ____ % |
| Session 3: R&D Team Agent | ___/12 | ____ % |
| Session 4: BurpSuite Orchestrator | ___/17 | ____ % |
| Session 5: E2E Integration | ___/17 | ____ % |
| Session 6: Error Handling | ___/13 | ____ % |
| **TOTAL** | **___/100** | **____ %** |

---

## Issues Found

Document any issues, bugs, or unexpected behavior here:

### Issue 1
**Description:**

**Severity:** Critical / High / Medium / Low

**Steps to Reproduce:**
1. 
2. 
3. 

**Expected Behavior:**

**Actual Behavior:**

**Workaround:**

---

### Issue 2
**Description:**

**Severity:** Critical / High / Medium / Low

**Steps to Reproduce:**
1. 
2. 
3. 

**Expected Behavior:**

**Actual Behavior:**

**Workaround:**

---

## Performance Observations

### Investigation Speed
- Average time for R&D research: _____ seconds
- Average time for template generation: _____ seconds
- Average time for BurpSuite investigation: _____ seconds
- Average total investigation time: _____ seconds

### System Resources
- CPU usage during investigation: _____ %
- Memory usage during investigation: _____ MB
- Container resource consumption: Normal / High / Concerning

---

## Recommendations

Based on testing, list any recommendations for:

### Improvements
1. 
2. 
3. 

### Documentation Updates
1. 
2. 
3. 

### Future Enhancements
1. 
2. 
3. 

---

## Sign-Off

**Tester Name:** _____________________

**Date Completed:** _____________________

**Overall Assessment:** Pass / Pass with Issues / Fail

**Notes:**


---

## Next Steps

After completing manual testing:

1. Update `v2.3-Completion-Verification.md` with results
2. Create issues for any bugs found
3. Run automated test suite: `./scripts/run-phase6-tests.sh all`
4. Review test reports in `test-reports/` directory
5. Update documentation based on findings
