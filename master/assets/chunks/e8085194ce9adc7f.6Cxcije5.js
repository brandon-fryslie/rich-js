import{l as o}from"./c0f720c088f671b0.DFiDx-YT.js";const e=o+`
const { Confirm, Console } = __richLibrary["@promptctl/rich-js"];
const { nodeAsk } = __richLibrary["@promptctl/rich-js/node/prompt"];
//#region docs/__docs-example__.ts
var console = new Console();
{
	const deploy = async () => {
		console.print("[bold green]:rocket: deployed[/]");
	};
	if (await Confirm.ask("Deploy to production?", nodeAsk)) await deploy();
}
//#endregion
`;export{e as default};
