import { NodeFileSystem, NodeRuntime } from "@effect/platform-node";
import dotenv from "dotenv";
import { Effect, Layer, pipe } from "effect";
import { GameBackupConfigLive } from "./configs";
import { Backuper } from "./modules/backuper";
import { Logger } from "./modules/logger";
import { S3 } from "./modules/s3";

dotenv.config();

const program = Effect.gen(function* () {
	const backuper = yield* Backuper;
	const logger = yield* Logger;

	return pipe(
		backuper.syncBackups(),
		Effect.tap(() => backuper.cleanUpOldBackups()),
		Effect.tapErrorCause((cause) => logger.error(cause.toString())),
	);
});

const SharedLayers = Layer.mergeAll(NodeFileSystem.layer, GameBackupConfigLive);
const loggerLayer = Layer.provideMerge(Logger.Default, SharedLayers);

const GameBackupLayers = Backuper.Default.pipe(Layer.provide(S3.Default), Layer.provideMerge(loggerLayer));

const runnable = pipe(
	program,
	Effect.provide(GameBackupLayers),
	Effect.tapErrorCause((cause) => Effect.logError(cause.toString())),
);

NodeRuntime.runMain(runnable);
