# game-backup-script

[![All Contributors](https://img.shields.io/github/all-contributors/terryhycheng/game-backup-script?color=ee8449&style=flat-square)](#contributors)

Backs up a local game save directory to S3 and trims old remote backups.

## Environment

Copy `.env.example` to `.env` and fill in real values.

```env
S3_ACCESS_KEY_ID=your-access-key
S3_SECRET_ACCESS_KEY=your-secret-key
S3_ENDPOINT=https://s3.amazonaws.com
S3_REGION=us-east-1
GAME_FOLDER_LOCATION=/data/game-backups
GAME_BUCKET_NAME=game-backups
GAME_BUCKET_FOLDER_NAME=backups
GAME_MAX_BACKUPS=30
```

Notes:

- `GAME_FOLDER_LOCATION` is the local directory the app reads backups from.
- `GAME_BUCKET_NAME` is the S3 bucket used for uploads and cleanup.
- `GAME_BUCKET_FOLDER_NAME` is the S3 key prefix used for uploads. Default: `backups`.
- `GAME_MAX_BACKUPS` controls how many remote backups are kept.
- `S3_ENDPOINT` is the base URL for the S3 API. Use your provider's endpoint if you are targeting S3-compatible storage.
- `S3_REGION` is the AWS region passed to the S3 client, such as `us-east-1`.

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
docker pull ghcr.io/terryhycheng/game-backup-script:latest
```

Run it with your env file and a mounted backup directory:

```bash
docker run --rm \
  --env-file .env \
  -v /host/game-backups-logs:/data/logs:rw \
  -v /host/game-backups:/data/game-backups:ro \
  ghcr.io/terryhycheng/game-backup-script:latest
```

Make sure `GAME_FOLDER_LOCATION` inside `.env` matches the path inside the container. With the example above, use:

```env
GAME_FOLDER_LOCATION=/data/game-backups
```

The container writes log files under `/data/logs`. With the example above, those logs will be stored on the host at `/host/game-backups-logs`.

If you want uploads at the bucket root instead of under a prefix like `backups/`, set `GAME_BUCKET_FOLDER_NAME` to an empty value in your env file.

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
<table>
  <tbody>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/terryhycheng"><img src="https://avatars.githubusercontent.com/u/35667554?v=4?s=100" width="100px;" alt="Terry Cheng"/><br /><sub><b>Terry Cheng</b></sub></a><br /><a href="#code-terryhycheng" title="Code">💻</a></td>
    </tr>
  </tbody>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->
