import { FileSystem } from "@effect/platform";
import { Effect, pipe } from "effect";
import { GameBackupConfigService } from "../configs";
import { Logger } from "./logger";
import { S3 } from "./s3";

/**
 * Backuper is a service that backups files to s3
 */
export class Backuper extends Effect.Service<Backuper>()("backuper", {
	effect: Effect.gen(function* () {
		const backupConfig = yield* GameBackupConfigService;
		const logger = yield* Logger;
		const fs = yield* FileSystem.FileSystem;
		const s3 = yield* S3;

		/**
		 * syncs local files to s3 via `putObjectCommand`
		 */
		const syncBackups = () => {
			/**
			 * returns an array of local files that are not in s3
			 */
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

			const loggingResult = (files: string[]) => {
				if (files.length === 0) return logger.info("no new backups to upload");

				return pipe(
					logger.info(`uploading ${files.length} new backup(s)`),
					Effect.tap(() => Effect.forEach(files, (file) => logger.info(file))),
				);
			};
			const uploadFiles = (files: string[]) => {
				if (files.length === 0) return Effect.void;

				return Effect.forEach(
					files,
					(fileName) =>
						pipe(
							fs.readFile(`${backupConfig.folderLocation}/${fileName}`),
							Effect.flatMap((bits) => s3.putObject(backupConfig.bucketName, fileName, bits)),
							Effect.tap(() => logger.info(`uploaded ${fileName}`)),
						),
					{ concurrency: 2 },
				);
			};

			return pipe(
				checkBackupDifference(),
				Effect.tap(loggingResult),
				Effect.flatMap(uploadFiles),
				Effect.tapError((error) => logger.error(`failed to sync backups: ${error.message}`)),
			);
		};

		/**
		 * deletes old backups from s3 based on `maxBackups` env var via `deleteObjectCommand`
		 */
		const cleanUpOldBackups = () => {
			type Files = {
				key: string;
				lastModified: Date | undefined;
			};

			const removeOldFiles = (files: Files[]) => {
				if (files.length <= backupConfig.maxBackups) return logger.info("no old backups to clean up");

				const filesToDelete = files
					.sort((a, b) => a.key.localeCompare(b.key))
					.slice(0, files.length - backupConfig.maxBackups);

				const deleteFiles = Effect.forEach(
					filesToDelete,
					(file) =>
						pipe(
							s3.deleteObject(backupConfig.bucketName, file.key),
							Effect.tap(() => logger.info(`deleted old backup ${file.key}`)),
						),
					{ concurrency: 2 },
				);

				return pipe(
					logger.info(`cleaning up ${filesToDelete.length} old backup(s)`),
					Effect.flatMap(() => deleteFiles),
				);
			};

			return pipe(
				s3.listObjects(backupConfig.bucketName),
				Effect.flatMap(removeOldFiles),
				Effect.tapError((error) => logger.error(`failed to clean up old backups: ${error.message}`)),
			);
		};

		return { syncBackups, cleanUpOldBackups } as const;
	}),
}) {}
