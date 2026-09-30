import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/** Expand the short /show-me alias into Pi's native show-me skill command. */
export default function registerShowMeCommand(pi: ExtensionAPI): void {
	pi.registerCommand("show-me", {
		description: "Render a visual explanation using the show-me skill",
		handler: async (args) => {
			const request = args.trim();
			const skillCommand = request ? `/skill:show-me ${request}` : "/skill:show-me";
			pi.sendUserMessage(skillCommand, { expandPromptTemplates: true });
		},
	});
}
