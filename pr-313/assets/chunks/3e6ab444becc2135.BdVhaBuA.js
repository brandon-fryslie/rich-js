import{l as n}from"./71891f10e9721911.h9iN5jz5.js";const e=n+`
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
`;export{e as default};
