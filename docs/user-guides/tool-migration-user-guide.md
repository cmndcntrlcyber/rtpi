# Tool Migration User Guide

**Version:** 1.0
**Last Updated:** 2025-12-26
**Audience:** RTPI Users

---

## Overview

The Tool Migration system in RTPI provides a complete solution for migrating security tools from the offsec-team repository into RTPI's native tool ecosystem. This system automates the analysis, migration, and integration of Python security tools.

### What You Can Do

- **Analyze** Python security tools to understand their structure and dependencies
- **Migrate** tools with automated TypeScript wrapper generation
- **Track** migration progress and tool status
- **Browse** the catalog of successfully migrated tools
- **Execute** migrated tools through RTPI's unified interface

---

## Accessing Tool Migration

### Navigation

1. Log in to your RTPI account
2. Click **"Tool Migration"** in the left sidebar (Download icon)
3. Or navigate directly to `/tool-migration`

### Dashboard Overview

The Tool Migration page displays:

- **Summary Cards**: Total tools, complexity breakdown
- **Filter Panel**: Search, category, and complexity filters
- **Tools Table**: All available tools with migration status
- **Action Buttons**: Analyze and Migrate controls

---

## Analyzing Tools

### Quick Analysis

View detailed information about a tool before migrating:

1. **Find Your Tool** in the tools table
2. Click **"Analyze"** button
3. Review the analysis dialog showing:
   - Tool metadata (name, class, category)
   - Public methods and parameters
   - Dependencies and install requirements
   - Migration complexity estimate

### Understanding Analysis Data

**Tool Information:**
- **Tool Name**: The Python module name
- **Class Name**: The main class exported by the tool
- **Category**: Tool classification (scanning, web-application, etc.)
- **Complexity**: Effort estimate (low, medium, high, very-high)

**Methods:**
- Lists all public methods available
- Shows parameters required for each method
- Displays return types

**Dependencies:**
- Python packages required
- Installation method (usually `pip`)
- Version requirements (if specified)

**Migration Requirements:**
- TypeScript wrapper generation (always required)
- Dependency installation (if packages needed)
- External service configuration (if API integration needed)
- Test suite availability

---

## Migrating Tools

### Single Tool Migration

To migrate an individual tool:

1. **Select the Tool** from the table
2. Click **"Migrate"** button
3. **Configure Migration Options**:
   - ✅ **Generate TypeScript Wrapper** (required)
   - ✅ **Install Python Dependencies** (recommended if tool has dependencies)
   - ✅ **Run Tests After Migration** (if tests are available)
   - ✅ **Register in Tool Registry** (required for tool execution)
   - ☐ **Overwrite Existing Tool** (if tool was previously migrated)
4. **Review Migration Steps** in the preview
5. Click **"Start Migration"**
6. **Monitor Progress** via toast notifications

### Migration Process

When you initiate a migration, RTPI performs these steps automatically:

1. **Dependency Installation** (if enabled)
   - Installs Python packages using pip
   - Validates successful installation

2. **TypeScript Wrapper Generation**
   - Analyzes the Python tool structure
   - Generates a TypeScript wrapper class
   - Creates spawn-based Python execution bridge
   - Saves to `server/services/python-tools/`

3. **Test Execution** (if enabled and tests exist)
   - Runs the Python test suite
   - Reports pass/fail status
   - Continues migration even if tests fail (with warning)

4. **Database Registration**
   - Adds tool to RTPI's tool registry
   - Stores metadata (complexity, category, wrapper path)
   - Marks tool as available for execution

### Migration Options Explained

**Generate TypeScript Wrapper** (Required)
- Creates a TypeScript interface to the Python tool
- Enables execution through RTPI's tool system
- Always recommended to enable

**Install Python Dependencies**
- Automatically installs required Python packages
- Required for tools with external dependencies
- May fail if packages are unavailable
- Disable for tools with no dependencies

**Run Tests After Migration**
- Validates tool functionality
- Only works if tool has a test suite
- Failures are reported but don't block migration
- Recommended for quality assurance

**Register in Tool Registry** (Required)
- Makes tool available in RTPI
- Required for tool execution
- Stores tool metadata
- Always recommended to enable

**Overwrite Existing Tool**
- Replaces previously migrated tool
- Use when updating an existing migration
- Prevents "already exists" errors
- Leave disabled by default

---

## Migration Status

