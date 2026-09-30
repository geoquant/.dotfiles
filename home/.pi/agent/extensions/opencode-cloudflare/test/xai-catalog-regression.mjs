import assert from "node:assert/strict";

const originalFetch = globalThis.fetch;
const remoteConfigUrl = "https://opencode.cloudflare.dev/config/opencode.json";

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
			enabled_providers: ["xai"],
			provider: {
				xai: {
					options: { baseURL: "https://opencode.cloudflare.dev/grok" },
				},
			},
		});
	}
	throw new Error(`Unexpected request: ${url}`);
};

try {
	const { clearGatewayConfigCache, getGatewayConfig } = await import("../wellknown.ts");
	const { refreshCatalog } = await import("../catalog.ts");

	clearGatewayConfigCache();
	const gateway = await getGatewayConfig({ forceReload: true, fallbackToDefault: false });
	assert.deepEqual(gateway.enabledBackends, ["xai"]);
	assert.equal(gateway.routes.xai.baseUrl, "https://opencode.cloudflare.dev/grok");

	const catalog = await refreshCatalog(true);
	assert.deepEqual(
		catalog.models.map((model) => model.id).sort(),
		[
			"grok-4.20-0309-non-reasoning",
			"grok-4.20-0309-reasoning",
			"grok-4.3",
			"grok-4.5",
			"grok-build-0.1",
		].sort(),
	);
	assert.equal(catalog.counts.xai, 5);
	assert.equal(catalog.routes.get("grok-4.3")?.api, "openai-completions");

	console.log("xai catalog regression checks passed");
} finally {
	globalThis.fetch = originalFetch;
}
