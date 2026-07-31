import { FileSystem } from "@effect/platform";
import { Effect } from "effect";
import { GameBackupConfigService } from "../configs";

	export class Logger extends Effect.Service<Logger>()("Logger", {
		effect: Effect.gen(function* () {
			const gameConfig = yield* GameBackupConfigService;
			const fs = yield* FileSystem.FileSystem;
			const logFolderName = gameConfig.bucketFolderName ?? "game-backup-script";
			const logFolderLocation = `/var/log/${logFolderName}`;
			const logfileName = `${logFolderName}-${new Date().toISOString().replace(/[:.]/g, "-")}.log`;

		const writeLog = (message: { level: "INFO" | "ERROR"; message: string }) => {
			const log = `${message.level} ${new Date().toISOString()} ${message.message}\n`;
			return fs.writeFileString(`${logFolderLocation}/${logfileName}`, log, { flag: "a" });
		};

		const info = (message: string) => writeLog({ level: "INFO", message });
		const error = (message: string) => writeLog({ level: "ERROR", message });

		return { info, error } as const;
	}),
}) {}
