#!/usr/bin/env bash
# ============================================================
#  StockEz — server hardening. Run ONCE on a fresh Ubuntu 22.04
#  DigitalOcean droplet, as root:
#     bash harden-server.sh <username> <ssh_port> <your_ip_optional>
#  e.g.  bash harden-server.sh stockez 22 203.0.113.5
#
#  This closes the exact hole that got you hacked (SSH passwords)
#  and locks the server down.
# ============================================================
set -euo pipefail

NEW_USER="${1:-stockez}"
SSH_PORT="${2:-22}"
ADMIN_IP="${3:-}"          # optional: only allow SSH from this IP

echo "==> 1/8 Updating system packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y && apt-get upgrade -y

echo "==> 2/8 Creating sudo user '$NEW_USER' (key-based login)"
if ! id "$NEW_USER" &>/dev/null; then
  adduser --disabled-password --gecos "" "$NEW_USER"
  usermod -aG sudo "$NEW_USER"
fi
mkdir -p "/home/$NEW_USER/.ssh"
cp /root/.ssh/authorized_keys "/home/$NEW_USER/.ssh/authorized_keys" 2>/dev/null || true
chown -R "$NEW_USER:$NEW_USER" "/home/$NEW_USER/.ssh"
chmod 700 "/home/$NEW_USER/.ssh"; chmod 600 "/home/$NEW_USER/.ssh/authorized_keys" 2>/dev/null || true

echo "==> 3/8 Hardening SSH: keys only, no root, no passwords"
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/'        /etc/ssh/sshd_config
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/'                      /etc/ssh/sshd_config
sed -i 's/^#\?KbdInteractiveAuthentication.*/KbdInteractiveAuthentication no/' /etc/ssh/sshd_config
sed -i 's/^#\?ChallengeResponseAuthentication.*/ChallengeResponseAuthentication no/' /etc/ssh/sshd_config
if [ "$SSH_PORT" != "22" ]; then sed -i "s/^#\?Port .*/Port $SSH_PORT/" /etc/ssh/sshd_config; fi
systemctl restart ssh || systemctl restart sshd

echo "==> 4/8 Firewall (ufw): only SSH + 80 + 443"
apt-get install -y ufw
ufw default deny incoming
ufw default allow outgoing
if [ -n "$ADMIN_IP" ]; then
  ufw allow from "$ADMIN_IP" to any port "$SSH_PORT" proto tcp
else
  ufw allow "${SSH_PORT}/tcp"
fi
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "==> 5/8 fail2ban (auto-ban brute-force attempts)"
apt-get install -y fail2ban
cat >/etc/fail2ban/jail.local <<EOF
[sshd]
enabled  = true
port     = ${SSH_PORT}
maxretry = 4
findtime = 10m
bantime  = 1h
EOF
systemctl enable --now fail2ban

echo "==> 6/8 Automatic security updates"
apt-get install -y unattended-upgrades
echo 'Unattended-Upgrade::Automatic-Reboot "false";' >/etc/apt/apt.conf.d/51unattended-tweaks
systemctl enable --now unattended-upgrades

echo "==> 7/8 Docker + compose"
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh
fi
usermod -aG docker "$NEW_USER"

echo "==> 8/8 rclone (for backups)"
if ! command -v rclone &>/dev/null; then
  curl -fsSL https://rclone.org/install.sh | bash
fi

echo ""
echo "============================================================"
echo " HARDENING DONE."
echo " BEFORE closing this session, open a NEW terminal and verify:"
echo "     ssh -p ${SSH_PORT} ${NEW_USER}@<server-ip>"
echo " If that works, root+password login is now disabled and you're safe."
echo "============================================================"
