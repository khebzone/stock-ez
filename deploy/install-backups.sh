#!/usr/bin/env bash
# ============================================================
#  Installs the StockEz backup cron job (every 5 minutes).
#  Run as the stockez user after configuring rclone + backup.env.
# ============================================================
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "$0")" && pwd)"
sudo mkdir -p /opt/stockez/backups
sudo cp "$DEPLOY_DIR/backup.sh"  /opt/stockez/backup.sh
sudo cp "$DEPLOY_DIR/restore.sh" /opt/stockez/restore.sh
sudo chmod +x /opt/stockez/backup.sh /opt/stockez/restore.sh

# backup.env holds the encryption passphrase + settings (create if missing)
if [ ! -f /opt/stockez/backup.env ]; then
  PASS=$(openssl rand -base64 32)
  sudo tee /opt/stockez/backup.env >/dev/null <<EOF
# StockEz backup config
PG_CONTAINER=stockez-postgres
DB_NAME=stockez
DB_USER=stockez
ENC_PASSPHRASE=$PASS
R2_REMOTE=r2
R2_BUCKET=stockez-backups
GDRIVE_REMOTE=gdrive
EOF
  sudo chmod 600 /opt/stockez/backup.env
  echo ">>> Generated encryption passphrase in /opt/stockez/backup.env"
  echo ">>> IMPORTANT: copy ENC_PASSPHRASE somewhere safe (a password manager)."
  echo ">>> Without it, your encrypted backups CANNOT be restored."
fi

# cron: every 5 minutes
CRON_LINE="*/5 * * * * /opt/stockez/backup.sh >> /var/log/stockez-backup.log 2>&1"
( crontab -l 2>/dev/null | grep -v '/opt/stockez/backup.sh'; echo "$CRON_LINE" ) | crontab -
sudo touch /var/log/stockez-backup.log

echo "Backup cron installed (every 5 minutes)."
echo "Test it now:  /opt/stockez/backup.sh  &&  tail /var/log/stockez-backup.log"
