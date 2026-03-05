# RTPI Nexus Restart Setup Guide

This guide explains how to set up automatic RTPI Nexus restarts at system startup and daily at 3:30 AM CST.

## What This Does

The `rtpi-nexus-restart.sh` script:
- Gracefully stops all RTPI services (backend, frontend, RKLLama)
- Waits for processes to fully terminate
- Restarts all services in the correct order
- Logs all operations to timestamped log files
- Cleans up old log files (>30 days)

## Installation

### 1. Set Up Systemd Service for Startup

Copy the service file and enable it:

```bash
# Copy service file to systemd directory
sudo cp /home/cmndcntrl/code/rtpi/scripts/rtpi-nexus-restart.service /etc/systemd/system/

# Reload systemd to recognize the new service
sudo systemctl daemon-reload

# Enable the service to run at startup
sudo systemctl enable rtpi-nexus-restart.service

# Check status
sudo systemctl status rtpi-nexus-restart.service
```

### 2. Set Up Daily Cron Job (3:30 AM CST)

Add a cron job to run the script daily at 3:30 AM:

```bash
# Edit crontab
crontab -e

# Add this line (3:30 AM CST = 9:30 UTC during DST, 10:30 UTC during standard time)
# This uses 9:30 UTC which is 3:30 AM CST during daylight saving time
30 9 * * * /home/cmndcntrl/code/rtpi/scripts/rtpi-nexus-restart.sh

# For standard time (when DST is not active), use:
# 30 10 * * * /home/cmndcntrl/code/rtpi/scripts/rtpi-nexus-restart.sh
```

**Note:** The system timezone may vary. To check your current timezone:

```bash
timedatectl
```

Adjust the cron time accordingly. For example:
- If system is in UTC and you want 3:30 AM CST:
  - During DST: `30 8 * * *` (CST is UTC-5)
  - During Standard: `30 9 * * *` (CST is UTC-6)

### Alternative: Use Both Cron Times for Year-Round Coverage

To handle both DST and standard time automatically:

```bash
# In crontab -e, add:
30 8 * 3-11 * /home/cmndcntrl/code/rtpi/scripts/rtpi-nexus-restart.sh  # DST period
30 9 * 1-2,12 * /home/cmndcntrl/code/rtpi/scripts/rtpi-nexus-restart.sh  # Standard time period
```

## Testing

### Test the Script Manually

```bash
# Run the script directly
/home/cmndcntrl/code/rtpi/scripts/rtpi-nexus-restart.sh

# Check the log output
tail -f /home/cmndcntrl/code/rtpi/logs/nexus-restart-*.log
```

### Test the Systemd Service

```bash
# Test running the service
sudo systemctl start rtpi-nexus-restart.service

# Check status
sudo systemctl status rtpi-nexus-restart.service

# View logs
sudo journalctl -u rtpi-nexus-restart.service -f
```

### Verify Running Processes

After restart, check that all services are running:

```bash
ps aux | grep -E "(tsx watch|node.*vite|rkllama_server)" | grep -v grep
```

You should see:
- `tsx watch server/index.ts` (backend)
- `node .../vite` (frontend)
- `rkllama_server` (AI service)

## Logs

All restart operations are logged to:
- Main logs: `/home/cmndcntrl/code/rtpi/logs/nexus-restart-YYYYMMDD-HHMMSS.log`
- Backend logs: `/home/cmndcntrl/code/rtpi/logs/backend.log`
- Frontend logs: `/home/cmndcntrl/code/rtpi/logs/frontend.log`
- RKLLama logs: `/home/cmndcntrl/code/rtpi/logs/rkllama.log`

View recent restart logs:

```bash
# List recent logs
ls -lth /home/cmndcntrl/code/rtpi/logs/nexus-restart-*.log | head -5

# View latest log
tail -100 /home/cmndcntrl/code/rtpi/logs/nexus-restart-*.log | tail -1
```

## Troubleshooting

### Script Fails to Stop Services

If services don't stop gracefully:
- Check for zombie processes: `ps aux | grep -E "(tsx|vite|rkllama)" | grep -v grep`
- Manually kill stubborn processes: `pkill -9 -f "tsx watch"`

### Services Don't Start

Check the individual service logs:
```bash
tail -f /home/cmndcntrl/code/rtpi/logs/backend.log
tail -f /home/cmndcntrl/code/rtpi/logs/frontend.log
```

Common issues:
- Port already in use (check with `netstat -tulpn | grep -E "(5000|5173|11434)"`)
- Permission issues (ensure script is executable: `chmod +x scripts/rtpi-nexus-restart.sh`)
- Missing dependencies (run `npm install` in RTPI directory)

### RKLLama Requires Sudo

If RKLLama restart requires sudo privileges, add to `/etc/sudoers.d/rtpi`:

```bash
# Create sudoers file
sudo visudo -f /etc/sudoers.d/rtpi

# Add this line:
cmndcntrl ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart rkllama.service
```

### Cron Job Not Running

Check cron logs:
```bash
grep CRON /var/log/syslog | grep rtpi-nexus-restart
```

Verify crontab:
```bash
crontab -l | grep rtpi-nexus-restart
```

## Uninstalling

To remove the automatic restart setup:

```bash
# Disable and remove systemd service
sudo systemctl disable rtpi-nexus-restart.service
sudo rm /etc/systemd/system/rtpi-nexus-restart.service
sudo systemctl daemon-reload

# Remove cron job
crontab -e
# Delete the rtpi-nexus-restart.sh line

# Optionally remove script (not recommended)
# rm /home/cmndcntrl/code/rtpi/scripts/rtpi-nexus-restart.sh
```

## Security Considerations

- Script runs as user `cmndcntrl` (not root)
- Logs contain no sensitive information
- Script only restarts RTPI services, doesn't modify system files
- Old logs are automatically cleaned up (>30 days)

## Customization

To modify restart behavior, edit `/home/cmndcntrl/code/rtpi/scripts/rtpi-nexus-restart.sh`:

- Change startup commands in the "Starting RTPI services" section
- Adjust wait times between service restarts
- Add additional services to restart
- Modify log retention period (currently 30 days)
