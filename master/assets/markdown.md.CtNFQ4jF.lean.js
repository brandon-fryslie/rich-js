import{C as h,o as c,c as d,j as s,a as i,E as t,w as n,ah as k}from"./chunks/framework.BvHrXSZt.js";const b=JSON.parse('{"title":"Markdown","description":"","frontmatter":{},"headers":[],"relativePath":"markdown.md","filePath":"markdown.md"}'),p={name:"markdown.md"},A=Object.assign(p,{setup(u){const l={run:"build",program:{files:[{name:"playground.ts",setup:{before:[],after:[]},code:`import { Console, Markdown } from "@promptctl/rich-js";

const console = new Console();

const md = new Markdown(\`# Hello, World!

This is **bold**, this is *italic*, and this is \\\`inline code\\\`.

> A quote is set off by a bar in the margin.

## A List

- Item one
- Item two
  - Nested item
- Item three

## Code

\\\`\\\`\\\`typescript
const greeting = (name: string) => \\\`Hello, \\\${name}!\\\`;
console.log(greeting("World"));
\\\`\\\`\\\`

---\`);

console.print(md);`}],terminal:{columns:75,rows:24}},label:"Output",caption:"produced by running the code above",tryIt:{playground:"playground",program:"program.eJxNUk2L2zAQ_Suzkx4cY6dQWhYcsnTZSwttT4UeVgt27LGjVppxpQkhGP_3oiTeLegwmvchzZMm7K2jiNXzhNx4wgpH15yHIEfuNhqxwEh6HLGacE-9BMLq-aXAplcKqZwLbKVLOutHCQoTPAlHcVTA9yb86eTEMEMfxIPBz2MQP2qr7n2w7aH8HQ1uDRtuhaNCe1XCDphOi0-2_o_huxu4eGf1Cr6Qc1LALwmuu0vcnwcbwUbI8724Ls8L0KVjtXG2zQtouHvtGlNbdpYJ0izG1Jvk8gCP8PcoSokSSUH6HvZnaGDfBLAMeiDwTRgsX_irFTzCNxs1bUr4quRBmF5rPYlhgBJ-UFTqwCr5N_AQiG4uT-kSbNiY-rr0PFJsgx11yWEIRGp5gB1k6d0qiBosD2vYPaRxbpEY825K8HxnTL29isXRxsmQLRaZwUtyBteXpJdDL1OUZf0Wf1KOwbJmvltvcX4pUCl4y41L_6MVd_Qcsbr_VGCQU8Tqw8d5_gfXsdHi"},output:{light:`<pre style="all:initial;direction:ltr;unicode-bidi:isolate;display:block;background:#fafafa;color:#383a42;padding:1em;font:var(--rich-fragment-font,medium/1.2 monospace);white-space:pre;overflow-x:auto">
<span style="color:#383a42">                               </span><span style="color:#383a42;font-weight:bold;text-decoration-line:underline">Hello, World!</span><span style="color:#383a42">                               </span>

<span style="color:#383a42">This is </span><span style="color:#383a42;font-weight:bold">bold</span><span style="color:#383a42">, this is </span><span style="color:#383a42;font-style:italic">italic</span><span style="color:#383a42">, and this is </span><span style="color:#00d7d7;background-color:#1c1c1c;font-weight:bold">inline code</span><span style="color:#383a42">.                     </span>

<span style="color:#c18401">▎ </span><span style="color:#86878c;font-style:italic">A quote is set off by a bar in the margin.                               </span>

<span style="color:#383a42;font-weight:bold">A List</span>

<span style="color:#383a42">  • Item one                                                               </span>
<span style="color:#383a42">  • Item two                                                               </span>
<span style="color:#383a42">      • Nested item                                                        </span>
<span style="color:#383a42">  • Item three                                                             </span>

<span style="color:#383a42;font-weight:bold">Code</span>

<span style="color:#00d7d7;background-color:#1c1c1c;font-weight:bold">const greeting = (name: string) =&gt; \`Hello, \${name}!\`;</span>
<span style="color:#00d7d7;background-color:#1c1c1c;font-weight:bold">console.log(greeting("World"));</span>

<span style="color:#c18401">───────────────────────────────────────────────────────────────────────────</span>
</pre>`,dark:`<pre style="all:initial;direction:ltr;unicode-bidi:isolate;display:block;background:#282c34;color:#abb2bf;padding:1em;font:var(--rich-fragment-font,medium/1.2 monospace);white-space:pre;overflow-x:auto">
<span style="color:#abb2bf">                               </span><span style="color:#abb2bf;font-weight:bold;text-decoration-line:underline">Hello, World!</span><span style="color:#abb2bf">                               </span>

<span style="color:#abb2bf">This is </span><span style="color:#abb2bf;font-weight:bold">bold</span><span style="color:#abb2bf">, this is </span><span style="color:#abb2bf;font-style:italic">italic</span><span style="color:#abb2bf">, and this is </span><span style="color:#00d7d7;background-color:#1c1c1c;font-weight:bold">inline code</span><span style="color:#abb2bf">.                     </span>

<span style="color:#e5c07b">▎ </span><span style="color:#777c87;font-style:italic">A quote is set off by a bar in the margin.                               </span>

<span style="color:#abb2bf;font-weight:bold">A List</span>

<span style="color:#abb2bf">  • Item one                                                               </span>
<span style="color:#abb2bf">  • Item two                                                               </span>
<span style="color:#abb2bf">      • Nested item                                                        </span>
<span style="color:#abb2bf">  • Item three                                                             </span>

<span style="color:#abb2bf;font-weight:bold">Code</span>

<span style="color:#00d7d7;background-color:#1c1c1c;font-weight:bold">const greeting = (name: string) =&gt; \`Hello, \${name}!\`;</span>
<span style="color:#00d7d7;background-color:#1c1c1c;font-weight:bold">console.log(greeting("World"));</span>

<span style="color:#e5c07b">───────────────────────────────────────────────────────────────────────────</span>
</pre>`,columns:75}},o={run:"build",program:{files:[{name:"playground.ts",setup:{before:[],after:[]},code:`import { Console, Markdown } from "@promptctl/rich-js";

const console = new Console({ width: 40 });

console.print(new Markdown("Read [the guide](https://example.com), then run \`npm test\`.", {
  hyperlinks: false,
  inlineCodeStyle: "bold magenta",
}));`}],terminal:{columns:75,rows:24}},label:"Output",caption:"produced by running the code above",tryIt:{playground:"playground",program:"program.eJw9kMFqwzAQRH9l2ZMNalJKSkGlUMi5l_YYBaJY61iNtBLSGjcY_3sxJb0Nw7wZmBl7H6iiPszINhJqzMHeLiWN7DZSUWElGTPqGc_Up0KoD0eFthcqq1wUdsmtnI85FYEZ9olrCqTgw5arSxPDAn1JEQy-55Jilk7CtvhuePiuBl8NG-4SV4Huj4Q3YJruPc0Mk3cyaNg9wtL-x1OgTS6epVnD963G4CdZBwcZCC6jd3RsBpFc9XZLPzbmQJsuxVaBDMRQRoYT5whCVU4bgwpmwwDDLVMJnq9VQ29DJbW6noNn2idHX3ILpMHgOQUH0V6IxRpUhpe2fcXlqFCoRM82rNd1KYyRK-qXZ4UlTRX1025ZfgFwooRS"},output:{light:`<pre style="all:initial;direction:ltr;unicode-bidi:isolate;display:block;background:#fafafa;color:#383a42;padding:1em;font:var(--rich-fragment-font,medium/1.2 monospace);white-space:pre;overflow-x:auto">
<span style="color:#383a42">Read </span><span style="color:#61afef">the guide</span><span style="color:#383a42"> (</span><a href="https://example.com/" style="all:unset;cursor:revert;outline:revert"><span style="color:#0184bc">https://example.com</span></a><span style="color:#383a42">),   </span>
<span style="color:#383a42">then run </span><span style="color:#a626a4;font-weight:bold">npm test</span><span style="color:#383a42">.                      </span>
</pre>`,dark:`<pre style="all:initial;direction:ltr;unicode-bidi:isolate;display:block;background:#282c34;color:#abb2bf;padding:1em;font:var(--rich-fragment-font,medium/1.2 monospace);white-space:pre;overflow-x:auto">
<span style="color:#abb2bf">Read </span><span style="color:#61afef">the guide</span><span style="color:#abb2bf"> (</span><a href="https://example.com/" style="all:unset;cursor:revert;outline:revert"><span style="color:#61afef">https://example.com</span></a><span style="color:#abb2bf">),   </span>
<span style="color:#abb2bf">then run </span><span style="color:#c678dd;font-weight:bold">npm test</span><span style="color:#abb2bf">.                      </span>
</pre>`,columns:40}},r={run:"never",label:"Not run",note:"It needs a real Node process (a file, stdin, or process exit). Run it locally to see it."};return(g,e)=>{const a=h("RichExample");return c(),d("div",null,[e[3]||(e[3]=s("h1",{id:"markdown",tabindex:"-1"},[i("Markdown "),s("a",{class:"header-anchor",href:"#markdown","aria-label":'Permalink to "Markdown"'},"​")],-1)),e[4]||(e[4]=s("p",null,[s("code",null,"Markdown"),i(" renders Markdown-formatted text in the terminal with styled headings, lists, emphasis, quotes, rules and code blocks.")],-1)),e[5]||(e[5]=s("h2",{id:"basic-usage",tabindex:"-1"},[i("Basic usage "),s("a",{class:"header-anchor",href:"#basic-usage","aria-label":'Permalink to "Basic usage"'},"​")],-1)),t(a,{card:l},{default:n(()=>[...e[0]||(e[0]=[s("div",{class:"language-typescript vp-adaptive-theme"},[s("button",{title:"Copy Code",class:"copy"}),s("span",{class:"lang"},"typescript"),s("pre",{class:"shiki shiki-themes one-light one-dark-pro vp-code",tabindex:"0"},[s("code",null,[s("span",{class:"line"},[s("span",{style:{"--shiki-light":"#A626A4","--shiki-dark":"#C678DD"}},"import"),s("span",{style:{"--shiki-light":"#383A42","--shiki-dark":"#ABB2BF"}}," { "),s("span",{style:{"--shiki-light":"#E45649","--shiki-dark":"#E06C75"}},"Console"),s("span",{style:{"--shiki-light":"#383A42","--shiki-dark":"#ABB2BF"}},", "),s("span",{style:{"--shiki-light":"#E45649","--shiki-dark":"#E06C75"}},"Markdown"),s("span",{style:{"--shiki-light":"#383A42","--shiki-dark":"#ABB2BF"}}," } "),s("span",{style:{"--shiki-light":"#A626A4","--shiki-dark":"#C678DD"}},"from"),s("span",{style:{"--shiki-light":"#50A14F","--shiki-dark":"#98C379"}},' "@promptctl/rich-js"'),s("span",{style:{"--shiki-light":"#383A42","--shiki-dark":"#ABB2BF"}},";")]),i(`
`),s("span",{class:"line"}),i(`
`),s("span",{class:"line"},[s("span",{style:{"--shiki-light":"#A626A4","--shiki-dark":"#C678DD"}},"const"),s("span",{style:{"--shiki-light":"#986801","--shiki-dark":"#E5C07B"}}," console"),s("span",{style:{"--shiki-light":"#0184BC","--shiki-dark":"#56B6C2"}}," ="),s("span",{style:{"--shiki-light":"#A626A4","--shiki-dark":"#C678DD"}}," new"),s("span",{style:{"--shiki-light":"#4078F2","--shiki-dark":"#61AFEF"}}," Console"),s("span",{style:{"--shiki-light":"#383A42","--shiki-dark":"#ABB2BF"}},"();")]),i(`
`),s("span",{class:"line"}),i(`
`),s("span",{class:"line"},[s("span",{style:{"--shiki-light":"#A626A4","--shiki-dark":"#C678DD"}},"const"),s("span",{style:{"--shiki-light":"#986801","--shiki-dark":"#E5C07B"}}," md"),s("span",{style:{"--shiki-light":"#0184BC","--shiki-dark":"#56B6C2"}}," ="),s("span",{style:{"--shiki-light":"#A626A4","--shiki-dark":"#C678DD"}}," new"),s("span",{style:{"--shiki-light":"#4078F2","--shiki-dark":"#61AFEF"}}," Markdown"),s("span",{style:{"--shiki-light":"#383A42","--shiki-dark":"#ABB2BF"}},"("),s("span",{style:{"--shiki-light":"#50A14F","--shiki-dark":"#98C379"}},"`# Hello, World!")]),i(`
`),s("span",{class:"line"}),i(`
`),s("span",{class:"line"},[s("span",{style:{"--shiki-light":"#50A14F","--shiki-dark":"#98C379"}},"This is **bold**, this is *italic*, and this is "),s("span",{style:{"--shiki-light":"#0184BC","--shiki-dark":"#56B6C2"}},"\\`"),s("span",{style:{"--shiki-light":"#50A14F","--shiki-dark":"#98C379"}},"inline code"),s("span",{style:{"--shiki-light":"#0184BC","--shiki-dark":"#56B6C2"}},"\\`"),s("span",{style:{"--shiki-light":"#50A14F","--shiki-dark":"#98C379"}},".")]),i(`
`),s("span",{class:"line"}),i(`
`),s("span",{class:"line"},[s("span",{style:{"--shiki-light":"#50A14F","--shiki-dark":"#98C379"}},"> A quote is set off by a bar in the margin.")]),i(`
`),s("span",{class:"line"}),i(`
`),s("span",{class:"line"},[s("span",{style:{"--shiki-light":"#50A14F","--shiki-dark":"#98C379"}},"## A List")]),i(`
`),s("span",{class:"line"}),i(`
`),s("span",{class:"line"},[s("span",{style:{"--shiki-light":"#50A14F","--shiki-dark":"#98C379"}},"- Item one")]),i(`
`),s("span",{class:"line"},[s("span",{style:{"--shiki-light":"#50A14F","--shiki-dark":"#98C379"}},"- Item two")]),i(`
`),s("span",{class:"line"},[s("span",{style:{"--shiki-light":"#50A14F","--shiki-dark":"#98C379"}},"  - Nested item")]),i(`
`),s("span",{class:"line"},[s("span",{style:{"--shiki-light":"#50A14F","--shiki-dark":"#98C379"}},"- Item three")]),i(`
`),s("span",{class:"line"}),i(`
`),s("span",{class:"line"},[s("span",{style:{"--shiki-light":"#50A14F","--shiki-dark":"#98C379"}},"## Code")]),i(`
`),s("span",{class:"line"}),i(`
`),s("span",{class:"line"},[s("span",{style:{"--shiki-light":"#0184BC","--shiki-dark":"#56B6C2"}},"\\`\\`\\`"),s("span",{style:{"--shiki-light":"#50A14F","--shiki-dark":"#98C379"}},"typescript")]),i(`
`),s("span",{class:"line"},[s("span",{style:{"--shiki-light":"#50A14F","--shiki-dark":"#98C379"}},"const greeting = (name: string) => "),s("span",{style:{"--shiki-light":"#0184BC","--shiki-dark":"#56B6C2"}},"\\`"),s("span",{style:{"--shiki-light":"#50A14F","--shiki-dark":"#98C379"}},"Hello, "),s("span",{style:{"--shiki-light":"#0184BC","--shiki-dark":"#56B6C2"}},"\\$"),s("span",{style:{"--shiki-light":"#50A14F","--shiki-dark":"#98C379"}},"{name}!"),s("span",{style:{"--shiki-light":"#0184BC","--shiki-dark":"#56B6C2"}},"\\`"),s("span",{style:{"--shiki-light":"#50A14F","--shiki-dark":"#98C379"}},";")]),i(`
`),s("span",{class:"line"},[s("span",{style:{"--shiki-light":"#50A14F","--shiki-dark":"#98C379"}},'console.log(greeting("World"));')]),i(`
`),s("span",{class:"line"},[s("span",{style:{"--shiki-light":"#0184BC","--shiki-dark":"#56B6C2"}},"\\`\\`\\`")]),i(`
`),s("span",{class:"line"}),i(`
`),s("span",{class:"line"},[s("span",{style:{"--shiki-light":"#50A14F","--shiki-dark":"#98C379"}},"---`"),s("span",{style:{"--shiki-light":"#383A42","--shiki-dark":"#ABB2BF"}},");")]),i(`
`),s("span",{class:"line"}),i(`
`),s("span",{class:"line"},[s("span",{style:{"--shiki-light":"#383A42","--shiki-dark":"#E5C07B"}},"console"),s("span",{style:{"--shiki-light":"#383A42","--shiki-dark":"#ABB2BF"}},"."),s("span",{style:{"--shiki-light":"#4078F2","--shiki-dark":"#61AFEF"}},"print"),s("span",{style:{"--shiki-light":"#383A42","--shiki-dark":"#ABB2BF"}},"("),s("span",{style:{"--shiki-light":"#383A42","--shiki-dark":"#E06C75"}},"md"),s("span",{style:{"--shiki-light":"#383A42","--shiki-dark":"#ABB2BF"}},");")])])])],-1)])]),_:1}),e[6]||(e[6]=k("",7)),t(a,{card:o},{default:n(()=>[...e[1]||(e[1]=[s("div",{class:"language-typescript vp-adaptive-theme"},[s("button",{title:"Copy Code",class:"copy"}),s("span",{class:"lang"},"typescript"),s("pre",{class:"shiki shiki-themes one-light one-dark-pro vp-code",tabindex:"0"},[s("code",null,[s("span",{class:"line"},[s("span",{style:{"--shiki-light":"#A626A4","--shiki-dark":"#C678DD"}},"import"),s("span",{style:{"--shiki-light":"#383A42","--shiki-dark":"#ABB2BF"}}," { "),s("span",{style:{"--shiki-light":"#E45649","--shiki-dark":"#E06C75"}},"Console"),s("span",{style:{"--shiki-light":"#383A42","--shiki-dark":"#ABB2BF"}},", "),s("span",{style:{"--shiki-light":"#E45649","--shiki-dark":"#E06C75"}},"Markdown"),s("span",{style:{"--shiki-light":"#383A42","--shiki-dark":"#ABB2BF"}}," } "),s("span",{style:{"--shiki-light":"#A626A4","--shiki-dark":"#C678DD"}},"from"),s("span",{style:{"--shiki-light":"#50A14F","--shiki-dark":"#98C379"}},' "@promptctl/rich-js"'),s("span",{style:{"--shiki-light":"#383A42","--shiki-dark":"#ABB2BF"}},";")]),i(`
`),s("span",{class:"line"}),i(`
`),s("span",{class:"line"},[s("span",{style:{"--shiki-light":"#A626A4","--shiki-dark":"#C678DD"}},"const"),s("span",{style:{"--shiki-light":"#986801","--shiki-dark":"#E5C07B"}}," console"),s("span",{style:{"--shiki-light":"#0184BC","--shiki-dark":"#56B6C2"}}," ="),s("span",{style:{"--shiki-light":"#A626A4","--shiki-dark":"#C678DD"}}," new"),s("span",{style:{"--shiki-light":"#4078F2","--shiki-dark":"#61AFEF"}}," Console"),s("span",{style:{"--shiki-light":"#383A42","--shiki-dark":"#ABB2BF"}},"({ "),s("span",{style:{"--shiki-light":"#E45649","--shiki-dark":"#E06C75"}},"width"),s("span",{style:{"--shiki-light":"#0184BC","--shiki-dark":"#ABB2BF"}},":"),s("span",{style:{"--shiki-light":"#986801","--shiki-dark":"#D19A66"}}," 40"),s("span",{style:{"--shiki-light":"#383A42","--shiki-dark":"#ABB2BF"}}," });")]),i(`
`),s("span",{class:"line"}),i(`
`),s("span",{class:"line"},[s("span",{style:{"--shiki-light":"#383A42","--shiki-dark":"#E5C07B"}},"console"),s("span",{style:{"--shiki-light":"#383A42","--shiki-dark":"#ABB2BF"}},"."),s("span",{style:{"--shiki-light":"#4078F2","--shiki-dark":"#61AFEF"}},"print"),s("span",{style:{"--shiki-light":"#383A42","--shiki-dark":"#ABB2BF"}},"("),s("span",{style:{"--shiki-light":"#A626A4","--shiki-dark":"#C678DD"}},"new"),s("span",{style:{"--shiki-light":"#4078F2","--shiki-dark":"#61AFEF"}}," Markdown"),s("span",{style:{"--shiki-light":"#383A42","--shiki-dark":"#ABB2BF"}},"("),s("span",{style:{"--shiki-light":"#50A14F","--shiki-dark":"#98C379"}},'"Read [the guide](https://example.com), then run `npm test`."'),s("span",{style:{"--shiki-light":"#383A42","--shiki-dark":"#ABB2BF"}},", {")]),i(`
`),s("span",{class:"line"},[s("span",{style:{"--shiki-light":"#E45649","--shiki-dark":"#E06C75"}},"  hyperlinks"),s("span",{style:{"--shiki-light":"#0184BC","--shiki-dark":"#ABB2BF"}},":"),s("span",{style:{"--shiki-light":"#986801","--shiki-dark":"#D19A66"}}," false"),s("span",{style:{"--shiki-light":"#383A42","--shiki-dark":"#ABB2BF"}},",")]),i(`
`),s("span",{class:"line"},[s("span",{style:{"--shiki-light":"#E45649","--shiki-dark":"#E06C75"}},"  inlineCodeStyle"),s("span",{style:{"--shiki-light":"#0184BC","--shiki-dark":"#ABB2BF"}},":"),s("span",{style:{"--shiki-light":"#50A14F","--shiki-dark":"#98C379"}},' "bold magenta"'),s("span",{style:{"--shiki-light":"#383A42","--shiki-dark":"#ABB2BF"}},",")]),i(`
`),s("span",{class:"line"},[s("span",{style:{"--shiki-light":"#383A42","--shiki-dark":"#ABB2BF"}},"}));")])])])],-1)])]),_:1}),e[7]||(e[7]=s("h2",{id:"rendering-a-markdown-file",tabindex:"-1"},[i("Rendering a Markdown file "),s("a",{class:"header-anchor",href:"#rendering-a-markdown-file","aria-label":'Permalink to "Rendering a Markdown file"'},"​")],-1)),e[8]||(e[8]=s("p",null,"The most common real-world pattern — read a Markdown file from disk and render it:",-1)),t(a,{card:r},{default:n(()=>[...e[2]||(e[2]=[s("div",{class:"language-typescript vp-adaptive-theme"},[s("button",{title:"Copy Code",class:"copy"}),s("span",{class:"lang"},"typescript"),s("pre",{class:"shiki shiki-themes one-light one-dark-pro vp-code",tabindex:"0"},[s("code",null,[s("span",{class:"line"},[s("span",{style:{"--shiki-light":"#A626A4","--shiki-dark":"#C678DD"}},"import"),s("span",{style:{"--shiki-light":"#383A42","--shiki-dark":"#ABB2BF"}}," { "),s("span",{style:{"--shiki-light":"#E45649","--shiki-dark":"#E06C75"}},"Console"),s("span",{style:{"--shiki-light":"#383A42","--shiki-dark":"#ABB2BF"}},", "),s("span",{style:{"--shiki-light":"#E45649","--shiki-dark":"#E06C75"}},"Markdown"),s("span",{style:{"--shiki-light":"#383A42","--shiki-dark":"#ABB2BF"}}," } "),s("span",{style:{"--shiki-light":"#A626A4","--shiki-dark":"#C678DD"}},"from"),s("span",{style:{"--shiki-light":"#50A14F","--shiki-dark":"#98C379"}},' "@promptctl/rich-js"'),s("span",{style:{"--shiki-light":"#383A42","--shiki-dark":"#ABB2BF"}},";")]),i(`
`),s("span",{class:"line"},[s("span",{style:{"--shiki-light":"#A626A4","--shiki-dark":"#C678DD"}},"import"),s("span",{style:{"--shiki-light":"#383A42","--shiki-dark":"#ABB2BF"}}," { "),s("span",{style:{"--shiki-light":"#E45649","--shiki-dark":"#E06C75"}},"readFileSync"),s("span",{style:{"--shiki-light":"#383A42","--shiki-dark":"#ABB2BF"}}," } "),s("span",{style:{"--shiki-light":"#A626A4","--shiki-dark":"#C678DD"}},"from"),s("span",{style:{"--shiki-light":"#50A14F","--shiki-dark":"#98C379"}},' "fs"'),s("span",{style:{"--shiki-light":"#383A42","--shiki-dark":"#ABB2BF"}},";")]),i(`
`),s("span",{class:"line"}),i(`
`),s("span",{class:"line"},[s("span",{style:{"--shiki-light":"#A626A4","--shiki-dark":"#C678DD"}},"const"),s("span",{style:{"--shiki-light":"#986801","--shiki-dark":"#E5C07B"}}," console"),s("span",{style:{"--shiki-light":"#0184BC","--shiki-dark":"#56B6C2"}}," ="),s("span",{style:{"--shiki-light":"#A626A4","--shiki-dark":"#C678DD"}}," new"),s("span",{style:{"--shiki-light":"#4078F2","--shiki-dark":"#61AFEF"}}," Console"),s("span",{style:{"--shiki-light":"#383A42","--shiki-dark":"#ABB2BF"}},"();")]),i(`
`),s("span",{class:"line"},[s("span",{style:{"--shiki-light":"#A626A4","--shiki-dark":"#C678DD"}},"const"),s("span",{style:{"--shiki-light":"#986801","--shiki-dark":"#E5C07B"}}," md"),s("span",{style:{"--shiki-light":"#0184BC","--shiki-dark":"#56B6C2"}}," ="),s("span",{style:{"--shiki-light":"#A626A4","--shiki-dark":"#C678DD"}}," new"),s("span",{style:{"--shiki-light":"#4078F2","--shiki-dark":"#61AFEF"}}," Markdown"),s("span",{style:{"--shiki-light":"#383A42","--shiki-dark":"#ABB2BF"}},"("),s("span",{style:{"--shiki-light":"#4078F2","--shiki-dark":"#61AFEF"}},"readFileSync"),s("span",{style:{"--shiki-light":"#383A42","--shiki-dark":"#ABB2BF"}},"("),s("span",{style:{"--shiki-light":"#50A14F","--shiki-dark":"#98C379"}},'"README.md"'),s("span",{style:{"--shiki-light":"#383A42","--shiki-dark":"#ABB2BF"}},", "),s("span",{style:{"--shiki-light":"#50A14F","--shiki-dark":"#98C379"}},'"utf-8"'),s("span",{style:{"--shiki-light":"#383A42","--shiki-dark":"#ABB2BF"}},"));")]),i(`
`),s("span",{class:"line"},[s("span",{style:{"--shiki-light":"#383A42","--shiki-dark":"#E5C07B"}},"console"),s("span",{style:{"--shiki-light":"#383A42","--shiki-dark":"#ABB2BF"}},"."),s("span",{style:{"--shiki-light":"#4078F2","--shiki-dark":"#61AFEF"}},"print"),s("span",{style:{"--shiki-light":"#383A42","--shiki-dark":"#ABB2BF"}},"("),s("span",{style:{"--shiki-light":"#383A42","--shiki-dark":"#E06C75"}},"md"),s("span",{style:{"--shiki-light":"#383A42","--shiki-dark":"#ABB2BF"}},");")])])])],-1)])]),_:1})])}}});export{b as __pageData,A as default};
