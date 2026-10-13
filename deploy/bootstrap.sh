#!/usr/bin/env bash
# Sets up Campus Notices on a fresh Ubuntu 22.04/24.04 server (e.g. a free Azure B1s VM). Safe to run again:
# the first run installs everything and creates /opt/campus-notices/.env; after you fill in .env, run it once
# more and it starts the site.
#
#   curl -fsSL https://raw.githubusercontent.com/umetatola/campus-notices/main/deploy/bootstrap.sh | sudo bash
set -euo pipefail

REPO_RAW=${REPO_RAW:-https://raw.githubusercontent.com/umetatola/campus-notices/main/deploy}
DIR=${DIR:-/opt/campus-notices}

if [[ $EUID -ne 0 ]]; then echo "Run as root (sudo)." >&2; exit 1; fi
log() { printf '\n==> %s\n' "$*"; }

log "Installing Docker, firewall and automatic security updates"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -y -q docker.io docker-compose-v2 curl ufw unattended-upgrades cron
systemctl enable --now docker cron

# A 1 GB server needs swap so a memory spike doesn't kill PostgreSQL or the app.
if ! swapon --show | grep -q .; then
  log "Adding 1 GB of swap"
  fallocate -l 1G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

log "Opening only SSH, HTTP and HTTPS"
ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp
ufw --force enable

log "Fetching the deployment files into $DIR"
mkdir -p "$DIR/backups"
for f in docker-compose.yml Caddyfile .env.example bootstrap.sh; do
  curl -fsSL "$REPO_RAW/$f" -o "$DIR/$f.new" && mv "$DIR/$f.new" "$DIR/$f"
done
chmod +x "$DIR/bootstrap.sh"

if [[ ! -f $DIR/.env ]]; then
  cp "$DIR/.env.example" "$DIR/.env"
  sed -i "s/^DB_PASSWORD=$/DB_PASSWORD=$(openssl rand -hex 24)/" "$DIR/.env"
  chmod 600 "$DIR/.env"
fi
# .env is Docker Compose syntax, not shell (MAIL_FROM has spaces and <>), so read values instead of sourcing it.
env_value() { grep -E "^$1=" "$DIR/.env" | tail -n 1 | cut -d= -f2-; }
DOMAIN=$(env_value DOMAIN)
DUCKDNS_SUBDOMAIN=$(env_value DUCKDNS_SUBDOMAIN)
DUCKDNS_SUBDOMAIN=${DUCKDNS_SUBDOMAIN%.duckdns.org}   # accept the full address too
DUCKDNS_TOKEN=$(env_value DUCKDNS_TOKEN)

# DuckDNS: keep the free domain pointing at this server's IP (it can change after a restart).
if [[ -n $DUCKDNS_TOKEN && -n $DUCKDNS_SUBDOMAIN ]]; then
  log "Updating DuckDNS every 5 minutes"
  echo "*/5 * * * * root curl -fsS 'https://www.duckdns.org/update?domains=${DUCKDNS_SUBDOMAIN}&token=${DUCKDNS_TOKEN}&ip=' >/dev/null" \
    > "${CRON_DIR:-/etc/cron.d}/duckdns"
  curl -fsS "https://www.duckdns.org/update?domains=${DUCKDNS_SUBDOMAIN}&token=${DUCKDNS_TOKEN}&ip=" && echo
fi

# Daily database backup at 04:30, keeping the last 7.
cat > "${CRON_DIR:-/etc/cron.d}/campus-notices-backup" <<CRON
30 4 * * * root cd $DIR && docker compose exec -T postgres pg_dump -U campus campus_notices | gzip > backups/db-\$(date +\%F).sql.gz && ls -1t backups/db-*.sql.gz | tail -n +8 | xargs -r rm
CRON

missing=()
for v in DOMAIN DB_PASSWORD MAIL_USERNAME MAIL_PASSWORD MAIL_FROM; do
  [[ -n $(env_value "$v") ]] || missing+=("$v")
done
if (( ${#missing[@]} )); then
  log "Almost done. Fill in these settings in $DIR/.env: ${missing[*]}"
  echo "   sudo nano $DIR/.env      then run this script again:  sudo $DIR/bootstrap.sh"
  exit 0
fi

log "Starting the site"
cd "$DIR"
docker compose pull -q
docker compose up -d
log "Running. In a minute or two, open https://$DOMAIN  (logs: cd $DIR && sudo docker compose logs -f app)"
