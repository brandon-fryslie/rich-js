import{l as o}from"./c6f694e9ae34fbf2.89e66cE3.js";const n=o+`
const { Console, FloatPrompt, IntPrompt } = __richLibrary["@promptctl/rich-js"];
const { nodeAsk } = __richLibrary["@promptctl/rich-js/node/prompt"];
//#region docs/__docs-example__.ts
var console = new Console();
{
	const port = await IntPrompt.ask("Port number", nodeAsk, { default: 3e3 });
	const threshold = await FloatPrompt.ask("Threshold (0.0–1.0)", nodeAsk);
	console.print({
		port,
		threshold
	});
}
//#endregion
`;export{n as default};
