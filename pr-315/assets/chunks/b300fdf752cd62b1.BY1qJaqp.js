import{l as n}from"./99988ca8f3f3017f.CaPaJJL-.js";const r=n+`
const { nodeAsk } = __richLibrary["@promptctl/rich-js/node/prompt"];
const { Confirm, Console } = __richLibrary["@promptctl/rich-js"];
//#region docs/__docs-example__.ts
var console = new Console();
{
	const ok = await Confirm.ask("Continue?", nodeAsk, { default: true });
	const sure = await Confirm.ask("¿Seguro?", nodeAsk, { choices: ["s", "n"] });
	console.print(ok && sure ? "[green]continuing[/]" : "[red]stopped[/]");
}
//#endregion
`;export{r as default};
