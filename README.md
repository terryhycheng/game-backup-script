# palworld-backup-script

Backs up a local Palworld save directory to S3 and trims old remote backups.

## Environment

Copy `.env.example` to `.env` and fill in real values.

```env
S3_ACCESS_KEY_ID=your-access-key
S3_SECRET_ACCESS_KEY=your-secret-key
PAL_FOLDER_LOCATION=/data/palworld/backups
PAL_BUCKET_NAME=palworld
PAL_MAX_BACKUPS=30
```

Notes:

- `PAL_FOLDER_LOCATION` is the local directory the app reads backups from.
- `PAL_BUCKET_NAME` is the S3 bucket used for uploads and cleanup.
- `PAL_MAX_BACKUPS` controls how many remote backups are kept.
- The S3 client currently uses the `us-east-1` region in code.

## Run locally

Install dependencies and start the app in dev mode:

```bash
pnpm install
pnpm dev
```

Build and run the compiled app:

```bash
pnpm build
pnpm start
```

## Docker

Pull the published image:

```bash
docker pull ghcr.io/<owner>/<repo>:latest
```

Run it with your env file and a mounted backup directory:

```bash
docker run --rm \
  --env-file .env \
  -v /host/palworld/backups:/data/palworld/backups:ro \
  ghcr.io/<owner>/<repo>:latest
```

Make sure `PAL_FOLDER_LOCATION` inside `.env` matches the path inside the container. With the example above, use:

```env
PAL_FOLDER_LOCATION=/data/palworld/backups
```

## Releases

This repo uses `release-please`.

- Merges to `main` update or create a release PR.
- Merging that PR creates the GitHub release and tag.
- The release workflow then publishes:
  - a release tarball containing `dist/` and package metadata
  - a Docker image to `ghcr.io/<owner>/<repo>`

Version bumps come from conventional commits.
