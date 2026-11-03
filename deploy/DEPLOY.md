# ZIQWEAR — deployment guide (AWS Lightsail, Ubuntu)

Nothing in this folder runs anything. It is the configuration and the ordered
procedure for putting the platform on a server when you decide to.

The stack on a server is three parts, all on one machine:

| Piece | What it is | Where it lives |
| --- | --- | --- |
| Node API | Express + Prisma/SQLite, port 4000, loopback only | `backend/dist/index.js` |
| Storefront | React build, static files | `frontend/dist` |
| Admin | React build, static files | `admin-dashboard/dist` |

nginx serves the two builds and proxies `/api`, `/assets`, `/health` and
`/legacy` to the Node API. `server.ps1` and `RUN-ZIQWEAR.bat` stay on your
Windows machine — they are the local launcher, not part of the deployment.
The Node API already serves the original static pages under `/legacy/`.

---

## 1. The instance

1. Lightsail → **Create instance** → platform *Other* → **Node.js** or plain
   **Ubuntu 24.04 LTS** blueprint.
2. Size: the **$5/mo (2 GB RAM, 1 vCPU, 60 GB SSD)** plan is enough for this
   site. Do not pick the 512 MB plan — `vite build` gets OOM-killed on it.
3. In **Networking**, open **HTTP** and **HTTPS** only. Do not open port 4000
   and do not open SSH to the world — use Lightsail's browser-based SSH, or
   restrict the firewall rule to your own IP.
4. Attach a **static IP** (free once attached) so the DNS record never has to
   change after a reboot or a restore.
5. Point your domain at it: in Lightsail **Networking → DNS zones** (or at your
   registrar) create an `A` record for `ziqwear.com` → static IP, a `CNAME` for
   `www` → `ziqwear.com`, and a second `A` record `admin.ziqwear.com` → same IP.

## 2. System user and code

```bash
sudo adduser --system --group --home /opt/ziqwear ziqwear
sudo mkdir -p /opt/ziqwear && sudo chown ziqwear:ziqwear /opt/ziqwear
```

Upload the project — from Windows, `rsync` over the Lightsail SSH is simplest,
or archive the folder and `scp` it:

```bash
# from the project folder on Windows
tar --exclude=node_modules --exclude=.git --exclude=frontend/dist \
    --exclude=admin-dashboard/dist --exclude='*/dist' -czf ../ziqwear.tgz .
scp ../ziqwear.tgz ziqwear@<static-ip>:~/
# on the server
cd /opt/ziqwear && tar xzf ~/ziqwear.tgz
```

Install Node 24 (the app needs >= 20; the blueprint may ship an older one):

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt-get install -y nodejs nginx
node -v
```

## 3. The database

Your real order history is `backend/prisma/ziqwear.db`. Two paths, and the
difference matters:

- **Carrying your existing data over** (the normal case): the `.db` file is
  already in the archive you uploaded. Run only
  `cd backend && npx prisma generate`. Do **not** run `prisma db push` or
  `prisma migrate` against it — that is how live rows get altered.
- **Starting empty on the server**: `npx prisma db push --skip-generate`, then
  `npm run db:seed` (needs `SEED_ADMIN_PASSWORD` in `.env` first).

SQLite needs the directory to be writable by the service user, because it
creates `-journal`/`-wal` files next to the database:

```bash
sudo chown -R ziqwear:ziqwear /opt/ziqwear
```

## 4. Environment

```bash
cd /opt/ziqwear
cp .env.example backend/.env
```

Then edit `backend/.env` and change exactly these:

```ini
NODE_ENV=production
HOST=127.0.0.1                       # nginx is the only thing that reaches the API
FRONTEND_URL=https://ziqwear.com
ADMIN_URL=https://admin.ziqwear.com
CORS_ORIGIN=https://ziqwear.com,https://admin.ziqwear.com
JWT_SECRET=<generated>               # required, see below
COOKIE_SECRET=<generated>            # required
SMTP_USER=<gmail address>
SMTP_PASS=<a NEW Gmail App Password> # the old one was shipped in plaintext
```

Generate each secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

`DATABASE_URL="file:./ziqwear.db"` stays as-is — Prisma resolves it relative to
`backend/prisma/`, which is where the file is.

If you leave the two secrets as the template placeholders, the API now refuses
to start and tells you why. That is deliberate: a known `JWT_SECRET` lets
anyone read the source and mint an admin token.

## 5. Build and run

```bash
cd /opt/ziqwear/backend  && npm ci && npx prisma generate && npm run build
cd /opt/ziqwear/frontend && npm ci && npm run build
cd /opt/ziqwear/admin-dashboard && npm ci && npm run build
```

Install the service and site configs from this folder:

```bash
sudo cp deploy/ziqwear-backend.service /etc/systemd/system/
sudo cp deploy/nginx.ziqwear.conf /etc/nginx/sites-available/ziqwear
sudo ln -s /etc/nginx/sites-available/ziqwear /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl enable --now ziqwear-backend
sudo systemctl reload nginx
```

Replace `ziqwear.com` in `nginx.ziqwear.conf` with your domain before the
`nginx -t` step, and set `ServerName` in it to match.

## 6. HTTPS

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d ziqwear.com -d www.ziqwear.com -d admin.ziqwear.com
sudo certbot renew --dry-run
```

