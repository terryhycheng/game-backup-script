import { Config, Context, Layer } from "effect";

export const EnvConfig = Config.all({
	s3AccessKeyId: Config.redacted(Config.string("S3_ACCESS_KEY_ID")),
	s3SecretAccessKey: Config.redacted(Config.string("S3_SECRET_ACCESS_KEY")),
	endpoint: Config.url("S3_ENDPOINT"),
});

export class GameBackupConfigService extends Context.Tag("GameConfig")<
	GameBackupConfigService,
	{
		readonly folderLocation: string;
		readonly bucketName: string;
		readonly bucketFolderName?: string;
		readonly maxBackups: number;
	}
>() {}

const GameBackupConfig = Config.all({
	folderLocation: Config.string("FOLDER_LOCATION").pipe(Config.withDefault(".")),
	bucketName: Config.string("BUCKET_NAME").pipe(Config.withDefault("game-backups")),
	bucketFolderName: Config.string("BUCKET_FOLDER_NAME").pipe(Config.withDefault("backups")),
	maxBackups: Config.number("MAX_BACKUPS").pipe(Config.withDefault(30)),
}).pipe(Config.nested("GAME"));

export const GameBackupConfigLive = Layer.effect(GameBackupConfigService, GameBackupConfig);
