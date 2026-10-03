import{l as n}from"./6b3d0b3a6d4cabd4.BdKM3-2d.js";const t=n+`
const { Console, Prompt, Theme } = __richLibrary["@promptctl/rich-js"];
const { nodeAsk } = __richLibrary["@promptctl/rich-js/node/prompt"];
//#region docs/__docs-example__.ts
new Console();
{
	const app = new Console({ theme: new Theme({
		"prompt.choices": "bold green",
		"prompt.invalid.choice": "yellow"
	}) });
	const env = await Prompt.ask("Environment", nodeAsk, {
		choices: ["dev", "prod"],
		console: app
	});
	app.print(\`[bold]\${env}[/]\`);
}
//#endregion
`;export{t as default};
