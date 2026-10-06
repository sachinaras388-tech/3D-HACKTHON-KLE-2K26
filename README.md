# KLE Inter College Hackathon 2K26

3D cyberpunk event site with a Node.js/Express + MongoDB (Mongoose) backend, JWT login, a Participant portal and an Admin portal.

## Folder structure

```
kle-hackathon-2k26/
├── api/index.js            Vercel serverless entry (wraps the Express app)
├── server/
│   ├── app.js              Express app (API + static files)
│   ├── index.js            Local server (npm start)
│   ├── db.js               MongoDB connection, auto-seeds domains + first admin
│   ├── models/index.js     User, Team, Domain, Announcement
│   ├── middleware/auth.js  JWT sign/verify, admin guard
│   ├── routes/public.js    register, login, me, domains, announcements
│   ├── routes/admin.js     teams, stats, CSV, announcements, domains
│   └── lib/mail.js         Confirmation email (Nodemailer, optional)
├── public/
│   ├── index.html          3D landing page (Three.js)
│   ├── portal.html         Participant portal
│   ├── admin.html          Admin portal
│   ├── campus.jpg          Campus image used as the 3D curved backdrop
│   └── common.js, bg.js, style.css
├── .env.example  vercel.json  package.json
```

## The two portals

**Participant portal** (`/portal.html`): sign up, verify your email with the SMTP code, log in, then register your team inside the portal (team, size, college, ID, domain, problem statement, members). After that: edit details, see Pending / Approved / Rejected, announcements, timeline and countdown. Confetti on first registration.

**Admin portal** (`/admin.html`): log in with the admin account from `.env`. Tabs: Overview (teams, participants, pending/approved/rejected, sign-ups with no team, status donut, registrations per day, by domain, by team size), Registered teams (search + filters, view full details and ID card, approve / reject / delete, CSV export, auto-refresh every 30 s), Domains (add / edit / delete) and Announcements.

## 1. Set up MongoDB Atlas (free)

1. Create an account at https://www.mongodb.com/cloud/atlas and create a free **M0** cluster.
2. **Database Access** → Add Database User → username + password (save them).
3. **Network Access** → Add IP Address → for local testing add your IP; for Render or Vercel, `0.0.0.0/0` allows connections from anywhere.
4. **Database** → Connect → Drivers → copy the connection string. It looks like
   `mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/kle-hackathon?retryWrites=true&w=majority`
   Replace `USER` and `PASSWORD`. If the password has special characters, URL-encode them.

The collections (`users`, `teams`, `domains`, `announcements`) are created automatically.

## SMTP email verification

Participants must verify their email before they can log in: sign up → a 6-digit code is emailed (valid 10 minutes, 5 tries, 60 s resend cooldown) → enter it → logged in → register the team.

**Gmail (quick start):** turn on 2-Step Verification on the Google account, create an **App password** (Google Account → Security → App passwords), then set
`SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`, `SMTP_USER=youraddress@gmail.com`, `SMTP_PASS=<16-character app password>`, `MAIL_FROM="KLE Hackathon 2K26 <youraddress@gmail.com>"`.
Gmail allows about 500 emails per day. For more, use Brevo, Mailgun or SendGrid SMTP credentials in the same variables.

**Test it:** `npm run test-mail -- you@example.com` sends a test email via the selected API provider, or checks SMTP login and sends a test email when using SMTP.

### Email APIs (recommended for Render Free)

Render Free services block outbound SMTP. To send verification messages from a free Render service, choose one provider and set its API key in the Render environment:

| Provider | `MAIL_PROVIDER` | API key variable |
|---|---|---|
| Resend | `resend` | `RESEND_API_KEY` |
| Brevo | `brevo` | `BREVO_API_KEY` |
| SendGrid | `sendgrid` | `SENDGRID_API_KEY` |

Also set `MAIL_FROM` to a sender address verified with that provider. The API key setting must match `MAIL_PROVIDER`. The app uses the provider's HTTPS API, so SMTP settings are not required when an API provider is selected.

