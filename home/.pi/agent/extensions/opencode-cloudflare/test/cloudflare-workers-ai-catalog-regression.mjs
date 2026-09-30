import assert from "node:assert/strict";

const originalFetch = globalThis.fetch;
const remoteConfigUrl = "https://opencode.cloudflare.dev/config/opencode.json";

const workersModels = {
	"@cf/moonshotai/kimi-k2.5": { name: "Kimi K2.5" },
	"@cf/moonshotai/kimi-k2.6": { name: "Kimi K2.6" },
	"@cf/moonshotai/kimi-k2.7-code": { name: "Kimi K2.7 Code" },
};

globalThis.fetch = async (input) => {
	const url = typeof input === "string" ? input : input.url;
	if (url === "https://opencode.cloudflare.dev/.well-known/opencode") {
		return Response.json({
			auth: { env: "TOKEN" },
			remote_config: { url: remoteConfigUrl },
		});
	}
	if (url === remoteConfigUrl) {
		return Response.json({
			enabled_providers: ["cloudflare-workers-ai"],
			provider: {
				"cloudflare-workers-ai": {
					options: { baseURL: "https://opencode.cloudflare.dev/compat" },
					models: workersModels,
				},
			},
		});
	}
	throw new Error(`Unexpected request: ${url}`);
};

try {
	const { clearGatewayConfigCache, getGatewayConfig, stripRoutePrefix } = await import("../wellknown.ts");
	const { refreshCatalog } = await import("../catalog.ts");

	clearGatewayConfigCache();
	const gateway = await getGatewayConfig({ forceReload: true, fallbackToDefault: false });
	assert.deepEqual(gateway.enabledBackends, ["workers-ai"]);
	assert.equal(gateway.routes["workers-ai"].baseUrl, "https://opencode.cloudflare.dev/compat");
	assert.deepEqual(gateway.routes["workers-ai"].models, workersModels);
	assert.equal(stripRoutePrefix("cloudflare-workers-ai/@cf/moonshotai/kimi-k2.7-code", "workers-ai"), "@cf/moonshotai/kimi-k2.7-code");

	const catalog = await refreshCatalog(true);
	assert.deepEqual(
		catalog.models.map((model) => model.id),
		["@cf/moonshotai/kimi-k2.5", "@cf/moonshotai/kimi-k2.6", "@cf/moonshotai/kimi-k2.7-code"],
	);
	assert.equal(catalog.counts["workers-ai"], 3);
	assert.equal(
		catalog.routes.get("@cf/moonshotai/kimi-k2.7-code")?.requestModelId,
		"workers-ai/@cf/moonshotai/kimi-k2.7-code",
	);

	console.log("cloudflare workers ai catalog regression checks passed");
} finally {
	globalThis.fetch = originalFetch;
}
