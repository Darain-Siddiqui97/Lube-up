# LUBE UP — Backup & Client Setup Guide

This guide accompanies the source code in this repository. It is intended for owner recovery and for preparing a separate client installation.

## 1. Project contents

- `index.html` — public application entry point.
- `admin/index.html` — admin dashboard.
- `functions/api/` — Cloudflare Pages Functions API endpoints.
- `schema.sql` — current database schema, indexes, and successful-scan trigger.
- `lube-up-lube-40.webp` — project image asset.

The application uses Cloudflare Pages Functions and a Cloudflare D1 database. The D1 database is not stored inside GitHub; back it up separately.

## 2. Download a source-code backup

1. Open https://github.com/Darain-Siddiqui97/Lube-up
2. Select **Code → Download ZIP**.
3. Extract the ZIP and keep the extracted folder.
4. For each later source update, download a fresh ZIP or clone/pull the repository.

GitHub repository history is also a versioned source backup. Keep a local ZIP copy and a second copy on a private drive.

## 3. Database backup (data + schema)

Use Wrangler on a trusted computer. Install a current Node.js LTS release, then open Command Prompt:

```bash
npx wrangler@latest login
npx wrangler@latest d1 export lube-up-db --remote --output="./LUBE-UP-DATABASE-backup.sql"
```

Run the export from the folder where you want the SQL file saved. Confirm the file exists and has a non-zero size. Store it privately; it can contain business and mechanic data.

For an owner backup, export the existing production database. For a client installation, do not import the owner's production data unless there is explicit permission. Use a clean database instead.

## 4. Create a separate client installation

1. Create or use a Cloudflare account for the client.
2. Create a new Cloudflare Pages project connected to the client's GitHub repository (or upload the source using a supported Pages deployment workflow).
3. Create a new D1 database for that client.
4. Apply this repository's schema to the new D1 database using Wrangler:

```bash
npx wrangler@latest d1 execute CLIENT_DATABASE_NAME --remote --file=./schema.sql
```

5. In the Pages project settings, add a D1 database binding named exactly `DB`, and bind it to the newly created client database.
6. In Pages project settings, add the secret `ADMIN_KEY`. Set a strong, unique key for that installation. Never commit the secret to GitHub or place it in a public ZIP.
7. Deploy the Pages project and test admin login, product creation, mechanic creation, QR generation, one-time QR verification, scan history, and print layout.

Important: this repository does not include a Wrangler configuration file or a client-specific Cloudflare account configuration. Configure the Pages D1 binding and secret in the Cloudflare dashboard for each installation.

## 5. Restore an owner database backup

Only restore into the intended database after confirming the target database and taking a fresh backup of it. A full SQL export may contain schema and data. Review the SQL file before importing it. Use:

```bash
npx wrangler@latest d1 execute TARGET_DATABASE_NAME --remote --file=./LUBE-UP-DATABASE-backup.sql
```

Do not run a production restore as a test. Restoring can overwrite or conflict with existing records depending on the SQL statements in the export.

## 6. Secrets and handover checklist

Keep these outside the source ZIP in a password manager or other secure vault:

- Cloudflare account access / project ownership details.
- The actual `ADMIN_KEY` value.
- Any client-specific deployment details.

Never share the owner's Cloudflare login or production ADMIN_KEY with a client. For each client, create a separate Cloudflare project, D1 database, and unique ADMIN_KEY.

## 7. Backup routine

- Source code: download a ZIP after each important release; GitHub retains commit history.
- Database: export weekly and before any risky database change.
- Store at least two copies in separate private locations.
- Periodically test restoration into a separate test database.

A source ZIP alone is not a complete operational backup: the D1 SQL export and the secret/configuration handover details are separate items.
