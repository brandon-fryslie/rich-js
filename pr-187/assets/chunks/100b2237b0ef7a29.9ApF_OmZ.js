import{l as t}from"./bf1a917d6fc0e215.Dn2lwbGF.js";const o=t+`
const { nodeAsk } = __richLibrary["@promptctl/rich-js/node/prompt"];
const { Console, Prompt } = __richLibrary["@promptctl/rich-js"];
//#region docs/__docs-example__.ts
var console = new Console();
{
	const env = await Prompt.ask("Environment", nodeAsk, { choices: [
		"dev",
		"staging",
		"prod"
	] });
	const level = await Prompt.ask("Log level", nodeAsk, {
		choices: [
			"DEBUG",
			"INFO",
			"WARN",
			"ERROR"
		],
		caseSensitive: false
	});
	console.print(\`[bold]\${env}[/] at [yellow]\${level}[/]\`);
}
//#endregion
`;export{o as default};
