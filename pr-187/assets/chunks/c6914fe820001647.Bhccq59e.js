import{l as n}from"./586602a85bd8c55d.7rZrhByC.js";const r=n+`
const { nodeAsk } = __richLibrary["@promptctl/rich-js/node/prompt"];
const { Confirm, Console } = __richLibrary["@promptctl/rich-js"];
//#region docs/__docs-example__.ts
var console = new Console();
{
	const ok = await Confirm.ask("Continue?", nodeAsk, { default: true });
	console.print(ok ? "[green]continuing[/]" : "[red]stopped[/]");
}
//#endregion
`;export{r as default};
