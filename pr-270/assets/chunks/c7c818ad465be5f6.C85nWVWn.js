import{l as t}from"./2e93ddb063a2a076.jqGIKPMz.js";const e=t+`
const { NodeTerminalHost } = __richLibrary["@promptctl/rich-js/node/terminal-host"];
const { Button, Checkbox, StaticItem, TextInput, WidgetApp } = __richLibrary["@promptctl/rich-js/widgets"];
const { Console, Group, Panel } = __richLibrary["@promptctl/rich-js"];
//#region docs/__docs-example__.ts
var console = new Console();
{
	const host = new NodeTerminalHost();
	new WidgetApp({
		host,
		surface: "alternate",
		view: () => new StaticItem({
			id: "empty",
			render: () => []
		})
	});
	new StaticItem({
		id: "header",
		render: () => []
	});
	new TextInput({ id: "name" });
	new Button({ label: "Save" });
	new StaticItem({
		id: "status",
		render: () => []
	});
	{
		const name = new TextInput({ placeholder: "your name" });
		const subscribe = new Checkbox({ label: "Subscribe to updates" });
		const submit = new Button({
			label: "Submit",
			variant: "primary"
		});
		const form = new Panel(new Group(name, subscribe, submit), { title: "Sign up" });
		const app = new WidgetApp({
			host: new NodeTerminalHost(),
			surface: "alternate",
			view: () => form
		});
		submit.onSubmit(() => app.stop());
		app.onKey((event) => {
			if (event.ctrl && event.key === "c") {
				event.stop();
				app.stop();
			}
		}, { priority: "high" });
		await app.run();
		console.log(\`\${name.value} — subscribed: \${subscribe.checked}\`);
	}
}
//#endregion
`;export{e as default};
