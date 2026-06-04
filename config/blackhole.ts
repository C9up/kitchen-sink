import { defineConfig } from "@c9up/blackhole/config";

export default defineConfig({
	xss: true,
	csrf: false, // CSRF off so cross-origin smoke tests can POST without a token
	rateLimit: { max: 1000, windowSeconds: 60 },
});
