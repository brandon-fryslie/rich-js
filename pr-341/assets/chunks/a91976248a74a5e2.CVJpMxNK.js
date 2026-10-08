import{l as n}from"./ffd0c7c3b2a9de30.DpbNAnUh.js";const r=n+`
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