If `MAIL_PROVIDER` and `SMTP_HOST` are both empty and `NODE_ENV` is not `production`, the code is printed in the server console for local development. In production, configure either an email API provider or SMTP.


```bash
npm install
cp .env.example .env        # then edit .env
npm start                   # http://localhost:3000
```

Set these in `.env`:

| Variable | What it is |
|---|---|
| `MONGODB_URI` | Atlas connection string from step 1 |
| `JWT_SECRET` | Long random string. Generate: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | The first admin account, created automatically on first start |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | Optional SMTP server settings; not suitable for Render Free, which blocks outbound SMTP |
| `MAIL_PROVIDER`, `RESEND_API_KEY`, `BREVO_API_KEY`, `SENDGRID_API_KEY` | Select and authenticate one email API provider for verification codes and confirmations |
| `MAIL_FROM` | Sender address verified with the selected email provider, or SMTP sender |

Pages: `/` (site), `/portal.html` (participants), `/admin.html` (admins).

## 3. Deploy to Render

1. Create a **Web Service** in Render and connect this repository. Set the root directory to the project folder containing `package.json`.
2. Use `npm install` as the build command and `npm start` as the start command. The Express server serves both the API and the files in `public/`.
3. Add the environment variables from the table above in the Render service settings. On Render Free, configure `MAIL_PROVIDER`, its matching API key, and a verified `MAIL_FROM` address; SMTP egress is blocked. Paid services can use a supported SMTP server if preferred.
4. In MongoDB Atlas **Network Access**, allow connections from the deployed service. For a quick setup, `0.0.0.0/0` allows connections from anywhere; use tighter network rules if your hosting plan supports stable outbound IPs.
5. Deploy, then check the Render service logs if signup fails. `OTP email failed` indicates an SMTP problem; `Database error` or `Database connection failed` indicates MongoDB configuration or connectivity.

## 4. Deploy to Vercel

1. Push this folder to a GitHub repo (`.env` is git-ignored).
2. Vercel → Add New Project → import the repo. No build command needed.
3. Project Settings → Environment Variables: add `MONGODB_URI`, `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` (and `SMTP_*` if you want emails).
4. Deploy. Static files in `public/` are served directly; `/api/*` runs through `api/index.js` (see `vercel.json`).
5. In Atlas Network Access, allow `0.0.0.0/0` so Vercel can connect.

Using the CLI instead: `npm i -g vercel && vercel --prod`.

## API

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| POST | /api/signup | public | Create an unverified account and email a 6-digit code |
| POST | /api/verify-email | public | Submit the code, activates the account (returns JWT) |
| POST | /api/resend-code | public | Send a new code (60 s cooldown) |
| POST | /api/team | participant | Register the logged-in participant's team |
| POST | /api/login | public | Login (participants must have a verified email) |
| GET | /api/me | participant | Own team + status |
| PUT | /api/me/team | participant | Edit team details, domain, problem statement |
| GET | /api/domains, /api/announcements | public | Domains and announcements |
| GET | /api/admin/teams?search=&domain=&status= | admin | List teams |
| GET | /api/admin/teams/:id | admin | Team detail incl. ID card |
| PUT | /api/admin/teams/:id | admin | Set status Approved / Rejected / Pending |
| GET | /api/admin/stats | admin | Totals, participants, by status / domain / size / day |
| DELETE | /api/admin/teams/:id | admin | Delete a team and its account |
| GET | /api/admin/export-csv | admin | CSV download |
| POST/DELETE | /api/admin/announcements | admin | Post / remove announcements |
| POST/PUT/DELETE | /api/admin/domains | admin | Manage domains |

## Notes

- Passwords are hashed with `bcryptjs` (same algorithm as bcrypt, no native build, works on Vercel).
- ID card uploads are stored in MongoDB as base64 (limit about 1.4 MB, images or PDF). For many teams, move uploads to Cloudinary or S3.
- Participants sign up in the portal first; the team leader's email is the account email.
- Reduced-motion users get a static 3D scene; the site is responsive down to phones.
