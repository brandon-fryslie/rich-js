import{l as n}from"./cc9417e2125cb21a.CG_qdqJu.js";const r=n+`
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
