import{l as o}from"./5af93a4dbe7ad1fd.7VfvCCgL.js";const t=o+`
const { nodeAsk } = __richLibrary["@promptctl/rich-js/node/prompt"];
const { Console, Prompt } = __richLibrary["@promptctl/rich-js"];
//#region docs/__docs-example__.ts
var console = new Console();
{
	const host = await Prompt.ask("Host", nodeAsk, { default: "localhost" });
	console.print(\`Connecting to [bold cyan]\${host}[/]…\`);
}
//#endregion
`;export{t as default};
