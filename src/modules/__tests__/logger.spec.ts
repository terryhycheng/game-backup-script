import { FileSystem } from "@effect/platform";
import { Cause, Effect, Exit, Layer } from "effect";
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { GameBackupConfigService } from "../../configs";
import { Logger } from "../logger";

describe("Logger", () => {
	const frozenNow = new Date("2026-07-31T13:00:01.234Z");
	let logSpy: ReturnType<typeof vi.spyOn>;
	let errorSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(frozenNow);
		logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
		errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
	});

	afterEach(() => {
		vi.useRealTimers();
		logSpy.mockRestore();
		errorSpy.mockRestore();
	});

	const makeHarness = (options?: {
		bucketFolderName?: string | undefined;
		writeFileStringImplementation?: (path: string, data: string, options?: { flag?: string }) => Effect.Effect<unknown, Error>;
	}) => {
		const writeFileString = vi.fn(
			(path: string, data: string, writeOptions?: { flag?: string }) =>
				options?.writeFileStringImplementation?.(path, data, writeOptions) ?? Effect.void,
		) as Mock;

		const fileSystemLayer = Layer.succeed(FileSystem.FileSystem, {
			writeFileString,
		} as never);
		const configLayer = Layer.succeed(GameBackupConfigService, {
			folderLocation: "/backups",
			logFolderLocation: "/data/logs",
			bucketName: "test-bucket",
			bucketFolderName: options?.bucketFolderName ?? "palworld",
			maxBackups: 2,
		});
		const layer = Layer.provide(Logger.Default, Layer.mergeAll(fileSystemLayer, configLayer));

		const getLogger = () =>
			Effect.runPromise(
				Effect.gen(function* () {
					return yield* Logger;
				}).pipe(Effect.provide(layer)),
			);

		return {
			getLogger,
			writeFileString,
		};
	};

	it("writes info logs to the expected file with append mode", async () => {
		const harness = makeHarness();
		const logger = await harness.getLogger();

		await Effect.runPromise(logger.info("backup completed"));

		expect(harness.writeFileString).toHaveBeenCalledTimes(1);
		expect(harness.writeFileString).toHaveBeenCalledWith(
			"/data/logs/palworld-2026-07-31T13-00-01-234Z.log",
			"INFO 2026-07-31T13:00:01.234Z backup completed\n",
			{ flag: "a" },
		);
		expect(logSpy).toHaveBeenCalledWith("INFO 2026-07-31T13:00:01.234Z backup completed");
		expect(errorSpy).not.toHaveBeenCalled();
	});

	it("writes error logs to the expected file with append mode", async () => {
		const harness = makeHarness();
		const logger = await harness.getLogger();

		await Effect.runPromise(logger.error("upload failed"));

		expect(harness.writeFileString).toHaveBeenCalledTimes(1);
		expect(harness.writeFileString).toHaveBeenCalledWith(
			"/data/logs/palworld-2026-07-31T13-00-01-234Z.log",
			"ERROR 2026-07-31T13:00:01.234Z upload failed\n",
			{ flag: "a" },
		);
		expect(errorSpy).toHaveBeenCalledWith("ERROR 2026-07-31T13:00:01.234Z upload failed");
		expect(logSpy).not.toHaveBeenCalled();
	});

	it("propagates write errors from info logs", async () => {
		const error = new Error("write failed");
		const harness = makeHarness({
			writeFileStringImplementation: () => Effect.fail(error),
		});
		const logger = await harness.getLogger();

		const exit = await Effect.runPromiseExit(logger.info("backup completed"));

		expect(Exit.isFailure(exit)).toBe(true);
		if (Exit.isFailure(exit)) {
			const failure = Cause.failureOption(exit.cause);

			expect(failure._tag).toBe("Some");
			if (failure._tag === "Some") {
				expect(failure.value).toBe(error);
			}
		}
	});

	it("uses bucketFolderName in the log file name", async () => {
		const harness = makeHarness({
			bucketFolderName: "custom-folder",
		});
		const logger = await harness.getLogger();

		await Effect.runPromise(logger.info("backup completed"));

		expect(harness.writeFileString).toHaveBeenCalledWith(
			"/data/logs/custom-folder-2026-07-31T13-00-01-234Z.log",
			"INFO 2026-07-31T13:00:01.234Z backup completed\n",
			{ flag: "a" },
		);
	});
});
