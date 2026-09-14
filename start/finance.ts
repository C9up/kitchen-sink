/**
 * A route exercising @c9up/atom's exact decimal arithmetic.
 *
 * Money is the case floating point gets wrong quietly: `0.1 + 0.2` is not
 * `0.3`, and splitting a budget three ways loses a cent unless the remainder
 * is distributed deliberately. Both are asserted end to end rather than in a
 * unit test, because the value has to survive JSON on the way out too.
 */
import { Money } from "@c9up/atom";
import router from "@c9up/ream/services/router";

router.post("/finance/split", ({ request, response }) => {
	const amount = String(request.input("amount") ?? "0");
	const shares = Number(request.input("shares") ?? 1);
	if (!Number.isInteger(shares) || shares < 1 || shares > 100) {
		response.status(422).json({ error: "shares must be an integer 1-100" });
		return;
	}

	const total = Money.fromMajor(amount, "EUR");
	// `allocate` hands the remainder out a minor unit at a time rather than
	// rounding each share, so the parts always sum back to the total. Dividing
	// and rounding instead is how a cent goes missing.
	const parts = total.allocate(Array.from({ length: shares }, () => 1));

	response.json({
		total: total.toString(),
		parts: parts.map((part) => part.toString()),
		sum: parts
			.reduce((acc, part) => acc.plus(part), Money.fromMajor("0", "EUR"))
			.toString(),
	});
});

router.get("/finance/sum", ({ response }) => {
	// The one every developer has been bitten by.
	const result = Money.fromMajor("0.1", "EUR").plus(Money.fromMajor("0.2", "EUR"));
	response.json({ exact: result.toString(), float: String(0.1 + 0.2) });
});
