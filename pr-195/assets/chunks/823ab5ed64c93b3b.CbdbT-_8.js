import{l as t}from"./0f1fe1c4b4f16929.CRnCe3eV.js";const e=t+`
const { NodeTerminalHost } = __richLibrary["@promptctl/rich-js/node/terminal-host"];
const { Button, Checkbox, DefaultFocusManager, DefaultScreen, EventRouter, StaticItem, TextInput } = __richLibrary["@promptctl/rich-js/widgets"];
const { Console } = __richLibrary["@promptctl/rich-js"];
//#region docs/__docs-example__.ts
new Console();
{
	const host = new NodeTerminalHost();
	const screen = new DefaultScreen({ host });
	new EventRouter({
		screen,
		host
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
		const host = new NodeTerminalHost();
		const focusManager = new DefaultFocusManager();
		const screen = new DefaultScreen({
			host,
			focusManager
		});
		const router = new EventRouter({
			screen,
			host
		});
		const name = new TextInput({ placeholder: "your name" });
		const subscribe = new Checkbox({ label: "Subscribe to updates" });
		const submit = new Button({
			label: "Submit",
			variant: "primary"
		});
		const quit = () => {
			router.stop();
			screen.stop();
			host.write("\\n");
		};
		submit.onSubmit(() => {
			quit();
			host.write(\`\${name.value} — subscribed: \${subscribe.checked}\\n\`);
			process.exit(0);
		});
		router.onKey((event) => {
			if (event.ctrl && event.key === "c") {
				event.stop();
				quit();
				process.exit(0);
			}
		}, { priority: "high" });
		screen.mount(name, subscribe, submit);
		screen.start();
		router.start();
	}
}
//#endregion
`;export{e as default};
