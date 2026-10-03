# Legacy backups

`npm run db:migrate -- --dry-run` retains the original file at `database/database.json`
and creates a private, content-addressed backup and aggregate report here.
Backups/reports are gitignored. Copy backups to durable private storage before deployment.
Do not use this directory as a production database or commit player data as a seed.