### Checking Migration Status

After migration, view tool status:

1. **Success Notification**
   - Green toast: "Migration Successful"
   - Tool name and completion message

2. **Tool Registry**
   - Navigate to Tools > Tool Registry
   - Find your migrated tool
   - Status should show "available"

3. **Migration Errors**
   - Red toast: "Migration Failed"
   - Error details in notification
   - Check logs for troubleshooting

### Common Migration Outcomes

**✅ Completed**
- All steps executed successfully
- Tool registered in database
- Wrapper generated
- Ready for use

**⚠️ Completed with Warnings**
- Migration succeeded overall
- Some non-critical steps failed
- Example: Tests failed but wrapper created
- Tool may still be usable

**❌ Failed**
- Migration could not complete
- No database registration
- Review error message
- Check admin guide for troubleshooting

---

## Browsing Migrated Tools

### Tool Catalog

View all successfully migrated tools:

1. Scroll down to **"Migrated Tools Catalog"** section
2. Use filters to narrow results:
   - **Search**: Filter by tool name or description
   - **Category**: Filter by tool category
3. Click **"View Details"** for any tool

### Tool Details

Each migrated tool shows:

- **Name and Version**
- **Category** (scanning, web-application, etc.)
- **Status** (available, unavailable, deprecated)
- **Complexity** rating
- **Migration Date**
- **Wrapper Path** (TypeScript wrapper location)
- **Python Module** (original Python file location)

---

## Executing Migrated Tools

### From Tool Registry

1. Navigate to **Tools > Tool Registry**
2. Find your migrated tool
3. Click **"Execute"**
4. Provide required parameters
5. View execution results

### From Operations

1. Create or open an Operation
2. Add a target
3. Select "Execute Tool"
4. Choose your migrated tool
5. Configure parameters
6. Run execution

### Execution Workflow

Migrated tools execute through this process:

1. **Parameter Validation**
   - RTPI validates all required parameters
   - Type checking based on tool schema

2. **Python Spawn**
   - TypeScript wrapper spawns Python process
   - Passes parameters as JSON
   - Executes tool method

3. **Result Collection**
   - Captures stdout and stderr
   - Parses JSON output
   - Returns to RTPI

4. **Result Storage**
   - Stores execution result in database
   - Associates with target/operation
   - Available in reports

---

## Filtering and Search

### Quick Search

Use the search bar to find tools by:
- Tool name
- Class name
- Description text

**Example:** Type "vulnerability" to find all vulnerability-related tools

### Category Filter

Filter tools by category:
- **scanning**: Reconnaissance and discovery tools
- **web-application**: Web app testing tools
- **network-analysis**: Network traffic tools
- **reporting**: Report generation tools
- **research**: Threat intelligence tools

### Complexity Filter

Filter by migration complexity:
- **Low**: Simple tools, quick migration (~1 day)
- **Medium**: Moderate complexity (~2-3 days)
- **High**: Complex tools (~4-7 days)
- **Very High**: Advanced tools (8+ days)

### Clear Filters

Click **"Clear Filters"** to reset all filters and show all tools.

---

## Recommendations

### Priority Tools

RTPI recommends tools based on:

- **Category Priority**: scanning and web-application tools ranked higher
- **Complexity Bonus**: Lower complexity tools preferred for quick wins
- **Test Availability**: Tools with tests rank higher
- **External Services**: Tools without external dependencies preferred
- **High-Value Tools**: Specific critical tools get bonus points

### Recommended Tools List

Tools marked with ⭐ (star icon) are recommended for migration based on the priority scoring system.

**Top Recommendations Typically Include:**
- WebVulnerabilityTester
- VulnerabilityReportGenerator
- BurpSuiteAPIClient
- FrameworkSecurityAnalyzer

---

## Best Practices

### Before Migration

1. **Review Analysis** first
   - Understand dependencies
   - Check complexity estimate
   - Review method signatures

2. **Plan for Dependencies**
   - Ensure Python 3.8+ is installed
   - Check pip availability
   - Verify network access for package downloads

3. **Consider External Services**
   - Some tools require Burp Suite
   - API keys may be needed
   - Check tool requirements

### During Migration

1. **Enable Dependencies Installation**
   - Unless tool has no dependencies
   - Speeds up tool readiness

2. **Run Tests When Available**
   - Validates tool functionality
   - Identifies migration issues early

