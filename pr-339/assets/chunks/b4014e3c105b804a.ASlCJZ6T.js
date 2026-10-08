import{l as n}from"./164122d0914b7327.68XUuyrw.js";const t=n+`
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
