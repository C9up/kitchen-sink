import { Migration } from "@c9up/atlas";

export default class CreateUsers extends Migration {
	async up() {
		this.schema.createTable("users", (t) => {
			// `gen_random_uuid()` / `NOW()` shortcuts aren't sqlite-safe, so
			// the migration writes columns explicitly — atlas's BaseEntity
			// supplies `id` (randomUUID) and timestamps at insert time.
			t.uuid("id").primary();
			t.text("email").notNullable();
			t.text("password_hash").notNullable();
			t.text("display_name").notNullable();
			t.text("locale").notNullable().defaultTo("'fr'");
			t.timestamp("created_at").notNullable();
			t.timestamp("updated_at").notNullable();
			t.timestamp("deleted_at").nullable();
			t.uniqueIndex(["email"], "users_email_unique");
		});
	}

	async down() {
		this.schema.dropTable("users");
	}
}
