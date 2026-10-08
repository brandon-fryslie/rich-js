import{C as h,o as p,c,j as s,a as i,E as n,w as t,ag as l}from"./chunks/framework.B270F8WH.js";const y=JSON.parse('{"title":"Markdown","description":"","frontmatter":{},"headers":[],"relativePath":"markdown.md","filePath":"markdown.md"}'),d={name:"markdown.md"},A=Object.assign(d,{setup(k){const o={code:`import { Console, Markdown } from "@promptctl/rich-js";

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

console.print(md);`,setup:{before:[],after:[]},output:{light:`<pre style="all:initial;direction:ltr;unicode-bidi:isolate;display:block;background:#fafafa;color:#383a42;padding:1em;font:var(--rich-fragment-font,medium/1.2 monospace);white-space:pre;overflow-x:auto">
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
</pre>`,columns:75},label:"Output",caption:"produced by running the code above",tryIt:{playground:"playground",program:"eJw9kDFPw0AMhff7FY-UIYmSslO1ouoCEjAhsWRImnOTg7tzuDOqqqr_HaUklRfLn5-t94wbOAjO2LGPbKnAWxO-NR89LjgEdkiehsBukFbsQzBtX37FZKVUyz4K2n8V1vB0nG-k2Y07PaH5alov8EzWcoFPDlbfKfXRmwgTked7tjrPC8g8MdJY0-YFGq9v06o23hpPaFlTVS-V2mCLn18WGnEkAR8O2J_QYN8EGA_pCa4JnfFLpRYLbPFqoihV4kXIgT3NrRxZASXeKQppGCF3Q30gusp3rEmpqh5LTgPFNphBJstdIBLjO6yR-sbRI6IE47sM6w2qejJf3Z9HeLmr6pWaUlxa7tJZnibXfJIsW02flCrLsp6zHfeHYLykTmerP4Pykss"}},r={code:`import { Console, Markdown } from "@promptctl/rich-js";

const console = new Console({ width: 40 });

console.print(new Markdown("Read [the guide](https://example.com), then run \`npm test\`.", {
  hyperlinks: false,
  inlineCodeStyle: "bold magenta",
}));`,setup:{before:[],after:[]},output:{light:`<pre style="all:initial;direction:ltr;unicode-bidi:isolate;display:block;background:#fafafa;color:#383a42;padding:1em;font:var(--rich-fragment-font,medium/1.2 monospace);white-space:pre;overflow-x:auto">
<span style="color:#383a42">Read </span><span style="color:#61afef">the guide</span><span style="color:#383a42"> (</span><a href="https://example.com/" style="all:unset;cursor:revert;outline:revert"><span style="color:#0184bc">https://example.com</span></a><span style="color:#383a42">),   </span>
<span style="color:#383a42">then run </span><span style="color:#a626a4;font-weight:bold">npm test</span><span style="color:#383a42">.                      </span>
</pre>`,dark:`<pre style="all:initial;direction:ltr;unicode-bidi:isolate;display:block;background:#282c34;color:#abb2bf;padding:1em;font:var(--rich-fragment-font,medium/1.2 monospace);white-space:pre;overflow-x:auto">
<span style="color:#abb2bf">Read </span><span style="color:#61afef">the guide</span><span style="color:#abb2bf"> (</span><a href="https://example.com/" style="all:unset;cursor:revert;outline:revert"><span style="color:#61afef">https://example.com</span></a><span style="color:#abb2bf">),   </span>
<span style="color:#abb2bf">then run </span><span style="color:#c678dd;font-weight:bold">npm test</span><span style="color:#abb2bf">.                      </span>
</pre>`,columns:40},label:"Output",caption:"produced by running the code above",tryIt:{playground:"playground",program:"eJw1jT1rwzAQhnf_ihdNNrh2h04OhULmLu1YClGtS6REuhPSBTcY__dS2uzPR0hZimLFXrhKpB6vtlycLIwNxyIJ5iUXSVlnjWMJs384V7Nrmlm4KuY_C89gWu6NdsUSnPoJT4_Yun9YIg25BNb2F71fWvNG1uFDPeF0DY4-W6-a6zSO9G1TjjTMkroe6olRrowD5wSlqofB9FgbwN8ylRj4UiccbazUN0DgGJj24uhdb5EmmC-JDsmeiNWavtm6bvcD6_FWtw"}};return(u,a)=>{const e=h("RichExample");return p(),c("div",null,[a[2]||(a[2]=s("h1",{id:"markdown",tabindex:"-1"},[i("Markdown "),s("a",{class:"header-anchor",href:"#markdown","aria-label":'Permalink to "Markdown"'},"​")],-1)),a[3]||(a[3]=s("p",null,[s("code",null,"Markdown"),i(" renders Markdown-formatted text in the terminal with styled headings, lists, emphasis, quotes, rules and code blocks.")],-1)),a[4]||(a[4]=s("h2",{id:"basic-usage",tabindex:"-1"},[i("Basic usage "),s("a",{class:"header-anchor",href:"#basic-usage","aria-label":'Permalink to "Basic usage"'},"​")],-1)),n(e,{card:o},{default:t(()=>[...a[0]||(a[0]=[s("div",{class:"language-typescript vp-adaptive-theme"},[s("button",{title:"Copy Code",class:"copy"}),s("span",{class:"lang"},"typescript"),s("pre",{class:"shiki shiki-themes one-light one-dark-pro vp-code",tabindex:"0"},[s("code",null,[s("span",{class:"line"},[s("span",{style:{"--shiki-light":"#A626A4","--shiki-dark":"#C678DD"}},"import"),s("span",{style:{"--shiki-light":"#383A42","--shiki-dark":"#ABB2BF"}}," { "),s("span",{style:{"--shiki-light":"#E45649","--shiki-dark":"#E06C75"}},"Console"),s("span",{style:{"--shiki-light":"#383A42","--shiki-dark":"#ABB2BF"}},", "),s("span",{style:{"--shiki-light":"#E45649","--shiki-dark":"#E06C75"}},"Markdown"),s("span",{style:{"--shiki-light":"#383A42","--shiki-dark":"#ABB2BF"}}," } "),s("span",{style:{"--shiki-light":"#A626A4","--shiki-dark":"#C678DD"}},"from"),s("span",{style:{"--shiki-light":"#50A14F","--shiki-dark":"#98C379"}},' "@promptctl/rich-js"'),s("span",{style:{"--shiki-light":"#383A42","--shiki-dark":"#ABB2BF"}},";")]),i(`
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
`),s("span",{class:"line"},[s("span",{style:{"--shiki-light":"#383A42","--shiki-dark":"#E5C07B"}},"console"),s("span",{style:{"--shiki-light":"#383A42","--shiki-dark":"#ABB2BF"}},"."),s("span",{style:{"--shiki-light":"#4078F2","--shiki-dark":"#61AFEF"}},"print"),s("span",{style:{"--shiki-light":"#383A42","--shiki-dark":"#ABB2BF"}},"("),s("span",{style:{"--shiki-light":"#383A42","--shiki-dark":"#E06C75"}},"md"),s("span",{style:{"--shiki-light":"#383A42","--shiki-dark":"#ABB2BF"}},");")])])])],-1)])]),_:1}),a[5]||(a[5]=l("",7)),n(e,{card:r},{default:t(()=>[...a[1]||(a[1]=[s("div",{class:"language-typescript vp-adaptive-theme"},[s("button",{title:"Copy Code",class:"copy"}),s("span",{class:"lang"},"typescript"),s("pre",{class:"shiki shiki-themes one-light one-dark-pro vp-code",tabindex:"0"},[s("code",null,[s("span",{class:"line"},[s("span",{style:{"--shiki-light":"#A626A4","--shiki-dark":"#C678DD"}},"import"),s("span",{style:{"--shiki-light":"#383A42","--shiki-dark":"#ABB2BF"}}," { "),s("span",{style:{"--shiki-light":"#E45649","--shiki-dark":"#E06C75"}},"Console"),s("span",{style:{"--shiki-light":"#383A42","--shiki-dark":"#ABB2BF"}},", "),s("span",{style:{"--shiki-light":"#E45649","--shiki-dark":"#E06C75"}},"Markdown"),s("span",{style:{"--shiki-light":"#383A42","--shiki-dark":"#ABB2BF"}}," } "),s("span",{style:{"--shiki-light":"#A626A4","--shiki-dark":"#C678DD"}},"from"),s("span",{style:{"--shiki-light":"#50A14F","--shiki-dark":"#98C379"}},' "@promptctl/rich-js"'),s("span",{style:{"--shiki-light":"#383A42","--shiki-dark":"#ABB2BF"}},";")]),i(`
`),s("span",{class:"line"}),i(`
`),s("span",{class:"line"},[s("span",{style:{"--shiki-light":"#A626A4","--shiki-dark":"#C678DD"}},"const"),s("span",{style:{"--shiki-light":"#986801","--shiki-dark":"#E5C07B"}}," console"),s("span",{style:{"--shiki-light":"#0184BC","--shiki-dark":"#56B6C2"}}," ="),s("span",{style:{"--shiki-light":"#A626A4","--shiki-dark":"#C678DD"}}," new"),s("span",{style:{"--shiki-light":"#4078F2","--shiki-dark":"#61AFEF"}}," Console"),s("span",{style:{"--shiki-light":"#383A42","--shiki-dark":"#ABB2BF"}},"({ "),s("span",{style:{"--shiki-light":"#E45649","--shiki-dark":"#E06C75"}},"width"),s("span",{style:{"--shiki-light":"#0184BC","--shiki-dark":"#ABB2BF"}},":"),s("span",{style:{"--shiki-light":"#986801","--shiki-dark":"#D19A66"}}," 40"),s("span",{style:{"--shiki-light":"#383A42","--shiki-dark":"#ABB2BF"}}," });")]),i(`
`),s("span",{class:"line"}),i(`
`),s("span",{class:"line"},[s("span",{style:{"--shiki-light":"#383A42","--shiki-dark":"#E5C07B"}},"console"),s("span",{style:{"--shiki-light":"#383A42","--shiki-dark":"#ABB2BF"}},"."),s("span",{style:{"--shiki-light":"#4078F2","--shiki-dark":"#61AFEF"}},"print"),s("span",{style:{"--shiki-light":"#383A42","--shiki-dark":"#ABB2BF"}},"("),s("span",{style:{"--shiki-light":"#A626A4","--shiki-dark":"#C678DD"}},"new"),s("span",{style:{"--shiki-light":"#4078F2","--shiki-dark":"#61AFEF"}}," Markdown"),s("span",{style:{"--shiki-light":"#383A42","--shiki-dark":"#ABB2BF"}},"("),s("span",{style:{"--shiki-light":"#50A14F","--shiki-dark":"#98C379"}},'"Read [the guide](https://example.com), then run `npm test`."'),s("span",{style:{"--shiki-light":"#383A42","--shiki-dark":"#ABB2BF"}},", {")]),i(`
`),s("span",{class:"line"},[s("span",{style:{"--shiki-light":"#E45649","--shiki-dark":"#E06C75"}},"  hyperlinks"),s("span",{style:{"--shiki-light":"#0184BC","--shiki-dark":"#ABB2BF"}},":"),s("span",{style:{"--shiki-light":"#986801","--shiki-dark":"#D19A66"}}," false"),s("span",{style:{"--shiki-light":"#383A42","--shiki-dark":"#ABB2BF"}},",")]),i(`
`),s("span",{class:"line"},[s("span",{style:{"--shiki-light":"#E45649","--shiki-dark":"#E06C75"}},"  inlineCodeStyle"),s("span",{style:{"--shiki-light":"#0184BC","--shiki-dark":"#ABB2BF"}},":"),s("span",{style:{"--shiki-light":"#50A14F","--shiki-dark":"#98C379"}},' "bold magenta"'),s("span",{style:{"--shiki-light":"#383A42","--shiki-dark":"#ABB2BF"}},",")]),i(`
`),s("span",{class:"line"},[s("span",{style:{"--shiki-light":"#383A42","--shiki-dark":"#ABB2BF"}},"}));")])])])],-1)])]),_:1}),a[6]||(a[6]=l("",3))])}}});export{y as __pageData,A as default};
