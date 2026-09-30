import{l as n}from"./583ff4ed3de9588e.B7k2pi_p.js";const a=n+`
const { Console, Prompt } = __richLibrary["@promptctl/rich-js"];
const { nodeAsk } = __richLibrary["@promptctl/rich-js/node/prompt"];
//#region docs/__docs-example__.ts
var console = new Console();
{
	const name = await Prompt.ask("[bold cyan]What is your name?[/bold cyan]", nodeAsk);
	console.print(\`Hello, [bold magenta]\${name}[/bold magenta]! :wave:\`);
}
//#endregion
`;export{a as default};
