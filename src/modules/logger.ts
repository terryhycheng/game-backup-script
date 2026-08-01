import { FileSystem } from "@effect/platform";
import { Effect, pipe } from "effect";
import { GameBackupConfigService } from "../configs";

export class Logger extends Effect.Service<Logger>()("Logger", {
	effect: Effect.gen(function* () {
		const gameConfig = yield* GameBackupConfigService;
		const fs = yield* FileSystem.FileSystem;
		const logFolderName = gameConfig.bucketFolderName;
		const logfileName = `${logFolderName}-${new Date().toISOString().replace(/[:.]/g, "-")}.log`;

		const writeLog = (message: { level: "INFO" | "ERROR"; message: string }) => {
			const log = `${message.level} ${new Date().toISOString()} ${message.message}\n`;
			const writeToConsole = message.level === "ERROR" ? console.error : console.log;

			return pipe(
				fs.writeFileString(`${gameConfig.logFolderLocation}/${logfileName}`, log, { flag: "a" }),
				Effect.tap(() => Effect.sync(() => writeToConsole(log.trimEnd()))),
			);
		};

		const info = (message: string) => writeLog({ level: "INFO", message });
		const error = (message: string) => writeLog({ level: "ERROR", message });

		return { info, error } as const;
	}),
}) {}
