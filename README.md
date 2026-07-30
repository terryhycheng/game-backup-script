# game-backup-script

[![All Contributors](https://img.shields.io/github/all-contributors/terryhycheng/game-backup-script?color=ee8449&style=flat-square)](#contributors)

Backs up a local game save directory to S3 and trims old remote backups.

## Environment

Copy `.env.example` to `.env` and fill in real values.

```env
S3_ACCESS_KEY_ID=your-access-key
S3_SECRET_ACCESS_KEY=your-secret-key
GAME_FOLDER_LOCATION=/data/game-backups
GAME_BUCKET_NAME=game-backups
GAME_MAX_BACKUPS=30
```

Notes:

- `GAME_FOLDER_LOCATION` is the local directory the app reads backups from.
- `GAME_BUCKET_NAME` is the S3 bucket used for uploads and cleanup.
- `GAME_MAX_BACKUPS` controls how many remote backups are kept.
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
  -v /host/game-backups:/data/game-backups:ro \
  ghcr.io/<owner>/<repo>:latest
```

Make sure `GAME_FOLDER_LOCATION` inside `.env` matches the path inside the container. With the example above, use:

```env
GAME_FOLDER_LOCATION=/data/game-backups
```

## Releases

This repo uses `release-please`.

- Merges to `main` update or create a release PR.
- Merging that PR creates the GitHub release and tag.
- The release workflow then publishes:
  - a release tarball containing `dist/` and package metadata
  - a Docker image to `ghcr.io/<owner>/<repo>`

Version bumps come from conventional commits.

## Contributing

This project is mainly built around [Effect](https://effect.website) for runtime composition, dependency injection, config loading, and error handling. If you are changing the core app flow, it helps to be comfortable with a few Effect concepts first. Checking on their [well-written docs](https://www.effect.website/docs/v3/getting-started/introduction) will help you a lot.



Typical local workflow:

```bash
pnpm install
pnpm vitest run
pnpm build
pnpm dev
```

If you contribute release-related changes, keep commit messages in conventional commit format so `release-please` can calculate the next version correctly.

## Contributors ✨

Thanks goes to these wonderful people:

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->