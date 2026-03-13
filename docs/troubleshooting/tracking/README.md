# RTPI Enhancement Tracking System

This directory contains the crash-resistant tracking system for managing all RTPI enhancement implementations.

## Directory Structure

```
docs/tracking/
├── README.md                    # This file
├── master-tracker.md            # Source of truth - hand-edit this file
├── snapshots/                   # Automatic backups every 4 hours
│   ├── 2025-12-19-1400.md
│   └── latest.md               # Symlink to most recent
├── sessions/                    # Daily work session logs
│   └── 2025-12-19-session.md
└── metrics/                     # Progress analytics (auto-generated)
    ├── velocity.json
    └── burndown.json
```

## Quick Start

### View Current Status
```bash
npm run track:status
```

### Mark Item Complete
```bash
npm run track:complete TF-01
```

### Start Working on Item
```bash
npm run track:start TF-02 --assignee yourname --eta 2025-12-20
```

### Create Snapshot
```bash
npm run track:snapshot
```

### Generate Dashboard
```bash
npm run track:dashboard
```

## Files

### master-tracker.md
**The single source of truth**. This is the only file you manually edit.
- Contains all 260 enhancement items across 8 major initiatives
- Organized by enhancement with hierarchical phases
- Each item has unique ID (#TF-01, #ATK-01, etc.)
- Track status with checkboxes and emoji tags

### snapshots/
Automatic backups created every 4 hours during active work.
- Timestamped snapshots preserve history
- `latest.md` symlink points to most recent
- Git-tracked for additional versioning
- Keep last 30 snapshots automatically

### sessions/
Daily work logs documenting what was accomplished.
- One file per day: `YYYY-MM-DD-session.md`
- Record goals, completions, blockers, issues
- Helps track velocity and identify patterns

### metrics/
Auto-generated analytics (JSON format).
- `velocity.json` - Items per day, completion trends
- `burndown.json` - Progress toward completion
- Used for reporting and projections

## Recovery After Crash

### Quick Recovery (Latest Snapshot)
```bash
cp docs/tracking/snapshots/latest.md docs/tracking/master-tracker.md
```

### Recovery from Specific Snapshot
```bash
ls docs/tracking/snapshots/
cp docs/tracking/snapshots/2025-12-19-1400.md docs/tracking/master-tracker.md
```

### Recovery from Git
```bash
git log -- docs/tracking/master-tracker.md
git checkout abc123f -- docs/tracking/master-tracker.md
```

## Item ID Format

Each enhancement has its own prefix:
- **Tool Framework:** #TF-01 to #TF-25
- **ATT&CK Integration:** #ATK-01 to #ATK-40
- **Agentic Implants:** #AI-01 to #AI-30
- **UI/UX Improvements:** #UI-01 to #UI-30
- **OffSec Team R&D:** #OT-01 to #OT-25
- **Empire C2:** #EX-01 to #EX-35
- **Kasm Workspaces:** #KW-01 to #KW-45
- **Ollama AI:** #OL-01 to #OL-30

## Status Tags

- 📋 Not Started
- ⏳ In Progress (assigned and active)
- ✅ Complete (with completion date)
- 🚫 Blocked (with blocker reason)
- ⏸️ Paused
- ⚠️ At Risk

## Best Practices

### DO
✅ Commit tracking updates with meaningful messages
✅ Create snapshots before major changes
✅ Update session logs daily
✅ Use scripts for consistency
✅ Validate tracker regularly

### DON'T
❌ Edit multiple tracking files simultaneously
❌ Skip git commits
❌ Delete snapshots manually
❌ Store sensitive data in tracker
❌ Manually calculate percentages (use scripts)

## Integration with Git

All tracking files are version-controlled:
```bash
# View tracking history
git log --grep="Track:" --oneline

# See recent changes
git log --since="7 days ago" -- docs/tracking/

# Generate weekly report
git log --grep="Track: Complete" --since="7 days ago"
```

## Automation

### Cron Jobs
```bash
# Snapshot every 4 hours
0 */4 * * * cd /home/cmndcntrl/rtpi && npm run track:snapshot

# Generate dashboard daily at 9 AM
0 9 * * * cd /home/cmndcntrl/rtpi && npm run track:dashboard
```

### NPM Scripts
Add to `package.json`:
```json
{
  "scripts": {
    "track": "./scripts/track.sh",
    "track:complete": "./scripts/track.sh complete",
    "track:start": "./scripts/track.sh start",
    "track:snapshot": "./scripts/track-snapshot.sh",
    "track:status": "./scripts/track.sh status",
    "track:dashboard": "./scripts/generate-dashboard.sh"
  }
}
```

## Support

For issues with the tracking system:
1. Check `npm run track:validate` for integrity issues
2. Review recent git commits for changes
3. Restore from snapshots if corrupted
4. Consult this README for recovery procedures

---

**Last Updated:** 2025-12-19
**Version:** 1.0.0
**Total Items Tracked:** 260 items across 8 enhancements
