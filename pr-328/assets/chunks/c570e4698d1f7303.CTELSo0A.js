import{l as n}from"./5af93a4dbe7ad1fd.7VfvCCgL.js";const t=n+`
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
