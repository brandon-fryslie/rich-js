import{l as n}from"./99e2d26c2ac6bdc5.gDh_m7f2.js";const r=n+`
const { Console, Prompt } = __richLibrary["@promptctl/rich-js"];
const { nodeAsk } = __richLibrary["@promptctl/rich-js/node/prompt"];
//#region docs/__docs-example__.ts
var console = new Console();
{
	const name = await Prompt.ask("[bold cyan]What is your name?[/bold cyan]", nodeAsk);
	console.print(\`Hello, [bold magenta]\${name}[/bold magenta]! :wave:\`);
}
//#endregion
`;export{r as default};
