import{l as o}from"./173245d0fe91c2b0.DQ3IAB3c.js";const r=o+`
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
`;export{r as default};
