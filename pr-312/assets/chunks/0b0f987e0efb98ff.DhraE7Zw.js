import{l as n}from"./4a205126ab7c68a5.xgPF2eR8.js";const e=n+`
const { Console, Prompt } = __richLibrary["@promptctl/rich-js"];
const { nodeAsk } = __richLibrary["@promptctl/rich-js/node/prompt"];
//#region docs/__docs-example__.ts
var console = new Console();
{
	const name = await Prompt.ask("[bold cyan]What is your name?[/bold cyan]", nodeAsk);
	console.print(\`Hello, [bold magenta]\${name}[/bold magenta]! :wave:\`);
}
//#endregion
`;export{e as default};
