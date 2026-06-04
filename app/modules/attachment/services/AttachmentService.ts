import { randomUUID } from "node:crypto";
import { type AsyncDatabaseConnection, BaseRepository } from "@c9up/atlas";
import { StorageManager } from "@c9up/archive";
import { inject, Inject } from "@c9up/ream";
import { Attachment } from "../entities/Attachment.js";

@inject()
export class AttachmentService {
	readonly attachments: BaseRepository<Attachment>;

	constructor(
		@Inject("db") db: AsyncDatabaseConnection,
		@Inject(StorageManager) private readonly storage: StorageManager,
	) {
		this.attachments = new BaseRepository(Attachment, db);
	}

	async upload(input: {
		taskId: string;
		uploadedById: string;
		filename: string;
		contentType: string;
		contentBase64: string;
	}): Promise<Attachment> {
		const buffer = Buffer.from(input.contentBase64, "base64");
		// Composite key keeps file names unique even when two users
		// upload `report.pdf` to the same task. The randomUUID prefix
		// is also why we don't need to worry about path traversal
		// from the user's filename here — the filename never reaches
		// the storage driver's `put` path.
		const storageKey = `attachments/${input.taskId}/${randomUUID()}-${sanitize(input.filename)}`;
		await this.storage.put(storageKey, buffer);

		const created = await this.attachments.create({
			taskId: input.taskId,
			uploadedById: input.uploadedById,
			filename: input.filename,
			contentType: input.contentType,
			size: buffer.length,
			storageKey,
			createdAt: new Date(),
		});
		return this.attachments.findOrFail(created.id);
	}

	async find(id: string): Promise<Attachment | null> {
		return this.attachments.find(id);
	}

	async listForTask(taskId: string): Promise<Attachment[]> {
		return this.attachments.where("taskId", taskId);
	}

	async download(attachment: Attachment): Promise<Buffer | null> {
		return this.storage.get(attachment.storageKey);
	}
}

function sanitize(filename: string): string {
	// Validator already rejects path-traversal patterns; this is a
	// belt-and-suspenders ASCII clamp so the storage key stays a
	// stable identifier across filesystems.
	return filename.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 80) || "file";
}
