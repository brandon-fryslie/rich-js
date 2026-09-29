import{l as o}from"./b5bafe06d61feb8c.CIvMfMp7.js";const t=o+`
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
