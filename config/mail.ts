import { defineConfig, transports } from "@c9up/rover";

/**
 * The sample app sends nothing: every mail is written to the console.
 */
export default defineConfig({
	default: "log",
	from: "noreply@kitchen-sink.test",

	mailers: {
		log: transports.log(),
	},
});
