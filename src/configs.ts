import { Config, Context, Layer } from "effect";

export const EnvConfig = Config.all({
	s3AccessKeyId: Config.redacted(Config.string("S3_ACCESS_KEY_ID")),
	s3SecretAccessKey: Config.redacted(Config.string("S3_SECRET_ACCESS_KEY")),
	s3Endpoint: Config.url("S3_ENDPOINT"),
	s3Region: Config.string("S3_REGION"),
});

export class GameBackupConfigService extends Context.Tag("GameConfig")<
	GameBackupConfigService,
	{
		readonly folderLocation: string;
		readonly logFolderLocation: string;
		readonly bucketName: string;
		readonly bucketFolderName: string;
		readonly maxBackups: number;
	}
>() {}

const GameBackupConfig = Config.all({
	folderLocation: Config.string("FOLDER_LOCATION").pipe(Config.withDefault("/data/backups")),
	logFolderLocation: Config.string("LOG_FOLDER_LOCATION").pipe(Config.withDefault("/data/logs")),
	bucketName: Config.string("BUCKET_NAME").pipe(Config.withDefault("game-backups")),
	bucketFolderName: Config.string("BUCKET_FOLDER_NAME").pipe(Config.withDefault("backups")),
	maxBackups: Config.number("MAX_BACKUPS").pipe(Config.withDefault(30)),
}).pipe(Config.nested("GAME"));

export const GameBackupConfigLive = Layer.effect(GameBackupConfigService, GameBackupConfig);