Cookies are marked `Secure` the moment `NODE_ENV=production`, so login, cart
and checkout silently stop working over plain HTTP. TLS is not optional.

Lightsail's alternative is a load balancer with a free managed TLS certificate;
it costs more and the certbot route above is fine for this site.

## 7. Backups

Two layers, because SQLite is one file and one bad write ends the history:

```bash
sudo -u ziqwear crontab -e
# then, in that user's crontab — nightly 03:15, keep 14 copies
15 3 * * * cd /opt/ziqwear/backend && /usr/bin/node scripts/backup-db.mjs >> /var/log/ziqwear-backup.log 2>&1
```

Restore with `node scripts/restore-db.mjs --list` to see what is available.
Also turn on **Lightsail automatic snapshots** (Billing → Snapshots) so you can
recover the whole disk, not just the database. Copy snapshots off-box weekly —
a snapshot of a broken account is still a broken account.

## 8. Verify it is actually up

```bash
curl -I https://ziqwear.com/                    # 200, and the storefront HTML
curl -s https://ziqwear.com/health              # {"status":"ok",...}
curl -s https://ziqwear.com/api/v1/products     # JSON catalogue
curl -s https://ziqwear.com/sitemap.xml | head   # 200; every <loc> on the real domain
curl -s https://ziqwear.com/robots.txt | tail    # Sitemap: line points at the same domain
curl -I http://ziqwear.com/                     # 301 to https
sudo systemctl status ziqwear-backend --no-pager
sudo journalctl -u ziqwear-backend -n 50
```

`/sitemap.xml` and `/robots.txt` are built per request by the Node API from the
host nginx forwards, so there is no file to hand-edit and no placeholder domain
can leak into production; the sitemap lists only products with `isActive` set in
the database.

Then in a browser, on a phone: add to cart → checkout as a guest → confirm the
order appears in the admin dashboard, and that the owner email arrives. Place
one test order and delete it — stock should return to its previous number
(that path was broken until this deploy kit was written).

## 9. What is still not production-grade

- **Admin dashboard exposure.** `admin.ziqwear.com` is on the public internet
  the moment DNS resolves. Either keep the IP allow-list block uncommented in
  the nginx config, or accept that the login page is reachable and make sure
  the admin password is strong and `JWT_SECRET` is fresh.
- **Stripe, SMS and WhatsApp** stay off until their keys exist. Orders work
  without them via cash-on-delivery and WhatsApp.
- **Emailed links** use `FRONTEND_URL`; if that is wrong, customers get
  localhost links.
- **No CI/CD.** This is a manual upload. If the site starts changing weekly,
  script steps 2-5 rather than repeating them by hand.
- **Single instance.** Lightsail is one machine: if it dies, the store is down.
  Snapshots plus the nightly `.db` backup are the mitigation.
