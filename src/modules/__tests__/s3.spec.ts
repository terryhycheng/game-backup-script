import { DeleteObjectCommand, ListObjectsCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Cause, Effect, Exit, Layer } from "effect";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { GameBackupConfigService } from "../../configs";
import { S3, S3ClientInstance, S3Error } from "../s3";

describe("S3ServiceTests", () => {
	let client: S3Client;
	let mockLayer: Layer.Layer<S3ClientInstance, never, never>;
	let gameBackupConfigLayer: Layer.Layer<GameBackupConfigService, never, never>;

	beforeEach(() => {
		client = new S3Client({
			region: "us-east-1",
			credentials: {
				accessKeyId: "test",
				secretAccessKey: "test",
			},
		});

		client.send = vi.fn() as typeof client.send;
		mockLayer = Layer.succeed(S3ClientInstance, new S3ClientInstance(client));
		gameBackupConfigLayer = Layer.succeed(GameBackupConfigService, {
			folderLocation: "/tmp/backups",
			logFolderLocation: "/tmp/logs",
			bucketName: "test-bucket",
			bucketFolderName: "palworld",
			maxBackups: 5,
		});
	});

	describe("listObjects", () => {
		it("should list objects", async () => {
			const expectedOutcome = { Contents: [{ Key: "test-key", LastModified: new Date() }] };
			(client.send as Mock).mockResolvedValueOnce(expectedOutcome);

			const program = Effect.gen(function* () {
				const s3 = yield* S3;
				const result = yield* s3.listObjects("test-bucket");
				return result;
			}).pipe(
				Effect.provide(Layer.provide(S3.DefaultWithoutDependencies, Layer.merge(mockLayer, gameBackupConfigLayer))),
			);

			const result = await Effect.runPromise(program);

			expect(client.send).toHaveBeenCalledTimes(1);

			const firstCall = (client.send as Mock).mock.calls[0];
			expect(firstCall).toBeDefined();

			const [command] = firstCall!;
			expect(command).toBeInstanceOf(ListObjectsCommand);
			expect(command.input).toEqual({ Bucket: "test-bucket", Prefix: "palworld/" });

			expect(client.send).toHaveBeenCalledWith(expect.any(ListObjectsCommand));
			expect(result).toEqual(
				expectedOutcome.Contents.map((file) => ({ key: file.Key, lastModified: file.LastModified })),
			);
		});

		it("should return an empty array if no files on bucket", async () => {
			const expectedOutcome = {};
			(client.send as Mock).mockResolvedValueOnce(expectedOutcome);

			const program = Effect.gen(function* () {
				const s3 = yield* S3;
				const result = yield* s3.listObjects("test-bucket");
				return result;
			}).pipe(
				Effect.provide(Layer.provide(S3.DefaultWithoutDependencies, Layer.merge(mockLayer, gameBackupConfigLayer))),
			);

			const result = await Effect.runPromise(program);

			expect(client.send).toHaveBeenCalledTimes(1);

			const firstCall = (client.send as Mock).mock.calls[0];
			expect(firstCall).toBeDefined();

			const [command] = firstCall!;
			expect(command).toBeInstanceOf(ListObjectsCommand);
			expect(command.input).toEqual({ Bucket: "test-bucket", Prefix: "palworld/" });

			expect(client.send).toHaveBeenCalledWith(expect.any(ListObjectsCommand));
			expect(result).toEqual([]);
		});

		it("should throw S3Error if one listed object has no key", async () => {
			(client.send as Mock).mockResolvedValueOnce({
				Contents: [{ LastModified: new Date() }],
			});

			const program = Effect.gen(function* () {
				const s3 = yield* S3;
				const result = yield* s3.listObjects("test-bucket");
				return result;
			}).pipe(
				Effect.provide(Layer.provide(S3.DefaultWithoutDependencies, Layer.merge(mockLayer, gameBackupConfigLayer))),
			);

			const exit = await Effect.runPromiseExit(program);

			expect(Exit.isFailure(exit)).toBe(true);

			if (Exit.isFailure(exit)) {
				const failure = Cause.failureOption(exit.cause);

				expect(failure._tag).toBe("Some");
				if (failure._tag === "Some") {
					expect(failure.value).toBeInstanceOf(S3Error);
					expect(failure.value.message).toBe("failed to list objects in s3");
					expect(failure.value.cause).toBeInstanceOf(Error);
					expect((failure.value.cause as Error).message).toContain("no key in file");
				}
			}

			expect(client.send).toHaveBeenCalledTimes(1);
			expect(client.send).toHaveBeenCalledWith(expect.any(ListObjectsCommand));
		});

		it("should throw S3Error if fail to list objects", async () => {
			(client.send as Mock).mockRejectedValueOnce(new Error("error"));

			const program = Effect.gen(function* () {
				const s3 = yield* S3;
				const result = yield* s3.listObjects("test-bucket");
				return result;
			}).pipe(
				Effect.provide(Layer.provide(S3.DefaultWithoutDependencies, Layer.merge(mockLayer, gameBackupConfigLayer))),
			);

			const exit = await Effect.runPromiseExit(program);

			expect(Exit.isFailure(exit)).toBe(true);

			if (Exit.isFailure(exit)) {
				const failure = Cause.failureOption(exit.cause);

				expect(failure._tag).toBe("Some");
				if (failure._tag === "Some") {
					expect(failure.value).toBeInstanceOf(S3Error);
					expect(failure.value.message).toBe("failed to list objects in s3");
					expect(failure.value.cause).toEqual(new Error("error"));
				}
			}

			expect(client.send).toHaveBeenCalledTimes(1);

			const firstCall = (client.send as Mock).mock.calls[0];
			expect(firstCall).toBeDefined();

			const [command] = firstCall!;
			expect(command).toBeInstanceOf(ListObjectsCommand);
			expect(command.input).toEqual({ Bucket: "test-bucket", Prefix: "palworld/" });

			expect(client.send).toHaveBeenCalledWith(expect.any(ListObjectsCommand));
		});
	});

	describe("putObject", () => {
		it("should put object", async () => {
			(client.send as Mock).mockResolvedValueOnce("hello");

			const program = Effect.gen(function* () {
				const s3 = yield* S3;
				const result = yield* s3.putObject("test-bucket", "test-key", new Uint8Array());
				return result;
			}).pipe(
				Effect.provide(Layer.provide(S3.DefaultWithoutDependencies, Layer.merge(mockLayer, gameBackupConfigLayer))),
			);

			const result = await Effect.runPromise(program);

			expect(client.send).toHaveBeenCalledTimes(1);

			const firstCall = (client.send as Mock).mock.calls[0];
			expect(firstCall).toBeDefined();

			const [command] = firstCall!;
			expect(command).toBeInstanceOf(PutObjectCommand);
			expect(command.input).toEqual({ Bucket: "test-bucket", Key: "palworld/test-key", Body: new Uint8Array() });

			expect(client.send).toHaveBeenCalledWith(expect.any(PutObjectCommand));
			expect(result).toEqual("hello");
		});

		it("should prefix object key when bucket folder name exists", async () => {
			(client.send as Mock).mockResolvedValueOnce("hello");
			gameBackupConfigLayer = Layer.succeed(GameBackupConfigService, {
				folderLocation: "/tmp/backups",
				bucketName: "test-bucket",
				logFolderLocation: "/tmp/logs",
				bucketFolderName: "palworld",
				maxBackups: 5,
			});

			const program = Effect.gen(function* () {
				const s3 = yield* S3;
				const result = yield* s3.putObject("test-bucket", "test-key", new Uint8Array());
				return result;
			}).pipe(
				Effect.provide(Layer.provide(S3.DefaultWithoutDependencies, Layer.merge(mockLayer, gameBackupConfigLayer))),
			);

			const result = await Effect.runPromise(program);

			expect(client.send).toHaveBeenCalledTimes(1);

			const firstCall = (client.send as Mock).mock.calls[0];
			expect(firstCall).toBeDefined();

			const [command] = firstCall!;
			expect(command).toBeInstanceOf(PutObjectCommand);
			expect(command.input).toEqual({ Bucket: "test-bucket", Key: "palworld/test-key", Body: new Uint8Array() });

			expect(client.send).toHaveBeenCalledWith(expect.any(PutObjectCommand));
			expect(result).toEqual("hello");
		});

		it("should throw S3Error if fail to put object", async () => {
			(client.send as Mock).mockRejectedValueOnce(new Error("error"));

			const program = Effect.gen(function* () {
				const s3 = yield* S3;
				const result = yield* s3.putObject("test-bucket", "test-key", new Uint8Array());
				return result;
			}).pipe(
				Effect.provide(Layer.provide(S3.DefaultWithoutDependencies, Layer.merge(mockLayer, gameBackupConfigLayer))),
			);

			await expect(Effect.runPromise(program)).rejects.toThrow("failed to put object to s3");

			expect(client.send).toHaveBeenCalledTimes(1);

			const firstCall = (client.send as Mock).mock.calls[0];
			expect(firstCall).toBeDefined();

			const [command] = firstCall!;
			expect(command).toBeInstanceOf(PutObjectCommand);
			expect(command.input).toEqual({ Bucket: "test-bucket", Key: "palworld/test-key", Body: new Uint8Array() });

			expect(client.send).toHaveBeenCalledWith(expect.any(PutObjectCommand));
		});
	});

	describe("deleteObject", () => {
		it("should delete object", async () => {
			(client.send as Mock).mockResolvedValueOnce("hello");

			const program = Effect.gen(function* () {
				const s3 = yield* S3;
				const result = yield* s3.deleteObject("test-bucket", "test-key");
				return result;
			}).pipe(
				Effect.provide(Layer.provide(S3.DefaultWithoutDependencies, Layer.merge(mockLayer, gameBackupConfigLayer))),
			);

			const result = await Effect.runPromise(program);

			expect(client.send).toHaveBeenCalledTimes(1);

			const firstCall = (client.send as Mock).mock.calls[0];
			expect(firstCall).toBeDefined();

			const [command] = firstCall!;
			expect(command).toBeInstanceOf(DeleteObjectCommand);
			expect(command.input).toEqual({ Bucket: "test-bucket", Key: "test-key" });

			expect(client.send).toHaveBeenCalledWith(expect.any(DeleteObjectCommand));
			expect(result).toEqual("hello");
		});

		it("should throw S3Error if fail to delete object", async () => {
			(client.send as Mock).mockRejectedValueOnce(new Error("error"));

			const program = Effect.gen(function* () {
				const s3 = yield* S3;
				const result = yield* s3.deleteObject("test-bucket", "test-key");
				return result;
			}).pipe(
				Effect.provide(Layer.provide(S3.DefaultWithoutDependencies, Layer.merge(mockLayer, gameBackupConfigLayer))),
			);

			await expect(Effect.runPromise(program)).rejects.toThrow("failed to delete object from s3");

			expect(client.send).toHaveBeenCalledTimes(1);

			const firstCall = (client.send as Mock).mock.calls[0];
			expect(firstCall).toBeDefined();

			const [command] = firstCall!;
			expect(command).toBeInstanceOf(DeleteObjectCommand);
			expect(command.input).toEqual({ Bucket: "test-bucket", Key: "test-key" });

			expect(client.send).toHaveBeenCalledWith(expect.any(DeleteObjectCommand));
		});
	});
});
