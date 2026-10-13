# Deploying Campus Notices on a free Azure VM

About 30 minutes, mostly waiting. You need: an **Azure for Students** account (free credit, no credit card), a
**DuckDNS** account (free domain), and a **Gmail app password** (for sending sign-in and alert emails).

> **Cost.** The VM size used here (B1s, 1 vCPU, 1 GB) is in Azure for Students' free services. Other parts (the
> public IP address, the disk) can use a little of the free credit; the portal shows an estimate on the last page
> before you click **Create**. Azure for Students has no credit card: when the credit runs out, services stop
> instead of charging you. To remove everything, delete the resource group (step 7).

## 1. Get a free domain (DuckDNS)

1. Go to <https://www.duckdns.org>, sign in with GitHub.
2. Add a subdomain, e.g. `campusnotices` → your site will be `campusnotices.duckdns.org`.
3. Keep the **token** shown at the top of the page; you need it in step 4.

## 2. Create a Gmail app password

Google account → **Security** → turn on **2-Step Verification** → **App passwords** → create one named
"Campus Notices". Keep the 16-character password.

## 3. Create the VM (Azure portal)

<https://portal.azure.com> → **Virtual machines** → **Create** → **Azure virtual machine**:

| Setting | Value |
|---|---|
| Resource group | Create new: `campus-notices` |
| Virtual machine name | `campus-notices` |
| Region | `(Asia Pacific) Korea Central` |
| Image | `Ubuntu Server 24.04 LTS - x64 Gen2` |
| Size | `Standard_B1s` (shown as free services eligible) |
| Authentication type | SSH public key; key pair name `campus-notices` (download the key when asked) |
| Inbound ports | Allow selected: **SSH (22), HTTP (80), HTTPS (443)** |

On the **Advanced** tab, paste the contents of [`deploy/cloud-init.yaml`](../deploy/cloud-init.yaml) into
**Custom data**. Then **Review + create** → check the cost estimate → **Create**. When asked, download the private
key (`campus-notices.pem`).

When it's done, open the VM and copy its **Public IP address**.

## 4. Fill in the settings

The VM already installed Docker and downloaded the site on first boot (it takes 2–3 minutes after creation).
Connect from your computer (Windows PowerShell or WSL), in the folder where you saved the key:

```bash
ssh -i campus-notices.pem azureuser@<public IP>
sudo nano /opt/campus-notices/.env
```

Fill in (the database password is already generated):

```
DOMAIN=campusnotices.duckdns.org
DUCKDNS_SUBDOMAIN=campusnotices
DUCKDNS_TOKEN=<token from step 1>
MAIL_USERNAME=<your Gmail address>
MAIL_PASSWORD=<app password from step 2>
MAIL_FROM=Campus Notices <your Gmail address>
```

Save with **Ctrl+O**, **Enter**, exit with **Ctrl+X**.

## 5. Start the site

```bash
sudo /opt/campus-notices/bootstrap.sh
```

It points DuckDNS at the server, pulls the app from GitHub's container registry and starts it. After a minute or two
open `https://campusnotices.duckdns.org`. Caddy gets the HTTPS certificate on the first visit (if it fails, wait a few
minutes for DuckDNS to update and reload).

The first crawl runs 10 seconds after start; notices appear right after.

## 6. Day to day

| Task | Command (in `/opt/campus-notices`) |
|---|---|
| See the app's log | `sudo docker compose logs -f app` |
| Look at the app's counters (crawls, summaries, emails) | `sudo docker compose exec caddy wget -qO- http://app:8080/actuator/prometheus \| grep campus_notices` |
| Update to the newest version (after a merge to `main`) | `sudo docker compose pull && sudo docker compose up -d` |
| Restart everything | `sudo docker compose restart` |
| Database backups | made daily at 04:30 into `backups/` (last 7 kept) |
| Restore a backup | `gunzip -c backups/db-2026-10-20.sql.gz \| sudo docker compose exec -T postgres psql -U campus campus_notices` |

The setup script also turned on automatic Ubuntu security updates, a firewall (only SSH, HTTP, HTTPS), 1 GB of swap
and a DuckDNS update every 5 minutes. Running it again is safe.

## 7. Stop paying / remove everything

Azure portal → **Resource groups** → `campus-notices` → **Delete resource group**. This removes the VM, disk and IP.

## Optional: the same with the Azure CLI

After `az login` (your own account):

```bash
az group create -n campus-notices -l koreacentral
az vm create -g campus-notices -n campus-notices --image Ubuntu2404 --size Standard_B1s \
  --admin-username azureuser --generate-ssh-keys --custom-data deploy/cloud-init.yaml
az vm open-port -g campus-notices -n campus-notices --port 80,443
```

Then continue with step 4.
