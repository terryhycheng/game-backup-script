import { NodeFileSystem, NodeRuntime } from "@effect/platform-node";
import dotenv from "dotenv";
import { Effect, Layer, pipe } from "effect";
import { PalBackupConfigLive } from "./configs";
import { Backuper } from "./modules/backuper";
import { S3 } from "./modules/s3";

dotenv.config();

const program = Effect.gen(function* () {
	const backuper = yield* Backuper;

	yield* backuper.syncBackups();
	yield* backuper.cleanUpOldBackups();
});

const PalBackupLayers = Backuper.Default.pipe(
	Layer.provide(S3.Default),
	Layer.provide(NodeFileSystem.layer),
	Layer.provide(PalBackupConfigLive),
);

const runnable = pipe(
	program,
	Effect.provide(PalBackupLayers),
	Effect.tapErrorCause((cause) => Effect.logError(cause.toString())),
);

NodeRuntime.runMain(runnable);