3. **Monitor Notifications**
   - Watch for success/failure toasts
   - Note any warnings

### After Migration

1. **Verify in Tool Registry**
   - Check tool appears
   - Confirm "available" status

2. **Test Execution**
   - Run tool with sample data
   - Verify results are correct

3. **Review Wrapper Code** (Optional)
   - Check `server/services/python-tools/`
   - Understand execution flow

---

## Common Use Cases

### Scenario 1: Migrating Scanning Tools

**Goal:** Add reconnaissance tools to RTPI

1. Filter by category: "scanning"
2. Review recommended tools (⭐)
3. Select WebVulnerabilityTester
4. Click "Analyze" to review
5. Click "Migrate" with defaults
6. Wait for completion notification
7. Test in Tool Registry

### Scenario 2: Batch Migration

**Goal:** Migrate all tools in a category

1. Use API endpoint directly (see Admin Guide)
2. Or migrate individually through UI
3. Monitor each migration
4. Review summary when complete

### Scenario 3: Updating Existing Tool

**Goal:** Re-migrate a tool after updates

1. Find the tool in table
2. Click "Migrate"
3. **Enable "Overwrite Existing Tool"**
4. Start migration
5. Verify updates applied

---

## Troubleshooting

### Migration Fails

**Problem:** Migration shows "Failed" status

**Solutions:**
1. Check error message in toast notification
2. Verify tool file exists in offsec-team repository
3. Check Python dependencies are available
4. Review admin documentation for detailed logs
5. Try migration without dependency installation
6. Contact administrator if issue persists

### Tool Not Appearing

**Problem:** Migrated tool doesn't show in Tool Registry

**Solutions:**
1. Verify "Register in Tool Registry" was enabled
2. Refresh the Tool Registry page
3. Check Database Registration step completed
4. Search by exact tool name
5. Review migration status via API

### Execution Errors

**Problem:** Tool fails when executed

**Solutions:**
1. Verify all dependencies installed
2. Check Python environment is correct
3. Review wrapper code for issues
4. Test Python tool directly
5. Check tool logs for errors

### Dependency Installation Fails

**Problem:** "Dependency installation failed" warning

**Solutions:**
1. Verify pip is installed: `pip --version`
2. Check network connectivity
3. Try manual installation: `pip install <package>`
4. Use migration without dependency installation
5. Install dependencies manually after migration

---

## FAQs

**Q: Can I migrate tools from other repositories?**
A: Currently, migration is designed for offsec-team tools. Custom tool migration requires admin assistance.

**Q: What if a tool requires external services?**
A: Some tools need Burp Suite, API keys, or other services. Check the analysis for "External Services Required" and configure accordingly.

**Q: Can I edit migrated tools?**
A: The TypeScript wrappers can be manually edited in `server/services/python-tools/`. Use caution and test thoroughly.

**Q: How do I remove a migrated tool?**
A: Use the Tool Registry to delete tools. This removes the database entry but not the wrapper file.

**Q: Are there limits on concurrent migrations?**
A: Migrations run sequentially. Batch migrations process one tool at a time to ensure stability.

**Q: Can I migrate the same tool twice?**
A: Yes, enable "Overwrite Existing Tool" option. This updates the existing registration.

**Q: What Python version is required?**
A: Python 3.8 or higher is required for tool execution.

**Q: Where are wrapper files stored?**
A: TypeScript wrappers are saved to `server/services/python-tools/<ToolName>.ts`

**Q: Can I use migrated tools in agents?**
A: Yes! Migrated tools appear in the Tool Registry and can be used by RTPI agents.

---

## Next Steps

### Learn More

- **Admin Guide**: For advanced configuration and troubleshooting
- **Tool Registry Guide**: For executing and managing tools
- **Agent Guide**: For using tools in automated workflows

### Get Help

- **In-App Support**: Use the help menu
- **Documentation**: `/docs/user-guides/`
- **Administrator**: Contact your RTPI administrator

### Contribute

- Report issues with migrations
- Suggest priority tools for migration
- Share successful migration workflows

---

## Summary

The Tool Migration system makes it easy to integrate Python security tools from offsec-team into RTPI:

1. **Analyze** tools to understand requirements
2. **Migrate** with automated wrapper generation
3. **Track** progress and status
4. **Execute** through RTPI's unified interface
5. **Monitor** results and performance

For technical details and troubleshooting, refer to the Admin Guide.
