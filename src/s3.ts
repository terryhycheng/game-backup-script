import { DeleteObjectCommand, ListObjectsCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Data, Effect, Redacted } from "effect";
import { EnvConfig } from "./env-config";

export class S3Error extends Data.TaggedError("S3Error")<{
	readonly message: string;
	readonly cause: unknown;
}> {}

export class S3ClientInstance extends Effect.Service<S3ClientInstance>()("S3ServiceInstance", {
	effect: Effect.gen(function* () {
		const env = yield* EnvConfig;

		return new S3Client({
			region: "us-east-1",
			credentials: {
				accessKeyId: Redacted.value(env.s3AccessKeyId),
				secretAccessKey: Redacted.value(env.s3SecretAccessKey),
			},
		});
	}),
}) {}

export class S3 extends Effect.Service<S3>()("S3Service", {
	effect: Effect.gen(function* () {
		const client = yield* S3ClientInstance;
		const listObjects = (bucketName: string) => {
			const command = new ListObjectsCommand({ Bucket: bucketName });

			return Effect.tryPromise({
				try: () => client.send(command),
				catch: (error) => new S3Error({ message: "failed to list objects in s3", cause: error }),
			});
		};

		const putObject = (bucketName: string, key: string) => {
			const command = new PutObjectCommand({ Bucket: bucketName, Key: key });

			return Effect.tryPromise({
				try: () => client.send(command),
				catch: (error) => new S3Error({ message: "failed to put object to s3", cause: error }),
			});
		};

		const deleteObject = (bucketName: string, key: string) => {
			const command = new DeleteObjectCommand({ Bucket: bucketName, Key: key });

			return Effect.tryPromise({
				try: () => client.send(command),
				catch: (error) => new S3Error({ message: "failed to delete object from s3", cause: error }),
			});
		};

		return { putObject, listObjects, deleteObject } as const;
	}),

	dependencies: [S3ClientInstance.Default],
}) {}
