# ZIQWEAR - Premium Streetwear E-Commerce Platform

A complete, production-ready e-commerce platform for ZIQWEAR - Zenith In Quality Wear.

## 🚀 Features

### Customer-Facing Website
- Homepage with hero, new arrivals, collections, lookbook, newsletter
- Shop with filtering, sorting, pagination, search
- Product details with gallery, variants, size guide, reviews
- Shopping cart with drawer, quantity updates, free shipping progress
- Multi-step checkout with contact, shipping, payment methods
- Customer account with orders, wishlist, addresses, loyalty
- Order tracking and authentication

### Admin Dashboard
- Dashboard with revenue, orders, customers, products stats
- Product, category, collection management
- Order management with status updates, tracking, refunds
- Customer management with profiles, loyalty, segmentation
- Coupon, inventory, CMS, settings, analytics management
- User management, activity logs, returns, loyalty, shipping

## 🛠 Tech Stack

**Backend:** Node.js + Express + TypeScript + Prisma + PostgreSQL
**Frontend:** React 18 + TypeScript + Vite + Tailwind CSS + Zustand + TanStack Query
**Admin:** React 18 + TypeScript + Vite + Tailwind CSS + Recharts + TanStack Table

## 📦 Project Structure

```
ziqwear/
├── backend/                 # Express + TypeScript API (Prisma + SQLite at prisma/ziqwear.db)
├── frontend/                # Customer-facing React app
├── admin-dashboard/         # Admin React app
├── assets/                  # Static-site CSS/JS/images (served by server.ps1)
├── *.html                   # Static storefront pages + admin.html
├── server.ps1               # Static-site server + order/mail API for the legacy pages
├── backend/scripts/         # Backup, restore and CSV import/export tooling
├── _archive/                # Superseded launchers and one-off codemods (see its README)
├── .env                     # Local secrets — never committed, never packaged
├── .env.example             # Tracked template for the values above
└── README.md
```

## ✉️ Email

Both the Express backend and `server.ps1` read the same keys from `.env`:
`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`. If they are
missing, mail simply stays off and everything else still works. The old
`email-config.json` file is gone — it stored the app password in plaintext and
used to be copied into client packages. Rotate that password if you ever sent a
package with it.

## ▶️ Running it on localhost (Windows)

Double-click `RUN-ZIQWEAR.bat` — it starts everything the platform has.

| File | What it starts |
|------|----------------|
| `RUN-ZIQWEAR.bat` | Everything: static site (8777), API (4000), React storefront (3000), React admin (3001). Starts only what is present in the folder, so it also works on a client package. Pass `open` as an argument to launch browser tabs. |
| `PACKAGE-FOR-CLIENT.bat` | Builds the clean delivery folder (site + assets + launcher); not a server |

Older launchers (`START-ZIQWEAR.bat`, `START-ZIQWEAR-PLATFORM.bat`,
`RUN-PLATFORM-LOCALHOST.bat`, `start-platform.ps1`) are in `_archive/`. None of
them run `prisma db push` any more, because that folder holds real order data.

Each service runs in its own window; close the windows (or type `exit`) to stop.

The static storefront — `index.html`, `shop.html`, `wardrobe.html` (the 3D clothing
rail), `admin.html` — is served by `server.ps1`, not by the React apps. It tries port
`8777` and moves up if that port is busy, so read the URL from its own window.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\server.ps1 -Port 8777
```

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- PostgreSQL 14+ (or Supabase)

### Backend Setup
```bash
cd backend
cp .env.example .env
# Edit .env with your database URL and secrets
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
# Opens at http://localhost:3000
```

### Admin Dashboard Setup
```bash
cd admin-dashboard
npm install
npm run dev
# Opens at http://localhost:3001
```

## 🔐 Default Admin Credentials

After seeding:
- **Email:** admin@ziqwear.com
- **Password:** ziqwear-admin

**Change these immediately in production!**

## 📝 Key Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret for signing JWT tokens (min 32 chars) |
| `COOKIE_SECRET` | Secret for signing cookies |
| `SMTP_*` | Email configuration |
| `FRONTEND_URL` | Customer site URL |
| `ADMIN_URL` | Admin dashboard URL |

## 🗄 Database Schema

Models include: Users & Auth, Products, Inventory, Orders, Marketing, Loyalty, Content, Analytics, Returns, Shipping, Audit.

## 🚀 Deployment

### Backend
```bash
npm run build
npm run start
# Use PM2, reverse proxy with SSL
```

### Frontend/Admin
```bash
npm run build
# Deploy dist/ to CDN/Netlify/Vercel
```

## 📄 License

Proprietary software for ZIQWEAR. All rights reserved.

---

**ZIQWEAR** - Zenith In Quality Wear