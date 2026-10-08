import{B as e,I as t,Lt as n,Qt as r,U as i,Ut as a,V as o,Vt as s,X as c,Y as l,d as u,f as d,ot as f,p,r as m,s as h,tt as g,u as _,z as v}from"./console-qO1dir4I.js";var y=(2**31-1)/1e3;function ee(e){if(!(Number.isFinite(e)&&e>0&&1/e<=y))throw RangeError(`a frame rate is a positive, finite number of frames a second, at most ${y} s apart, not ${e}`);return{perSecond:e,interval:1/e}}function b(){return{now:()=>performance.now()/1e3,every:(e,t)=>{let n=setInterval(t,e.interval*1e3);return()=>clearInterval(n)}}}var x={alternate:{exact:!0,enter:`\x1B[?1049h`,leave:`\x1B[?1049l`,home:()=>`\x1B[H`,painted:e=>e,below:()=>``},inline:{exact:!1,enter:``,leave:``,home:e=>e>1?`\x1b[${e-1}A`:``,painted:(e,t,n)=>Math.max(e,Math.min(t,n)),below:e=>e>0?`
`:``}},te=`\r\x1B[2K`,S=`\x1B[?2026h`,C=`\x1B[?2026l`,ne=`\x1B[?25l`,w=(e,t)=>e.map(e=>g.adjustLineLength(e,t.cols,void 0,!1)),re=class{write;geometry;rows=0;constructor(e,t){this.write=t,this.geometry=x[e]}height(e){return{rows:e,exact:this.geometry.exact}}take(){this.write(this.geometry.enter+ne)}paint(e,t,n){let r=w(e(),t);return this.write(S+this.over(r,t,n)+C),r}around(e,t,n,r){let i=w(t(),n),a=this.over([],n,r),o=e.endsWith(`
`)?e:`${e}\n`;return S+a+o+this.over(i,n,r)+C}over(e,t,n){let r=this.geometry.painted(e.length,this.rows,t.rows),i=Array.from({length:r},(t,r)=>te+h(e[r]??[],n)).join(`
`),a=r-Math.max(e.length,1),o=a>0?`\x1b[${a}A`:``,s=this.geometry.home(this.rows)+i+o;return this.rows=e.length,s}handBack(){this.write(`\x1B[0m\x1B[?25h`+this.geometry.below(this.rows)+this.geometry.leave),this.rows=0}},ie=class{print;last=()=>[];constructor(e){this.print=e}height(e){return{rows:e,exact:!1}}take(){}paint(e){this.last=e}around(e){return e}handBack(){let e=this.last;this.last=()=>[],this.print(e())}},T=8,E=4,D={"╭":`┌`,"╮":`┐`,"╰":`└`,"╯":`┘`},O=e=>({left:e[0],horizontal:e[1],cross:e[2],right:e[3]}),k=e=>({left:e[0],vertical:e[2],right:e[3]}),A=class e{top;bottom;grid;headContent;headSeparator;bodyContent;rowSeparator;footSeparator;footContent;constructor(e){let t=e.split(`
`);if(t.length!==T||t.some(e=>Array.from(e).length!==E)||t.some(e=>a(e)!==E))throw Error(`A box grid is ${T} lines of ${E} single-cell characters; got ${t.length} line(s) measuring `+t.map(e=>`${Array.from(e).length}/${a(e)}`).join(`, `)+` characters/cells`);let n=t.map(e=>Array.from(e));this.grid=e,this.top=O(n[0]),this.headContent=k(n[1]),this.headSeparator=O(n[2]),this.bodyContent=k(n[3]),this.rowSeparator=O(n[4]),this.footSeparator=O(n[5]),this.footContent=k(n[6]),this.bottom=O(n[7])}getTop(e,t,n=!0){return this.getEdge(e,this.top,t,n)}getRow(e,t,n,r=!0){return this.getEdge(e,this.getRowChars(t),n,r)}getContentChars(e){switch(e){case`head`:return this.headContent;case`row`:case`mid`:return this.bodyContent;case`foot`:return this.footContent}}getBottom(e,t,n=!0){return this.getEdge(e,this.bottom,t,n)}substitute(e={}){let t=v(e,this,j,e=>e.grid);return t===this&&e.safe===!0?this.safeSubstitute():t}safeSubstitute(){return new e(Array.from(this.grid,e=>D[e]??e).join(``))}plainHeaded(){return G.find(([e])=>e.grid===this.grid)?.[1]??this}getEdge(e,t,n,r){let i=e.map(e=>t.horizontal.repeat(e)).join(t.cross),a=r?t.left+i+t.right:i;return[new g(a,n),g.line()]}getRowChars(e){switch(e){case`head`:return this.headSeparator;case`row`:return this.rowSeparator;case`foot`:return this.footSeparator;case`mid`:return{left:this.bodyContent.left,horizontal:` `,cross:this.bodyContent.vertical,right:this.bodyContent.right}}}},j=new A(`+--+
| ||
|-+|
| ||
|-+|
|-+|
| ||
+--+`),M=new A(`+-++
| ||
+-++
| ||
+-++
+-++
| ||
+-++`),N=new A(`+-++
| ||
+=++
| ||
+-++
+-++
| ||
+-++`),P=new A(`┌─┬┐
│ ││
├─┼┤
│ ││
├─┼┤
├─┼┤
│ ││
└─┴┘`),F=new A(`┌─┬┐
│ ││
╞═╪╡
│ ││
├─┼┤
├─┼┤
│ ││
└─┴┘`),I=new A(`  ╷ 
  │ 
╶─┼╴
  │ 
╶─┼╴
╶─┼╴
  │ 
  ╵ `),L=new A(`  ╷ 
  │ 
╺━┿╸
  │ 
╶─┼╴
╶─┼╴
  │ 
  ╵ `),R=new A(`  ╷ 
  │ 
 ═╪ 
  │ 
 ─┼ 
 ─┼ 
  │ 
  ╵ `),ae=new A(`    
    
 ── 
    
    
 ── 
    
    `),oe=new A(`    
    
 ── 
    
    
    
    
    `),se=new A(`    
    
 ━━ 
    
    
 ━━ 
    
    `),ce=new A(` ── 
    
 ── 
    
 ── 
 ── 
    
 ── `),z=new A(`╭─┬╮
│ ││
├─┼┤
│ ││
├─┼┤
├─┼┤
│ ││
╰─┴╯`),B=new A(`┏━┳┓
┃ ┃┃
┣━╋┫
┃ ┃┃
┣━╋┫
┣━╋┫
┃ ┃┃
┗━┻┛`),V=new A(`┏━┯┓
┃ │┃
┠─┼┨
┃ │┃
┠─┼┨
┠─┼┨
┃ │┃
┗━┷┛`),H=new A(`┏━┳┓
┃ ┃┃
┡━╇┩
│ ││
├─┼┤
├─┼┤
│ ││
└─┴┘`),U=new A(`╔═╦╗
║ ║║
╠═╬╣
║ ║║
╠═╬╣
╠═╬╣
║ ║║
╚═╩╝`),W=new A(`╔═╤╗
║ │║
╟─┼╢
║ │║
╟─┼╢
╟─┼╢
║ │║
╚═╧╝`),le=new A(`    
| ||
|-||
| ||
|-||
|-||
| ||
    `),G=[[H,P],[F,P],[L,I],[R,I],[N,M]];function K(e){let t=e=>Number.isFinite(e)?s(e):0,n=typeof e==`number`?[e,e,e,e]:e.length===2?[e[0],e[1],e[0],e[1]]:e;return[t(n[0]),t(n[1]),t(n[2]),t(n[3])]}function q(e,t,n){let r=s(e),i=e=>{let t=Math.min(e,r);return r-=t,t},a=i(1),o=i(t),c=i(n);return{left:o,contentWidth:a+r,right:c}}function ue(e){return e.left+e.contentWidth+e.right}var de=class{renderable;top;right;bottom;left;style;expand;constructor(e,t,n){let[r,i,a,o]=K(t);this.renderable=d(e),this.top=r,this.right=i,this.bottom=a,this.left=o,this.style=n?.style??f,this.expand=n?.expand!==!1}*render(t){let n=l(t,this),r=q(this.expand?n.maxWidth:m.get(n,this).maximum,this.left,this.right),a={...n,maxWidth:r.contentWidth,height:i(n.height,this.top+this.bottom)},s=o(n,this.style),c=s.isNull?void 0:s,u=[...g.applyStyle(this.renderable.render(a),c)],d=e(g.splitLines(u),a.height),f=new g(` `.repeat(r.left),c),p=new g(` `.repeat(r.right),c),h=new g(` `.repeat(ue(r)),c);for(let e=0;e<this.top;e++)yield h,yield g.line();for(let e of d)yield f,yield*g.adjustLineLength(e,r.contentWidth,c),yield p,yield g.line();for(let e=0;e<this.bottom;e++)yield h,yield g.line()}measure(e){let t=c(e),n=q(t.maxWidth,this.left,this.right),r=n.left+n.right,i=m.get({...t,maxWidth:n.contentWidth},this.renderable),a=Math.min(t.maxWidth,i.maximum+r);return{minimum:Math.min(i.minimum+r,a),maximum:a}}};function J(e,t){let[,n,,r]=t,i=s(e),a=e=>{let t=Math.min(e,i);return i-=t,t},o=a(1),c=a(1),l=a(1),u=a(r),d=a(n),f=l+i;return{left:o,right:c,padLeft:u,contentWidth:f,padRight:d,spanWidth:u+f+d}}function Y(e){return e.left+e.right+e.padLeft+e.padRight}function X(e){return{...e,markup:!0,highlight:!1}}function Z(e,t){return e.text(X(t)).pad(1)}function Q(e,t){return t.isNull?e:(e??f).add(t)}function $(e,t,n,r,i,a,o,s){let c=t.left.repeat(n.left);if(i===void 0||r<=2)return[new g(c+t.horizontal.repeat(r)+s,o)];let l=r-2,d=Z(i,e);_(d,l,d.overflow===`ellipsis`?v(e,`…`,`.`):``);let f=u(d,X(e),a),p=l-g.getLineLength(f),m=Math.floor(p/2);return[new g(c+t.horizontal,o),new g(t.horizontal.repeat(m),o),...f,new g(t.horizontal.repeat(p-m),o),new g(t.horizontal+s,o)]}var fe=class u{renderable;box;title;subtitle;bottomRightAccessory;expand;style;borderStyle;titleStyle;subtitleStyle;width;padding;_titleLabel;_subtitleLabel;constructor(e,t){this.renderable=d(e),this.box=t?.box??z,this.title=t?.title,this.subtitle=t?.subtitle,this._titleLabel=p(this.title),this._subtitleLabel=p(this.subtitle),this.bottomRightAccessory=t?.bottomRightAccessory,this.expand=t?.expand!==!1,this.style=t?.style??f,this.borderStyle=t?.borderStyle??f,this.titleStyle=t?.titleStyle,this.subtitleStyle=t?.subtitleStyle,this.width=t?.width,this.padding=K(t?.padding??[0,1,0,1])}*render(e){let t=l(e,this),n=this.box.substitute(t),r=o(t,this.style),i=r.add(o(t,this.borderStyle)),a=i.isNull?void 0:i,s=r.isNull?void 0:r,c=J(this._getPanelWidth(t),this.padding),[u,,d]=this.padding,f=this._renderContent(t,c.contentWidth,s);yield*this._renderTopBorder(t,n,c,a);for(let e=0;e<u;e++)yield*this._renderPaddingRow(n,c,a,s);for(let e of f)yield*this._renderRow(n,c,e,a,s);for(let e=0;e<d;e++)yield*this._renderPaddingRow(n,c,a,s);yield*this._renderBottomBorder(t,n,c,a)}_renderContent(t,n,r){let[a,,o]=this.padding,s=i(t.height,2+a+o),c={...t,highlight:!1,maxWidth:n,height:s},l=e(g.splitLines([...g.applyStyle(this.renderable.render(c),r)]),s);return n===0?[]:l}*_renderRow(e,t,n,r,i){let a=e.getContentChars(`row`);yield new g(a.left.repeat(t.left),r),yield new g(` `.repeat(t.padLeft),i),yield*g.adjustLineLength(n,t.contentWidth,i),yield new g(` `.repeat(t.padRight),i),yield new g(a.right.repeat(t.right),r),yield g.line()}*_renderPaddingRow(e,t,n,r){let i=e.getContentChars(`row`);yield new g(i.left.repeat(t.left),n),yield new g(` `.repeat(t.spanWidth),r),yield new g(i.right.repeat(t.right),n),yield g.line()}measure(e){let t=c(e),n=this._declaredWidth;if(n!==void 0){let e=Math.min(t.maxWidth,n);return{minimum:e,maximum:e}}let r=this._contentRange(t),i=Y(J(t.maxWidth,this.padding)),a=Math.min(t.maxWidth,Math.max(r.maximum,this._labelWidth(t)+i));return{minimum:Math.min(r.minimum,a),maximum:a}}_contentRange(e){let t=J(e.maxWidth,this.padding),n=Y(t),r=m.get({...e,maxWidth:t.contentWidth},this.renderable);return{minimum:r.minimum+n,maximum:Math.min(e.maxWidth,r.maximum+n)}}_labelWidth(e){return this._titleLabel===void 0?0:Z(this._titleLabel,e).cellLength}get _declaredWidth(){return this.width===void 0?void 0:s(this.width)}_getPanelWidth(e){let t=Math.min(e.maxWidth,this._declaredWidth??e.maxWidth),n=this.expand?t:this._contentRange({...e,maxWidth:t}).maximum,r=this._titleLabel===void 0?0:this._labelWidth(e)+4;return Math.min(e.maxWidth,Math.max(n,r))}*_renderTopBorder(e,t,n,r){let i=Q(r,o(e,this.titleStyle??f));yield*$(e,t.top,n,n.spanWidth,this._titleLabel,i,r,t.top.right.repeat(n.right)),yield g.line()}*_renderBottomBorder(e,i,s,c){let l=this._resolveAccessory(this.bottomRightAccessory),u=l===void 0?``:typeof l==`string`?` ${l} `:` ${l.plain} `,d=r(u,n(Math.min(a(u),s.spanWidth))),p=l instanceof t?l.resolvedStyle(e):f,m=Q(c,o(e,this.subtitleStyle??f)),h=i.bottom.right.repeat(s.right),[_,v]=d===``?[h,``]:[``,h];yield*$(e,i.bottom,s,s.spanWidth-a(d),this._subtitleLabel,m,c,_),yield new g(d,Q(c,p)),yield new g(v,c),yield g.line()}_resolveAccessory(e){if(e!==void 0)return typeof e==`function`?e():e}static fit(e,t){return new u(e,{...t,expand:!1})}};export{P as C,ee as D,re as E,b as O,se as S,ie as T,R as _,j as a,ae as b,A as c,B as d,V as f,I as g,le as h,K as i,U as l,ce as m,de as n,M as o,H as p,q as r,N as s,fe as t,W as u,L as v,F as w,oe as x,z as y};