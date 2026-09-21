/**
 * An application-owned command.
 *
 * Nothing registers it. Every class default-exported from `commands/` is
 * discovered, and it appears in `ream list` and in a bare `ream --help`
 * beside the framework's own — `reamrc.commands` is for packages, not this.
 */

import { BaseCommand } from "@c9up/ream/console";

export default class Greet extends BaseCommand {
	static commandName = "greet";
	static description = "Greet someone — an app command, discovered from commands/";

	async run(): Promise<void> {
		this.logger.info("hello");
	}
}
