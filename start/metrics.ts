/**
 * The scrape endpoint.
 *
 * Parsec deliberately does not mount this: a metrics body names every route
 * the app has, its traffic shape and its error rate, so publishing it is a
 * decision. Here it is behind a token when `METRICS_TOKEN` is set, and open
 * otherwise — which is fine for a sample app and would not be in production.
 */
import { metricsHandler } from "@c9up/parsec/endpoint";
import metrics from "@c9up/parsec/services/main";
import router from "@c9up/ream/services/router";

router.get(
	"/__metrics",
	metricsHandler(metrics, { token: process.env.METRICS_TOKEN || undefined }),
);
