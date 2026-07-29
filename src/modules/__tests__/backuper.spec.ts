import { FileSystem } from "@effect/platform";
import { Cause, Effect, Exit, Layer } from "effect";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { GameBackupConfigService } from "../../configs";
import { Backuper } from "../backuper";
import { S3 } from "../s3";

type RemoteFile = {
	readonly key: string;
	readonly lastModified?: Date;
};

type HarnessOptions = {
	readonly localFiles?: string[];
	readonly remoteFiles?: RemoteFile[];
	readonly maxBackups?: number;
	readonly readDirectoryEffect?: Effect.Effect<string[], Error>;
	readonly readFileImplementation?: (path: string) => Effect.Effect<Uint8Array, Error>;
	readonly listObjectsEffect?: Effect.Effect<RemoteFile[], Error>;
	readonly putObjectImplementation?: (
		bucketName: string,
		key: string,
		body: Uint8Array,
	) => Effect.Effect<unknown, Error>;
	readonly deleteObjectImplementation?: (bucketName: string, key: string) => Effect.Effect<unknown, Error>;
};

describe("Backuper", () => {
	let defaultFileBytes: Uint8Array;

	beforeEach(() => {
		defaultFileBytes = new Uint8Array([1, 2, 3]);
	});

	const makeHarness = (options: HarnessOptions = {}) => {
		const readDirectory = vi.fn(() => options.readDirectoryEffect ?? Effect.succeed(options.localFiles ?? [])) as Mock;
		const readFile = vi.fn(
			(path: string) =>
				options.readFileImplementation?.(path) ?? Effect.succeed(new Uint8Array([...defaultFileBytes, path.length])),
		) as Mock;
		const listObjects = vi.fn(() => options.listObjectsEffect ?? Effect.succeed(options.remoteFiles ?? [])) as Mock;
		const putObject = vi.fn(
			(bucketName: string, key: string, body: Uint8Array) =>
				options.putObjectImplementation?.(bucketName, key, body) ?? Effect.succeed({ bucketName, key, body }),
		) as Mock;
		const deleteObject = vi.fn(
			(bucketName: string, key: string) =>
				options.deleteObjectImplementation?.(bucketName, key) ?? Effect.succeed({ bucketName, key }),
		) as Mock;

		const fileSystemLayer = Layer.succeed(FileSystem.FileSystem, {
			readDirectory,
			readFile,
		} as never);
		const s3Layer = Layer.succeed(
			S3,
			new S3({
				listObjects,
				putObject,
				deleteObject,
			}),
		);
		const configLayer = Layer.succeed(GameBackupConfigService, {
			folderLocation: "/backups",
			bucketName: "test-bucket",
			maxBackups: options.maxBackups ?? 2,
		});
		const layer = Layer.provide(Backuper.Default, Layer.mergeAll(fileSystemLayer, s3Layer, configLayer));

		const getBackuper = () =>
			Effect.runPromise(
				Effect.gen(function* () {
					return yield* Backuper;
				}).pipe(Effect.provide(layer)),
			);

		return {
			getBackuper,
			readDirectory,
			readFile,
			listObjects,
			putObject,
			deleteObject,
		};
	};

	describe("syncBackups", () => {
		it("uploads every local file missing from s3", async () => {
			const harness = makeHarness({
				localFiles: ["backup-1.zip", "backup-2.zip", "backup-3.zip"],
				remoteFiles: [{ key: "backup-1.zip" }],
			});

			const backuper = await harness.getBackuper();
			await Effect.runPromise(backuper.syncBackups());

			expect(harness.readDirectory).toHaveBeenCalledWith("/backups");
			expect(harness.readFile).toHaveBeenCalledTimes(2);
			expect(harness.readFile).toHaveBeenCalledWith("/backups/backup-2.zip");
			expect(harness.readFile).toHaveBeenCalledWith("/backups/backup-3.zip");
			expect(harness.putObject).toHaveBeenCalledTimes(2);
			expect(harness.putObject.mock.calls).toEqual(
				expect.arrayContaining([
					["test-bucket", "backup-2.zip", expect.any(Uint8Array)],
					["test-bucket", "backup-3.zip", expect.any(Uint8Array)],
				]),
			);
		});

		it("does nothing when every local file already exists in s3", async () => {
			const harness = makeHarness({
				localFiles: ["backup-1.zip", "backup-2.zip"],
				remoteFiles: [{ key: "backup-1.zip" }, { key: "backup-2.zip" }],
			});

			const backuper = await harness.getBackuper();
			await Effect.runPromise(backuper.syncBackups());

			expect(harness.readFile).not.toHaveBeenCalled();
			expect(harness.putObject).not.toHaveBeenCalled();
		});

		it("uploads all local files when s3 is empty", async () => {
			const harness = makeHarness({
				localFiles: ["backup-1.zip", "backup-2.zip"],
				remoteFiles: [],
			});

			const backuper = await harness.getBackuper();
			await Effect.runPromise(backuper.syncBackups());

			expect(harness.readFile).toHaveBeenCalledTimes(2);
			expect(harness.putObject).toHaveBeenCalledTimes(2);
		});

		it("fails when reading the local backup directory fails", async () => {
			const error = new Error("readDirectory failed");
			const harness = makeHarness({
				readDirectoryEffect: Effect.fail(error),
			});

			const backuper = await harness.getBackuper();
			const exit = await Effect.runPromiseExit(backuper.syncBackups());

			expect(Exit.isFailure(exit)).toBe(true);
			if (Exit.isFailure(exit)) {
				const failure = Cause.failureOption(exit.cause);

				expect(failure._tag).toBe("Some");
				if (failure._tag === "Some") {
					expect(failure.value).toBe(error);
				}
			}
		});

		it("fails when reading one missing file fails", async () => {
			const error = new Error("readFile failed");
			const harness = makeHarness({
				localFiles: ["backup-1.zip"],
				readFileImplementation: () => Effect.fail(error),
			});

			const backuper = await harness.getBackuper();
			const exit = await Effect.runPromiseExit(backuper.syncBackups());

			expect(Exit.isFailure(exit)).toBe(true);
			if (Exit.isFailure(exit)) {
				const failure = Cause.failureOption(exit.cause);

				expect(failure._tag).toBe("Some");
				if (failure._tag === "Some") {
					expect(failure.value).toBe(error);
				}
			}
			expect(harness.putObject).not.toHaveBeenCalled();
		});

		it("fails when uploading one missing file fails", async () => {
			const error = new Error("putObject failed");
			const harness = makeHarness({
				localFiles: ["backup-1.zip"],
				putObjectImplementation: () => Effect.fail(error),
			});

			const backuper = await harness.getBackuper();
			const exit = await Effect.runPromiseExit(backuper.syncBackups());

			expect(Exit.isFailure(exit)).toBe(true);
			if (Exit.isFailure(exit)) {
				const failure = Cause.failureOption(exit.cause);

				expect(failure._tag).toBe("Some");
				if (failure._tag === "Some") {
					expect(failure.value).toBe(error);
				}
			}
		});
	});

	describe("cleanUpOldBackups", () => {
		it("does nothing when remote file count is less than maxBackups", async () => {
			const harness = makeHarness({
				maxBackups: 3,
				remoteFiles: [{ key: "backup-1.zip" }, { key: "backup-2.zip" }],
			});

			const backuper = await harness.getBackuper();
			await Effect.runPromise(backuper.cleanUpOldBackups());

			expect(harness.deleteObject).not.toHaveBeenCalled();
		});

		it("does nothing when remote file count equals maxBackups", async () => {
			const harness = makeHarness({
				maxBackups: 2,
				remoteFiles: [{ key: "backup-1.zip" }, { key: "backup-2.zip" }],
			});

			const backuper = await harness.getBackuper();
			await Effect.runPromise(backuper.cleanUpOldBackups());

			expect(harness.deleteObject).not.toHaveBeenCalled();
		});

		it("deletes only the oldest extra files after sorting by key", async () => {
			const harness = makeHarness({
				maxBackups: 2,
				remoteFiles: [
					{ key: "backup-2024-03.zip" },
					{ key: "backup-2024-01.zip" },
					{ key: "backup-2024-04.zip" },
					{ key: "backup-2024-02.zip" },
				],
			});

			const backuper = await harness.getBackuper();
			await Effect.runPromise(backuper.cleanUpOldBackups());

			expect(harness.deleteObject).toHaveBeenCalledTimes(2);
			expect(harness.deleteObject.mock.calls).toEqual(
				expect.arrayContaining([
					["test-bucket", "backup-2024-01.zip"],
					["test-bucket", "backup-2024-02.zip"],
				]),
			);
		});

		it("fails when listing s3 objects fails", async () => {
			const error = new Error("listObjects failed");
			const harness = makeHarness({
				listObjectsEffect: Effect.fail(error),
			});

			const backuper = await harness.getBackuper();
			const exit = await Effect.runPromiseExit(backuper.cleanUpOldBackups());

			expect(Exit.isFailure(exit)).toBe(true);
			if (Exit.isFailure(exit)) {
				const failure = Cause.failureOption(exit.cause);

				expect(failure._tag).toBe("Some");
				if (failure._tag === "Some") {
					expect(failure.value).toBe(error);
				}
			}
		});

		it("fails when deleting one old backup fails", async () => {
			const error = new Error("deleteObject failed");
			const harness = makeHarness({
				maxBackups: 1,
				remoteFiles: [{ key: "backup-1.zip" }, { key: "backup-2.zip" }],
				deleteObjectImplementation: () => Effect.fail(error),
			});

			const backuper = await harness.getBackuper();
			const exit = await Effect.runPromiseExit(backuper.cleanUpOldBackups());

			expect(Exit.isFailure(exit)).toBe(true);
			if (Exit.isFailure(exit)) {
				const failure = Cause.failureOption(exit.cause);

				expect(failure._tag).toBe("Some");
				if (failure._tag === "Some") {
					expect(failure.value).toBe(error);
				}
			}
		});
	});
});
