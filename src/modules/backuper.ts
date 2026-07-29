import { FileSystem } from "@effect/platform";
import { Effect, pipe } from "effect";
import { GameBackupConfigService } from "../configs";
import { S3 } from "./s3";

/**
 * Backuper is a service that backups files to s3
 */
export class Backuper extends Effect.Service<Backuper>()("backuper", {
	effect: Effect.gen(function* () {
		const backupConfig = yield* GameBackupConfigService;
		const fs = yield* FileSystem.FileSystem;
		const s3 = yield* S3;

		const syncBackups = () => {
			return pipe(
				checkBackupDifference(),
				Effect.flatMap((files) =>
					Effect.forEach(
						files,
						(fileName) =>
							pipe(
								fs.readFile(`${backupConfig.folderLocation}/${fileName}`),
								Effect.flatMap((bits) => s3.putObject(backupConfig.bucketName, fileName, bits)),
							),
						{ concurrency: 2 },
					),
				),
			);
		};

		const cleanUpOldBackups = () =>
			pipe(
				s3.listObjects(backupConfig.bucketName),
				Effect.flatMap((files) => {
					if (files.length <= backupConfig.maxBackups) return Effect.void;
					return Effect.forEach(
						files.sort((a, b) => a.key.localeCompare(b.key)).slice(0, files.length - backupConfig.maxBackups),
						(file) => s3.deleteObject(backupConfig.bucketName, file.key),
						{ concurrency: 2 },
					);
				}),
			);

		const checkBackupDifference = () =>
			pipe(
				Effect.all({
					localFiles: fs.readDirectory(backupConfig.folderLocation),
					s3Files: s3.listObjects(backupConfig.bucketName),
				}),
				Effect.map(({ localFiles, s3Files }) => {
					if (s3Files.length === 0) return localFiles;

					const s3Keys = s3Files.map((file) => file.key);
					return localFiles.filter((file) => !s3Keys.includes(file));
				}),
			);

		return { syncBackups, cleanUpOldBackups } as const;
	}),
}) {}
