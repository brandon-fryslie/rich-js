import{$ as e,Ft as t,J as n,L as r,P as i,R as a,V as o,Vt as s,Xt as c,d as l,f as u,it as d,p as f,q as p,r as m,s as h,u as g,z as _,zt as v}from"./console-DtNiTupe.js";var y=(2**31-1)/1e3;function b(e){if(!(Number.isFinite(e)&&e>0&&1/e<=y))throw RangeError(`a frame rate is a positive, finite number of frames a second, at most ${y} s apart, not ${e}`);return{perSecond:e,interval:1/e}}function ee(){return{now:()=>performance.now()/1e3,every:(e,t)=>{let n=setInterval(t,e.interval*1e3);return()=>clearInterval(n)}}}var x={alternate:{exact:!0,enter:`\x1B[?1049h`,leave:`\x1B[?1049l`,home:()=>`\x1B[H`,painted:e=>e,below:()=>``},inline:{exact:!1,enter:``,leave:``,home:e=>e>1?`\x1b[${e-1}A`:``,painted:(e,t,n)=>Math.max(e,Math.min(t,n)),below:e=>e>0?`
`:``}},te=`\r\x1B[2K`,S=`\x1B[?2026h`,C=`\x1B[?2026l`,w=`\x1B[?25l`,T=(t,n)=>t.map(t=>e.adjustLineLength(t,n.cols,void 0,!1)),ne=class{write;geometry;rows=0;constructor(e,t){this.write=t,this.geometry=x[e]}height(e){return{rows:e,exact:this.geometry.exact}}take(){this.write(this.geometry.enter+w)}paint(e,t,n){let r=T(e(),t);return this.write(S+this.over(r,t,n)+C),r}around(e,t,n,r){let i=T(t(),n),a=this.over([],n,r),o=e.endsWith(`
`)?e:`${e}\n`;return S+a+o+this.over(i,n,r)+C}over(e,t,n){let r=this.geometry.painted(e.length,this.rows,t.rows),i=Array.from({length:r},(t,r)=>te+h(e[r]??[],n)).join(`
`),a=r-Math.max(e.length,1),o=a>0?`\x1b[${a}A`:``,s=this.geometry.home(this.rows)+i+o;return this.rows=e.length,s}handBack(){this.write(`\x1B[0m\x1B[?25h`+this.geometry.below(this.rows)+this.geometry.leave),this.rows=0}},E=class{print;last=()=>[];constructor(e){this.print=e}height(e){return{rows:e,exact:!1}}take(){}paint(e){this.last=e}around(e){return e}handBack(){let e=this.last;this.last=()=>[],this.print(e())}},D=8,O=4,re={"╭":`┌`,"╮":`┐`,"╰":`└`,"╯":`┘`},k=e=>({left:e[0],horizontal:e[1],cross:e[2],right:e[3]}),A=e=>({left:e[0],vertical:e[2],right:e[3]}),j=class t{top;bottom;grid;headContent;headSeparator;bodyContent;rowSeparator;footSeparator;footContent;constructor(e){let t=e.split(`
`);if(t.length!==D||t.some(e=>Array.from(e).length!==O)||t.some(e=>s(e)!==O))throw Error(`A box grid is ${D} lines of ${O} single-cell characters; got ${t.length} line(s) measuring `+t.map(e=>`${Array.from(e).length}/${s(e)}`).join(`, `)+` characters/cells`);let n=t.map(e=>Array.from(e));this.grid=e,this.top=k(n[0]),this.headContent=A(n[1]),this.headSeparator=k(n[2]),this.bodyContent=A(n[3]),this.rowSeparator=k(n[4]),this.footSeparator=k(n[5]),this.footContent=A(n[6]),this.bottom=k(n[7])}getTop(e,t,n=!0){return this.getEdge(e,this.top,t,n)}getRow(e,t,n,r=!0){return this.getEdge(e,this.getRowChars(t),n,r)}getContentChars(e){switch(e){case`head`:return this.headContent;case`row`:case`mid`:return this.bodyContent;case`foot`:return this.footContent}}getBottom(e,t,n=!0){return this.getEdge(e,this.bottom,t,n)}substitute(e={}){let t=r(e,this,M,e=>e.grid);return t===this&&e.safe===!0?this.safeSubstitute():t}safeSubstitute(){return new t(Array.from(this.grid,e=>re[e]??e).join(``))}plainHeaded(){return le.find(([e])=>e.grid===this.grid)?.[1]??this}getEdge(t,n,r,i){let a=t.map(e=>n.horizontal.repeat(e)).join(n.cross),o=i?n.left+a+n.right:a;return[new e(o,r),e.line()]}getRowChars(e){switch(e){case`head`:return this.headSeparator;case`row`:return this.rowSeparator;case`foot`:return this.footSeparator;case`mid`:return{left:this.bodyContent.left,horizontal:` `,cross:this.bodyContent.vertical,right:this.bodyContent.right}}}},M=new j(`+--+
| ||
|-+|
| ||
|-+|
|-+|
| ||
+--+`),N=new j(`+-++
| ||
+-++
| ||
+-++
+-++
| ||
+-++`),P=new j(`+-++
| ||
+=++
| ||
+-++
+-++
| ||
+-++`),F=new j(`┌─┬┐
│ ││
├─┼┤
│ ││
├─┼┤
├─┼┤
│ ││
└─┴┘`),I=new j(`┌─┬┐
│ ││
╞═╪╡
│ ││
├─┼┤
├─┼┤
│ ││
└─┴┘`),L=new j(`  ╷ 
  │ 
╶─┼╴
  │ 
╶─┼╴
╶─┼╴
  │ 
  ╵ `),R=new j(`  ╷ 
  │ 
╺━┿╸
  │ 
╶─┼╴
╶─┼╴
  │ 
  ╵ `),z=new j(`  ╷ 
  │ 
 ═╪ 
  │ 
 ─┼ 
 ─┼ 
  │ 
  ╵ `),ie=new j(`    
    
 ── 
    
    
 ── 
    
    `),ae=new j(`    
    
 ── 
    
    
    
    
    `),oe=new j(`    
    
 ━━ 
    
    
 ━━ 
    
    `),se=new j(` ── 
    
 ── 
    
 ── 
 ── 
    
 ── `),B=new j(`╭─┬╮
│ ││
├─┼┤
│ ││
├─┼┤
├─┼┤
│ ││
╰─┴╯`),V=new j(`┏━┳┓
┃ ┃┃
┣━╋┫
┃ ┃┃
┣━╋┫
┣━╋┫
┃ ┃┃
┗━┻┛`),H=new j(`┏━┯┓
┃ │┃
┠─┼┨
┃ │┃
┠─┼┨
┠─┼┨
┃ │┃
┗━┷┛`),U=new j(`┏━┳┓
┃ ┃┃
┡━╇┩
│ ││
├─┼┤
├─┼┤
│ ││
└─┴┘`),W=new j(`╔═╦╗
║ ║║
╠═╬╣
║ ║║
╠═╬╣
╠═╬╣
║ ║║
╚═╩╝`),G=new j(`╔═╤╗
║ │║
╟─┼╢
║ │║
╟─┼╢
╟─┼╢
║ │║
╚═╧╝`),ce=new j(`    
| ||
|-||
| ||
|-||
|-||
| ||
    `),le=[[U,F],[I,F],[R,L],[z,L],[P,N]];function K(e){let t=e=>Number.isFinite(e)?v(e):0,n=typeof e==`number`?[e,e,e,e]:e.length===2?[e[0],e[1],e[0],e[1]]:e;return[t(n[0]),t(n[1]),t(n[2]),t(n[3])]}function q(e,t,n){let r=v(e),i=e=>{let t=Math.min(e,r);return r-=t,t},a=i(1),o=i(t),s=i(n);return{left:o,contentWidth:a+r,right:s}}function ue(e){return e.left+e.contentWidth+e.right}var de=class{renderable;top;right;bottom;left;style;expand;constructor(e,t,n){let[r,i,a,o]=K(t);this.renderable=u(e),this.top=r,this.right=i,this.bottom=a,this.left=o,this.style=n?.style??d,this.expand=n?.expand!==!1}*render(t){let n=p(t,this),r=q(this.expand?n.maxWidth:m.get(n,this).maximum,this.left,this.right),i={...n,maxWidth:r.contentWidth,height:o(n.height,this.top+this.bottom)},s=_(n,this.style),c=s.isNull?void 0:s,l=[...e.applyStyle(this.renderable.render(i),c)],u=a(e.splitLines(l),i.height),d=new e(` `.repeat(r.left),c),f=new e(` `.repeat(r.right),c),h=new e(` `.repeat(ue(r)),c);for(let t=0;t<this.top;t++)yield h,yield e.line();for(let t of u)yield d,yield*e.adjustLineLength(t,r.contentWidth,c),yield f,yield e.line();for(let t=0;t<this.bottom;t++)yield h,yield e.line()}measure(e){let t=n(e),r=q(t.maxWidth,this.left,this.right),i=r.left+r.right,a=m.get({...t,maxWidth:r.contentWidth},this.renderable),o=Math.min(t.maxWidth,a.maximum+i);return{minimum:Math.min(a.minimum+i,o),maximum:o}}};function J(e,t){let[,n,,r]=t,i=v(e),a=e=>{let t=Math.min(e,i);return i-=t,t},o=a(1),s=a(1),c=a(1),l=a(r),u=a(n),d=c+i;return{left:o,right:s,padLeft:l,contentWidth:d,padRight:u,spanWidth:l+d+u}}function Y(e){return e.left+e.right+e.padLeft+e.padRight}function X(e){return{...e,markup:!0,highlight:!1}}function Z(e,t){return e.text(X(t)).pad(1)}function Q(e,t){return t.isNull?e:(e??d).add(t)}function $(t,n,i,a,o,s,c,u){let d=n.left.repeat(i.left);if(o===void 0||a<=2)return[new e(d+n.horizontal.repeat(a)+u,c)];let f=a-2,p=Z(o,t);g(p,f,p.overflow===`ellipsis`?r(t,`…`,`.`):``);let m=l(p,X(t),s),h=f-e.getLineLength(m),_=Math.floor(h/2);return[new e(d+n.horizontal,c),new e(n.horizontal.repeat(_),c),...m,new e(n.horizontal.repeat(h-_),c),new e(n.horizontal+u,c)]}var fe=class r{renderable;box;title;subtitle;bottomRightAccessory;expand;style;borderStyle;titleStyle;subtitleStyle;width;padding;_titleLabel;_subtitleLabel;constructor(e,t){this.renderable=u(e),this.box=t?.box??B,this.title=t?.title,this.subtitle=t?.subtitle,this._titleLabel=f(this.title),this._subtitleLabel=f(this.subtitle),this.bottomRightAccessory=t?.bottomRightAccessory,this.expand=t?.expand!==!1,this.style=t?.style??d,this.borderStyle=t?.borderStyle??d,this.titleStyle=t?.titleStyle,this.subtitleStyle=t?.subtitleStyle,this.width=t?.width,this.padding=K(t?.padding??[0,1,0,1])}*render(e){let t=p(e,this),n=this.box.substitute(t),r=_(t,this.style),i=r.add(_(t,this.borderStyle)),a=i.isNull?void 0:i,o=r.isNull?void 0:r,s=J(this._getPanelWidth(t),this.padding),[c,,l]=this.padding,u=this._renderContent(t,s.contentWidth,o);yield*this._renderTopBorder(t,n,s,a);for(let e=0;e<c;e++)yield*this._renderPaddingRow(n,s,a,o);for(let e of u)yield*this._renderRow(n,s,e,a,o);for(let e=0;e<l;e++)yield*this._renderPaddingRow(n,s,a,o);yield*this._renderBottomBorder(t,n,s,a)}_renderContent(t,n,r){let[i,,s]=this.padding,c=o(t.height,2+i+s),l={...t,highlight:!1,maxWidth:n,height:c},u=a(e.splitLines([...e.applyStyle(this.renderable.render(l),r)]),c);return n===0?[]:u}*_renderRow(t,n,r,i,a){let o=t.getContentChars(`row`);yield new e(o.left.repeat(n.left),i),yield new e(` `.repeat(n.padLeft),a),yield*e.adjustLineLength(r,n.contentWidth,a),yield new e(` `.repeat(n.padRight),a),yield new e(o.right.repeat(n.right),i),yield e.line()}*_renderPaddingRow(t,n,r,i){let a=t.getContentChars(`row`);yield new e(a.left.repeat(n.left),r),yield new e(` `.repeat(n.spanWidth),i),yield new e(a.right.repeat(n.right),r),yield e.line()}measure(e){let t=n(e),r=this._declaredWidth;if(r!==void 0){let e=Math.min(t.maxWidth,r);return{minimum:e,maximum:e}}let i=this._contentRange(t),a=Y(J(t.maxWidth,this.padding)),o=Math.min(t.maxWidth,Math.max(i.maximum,this._labelWidth(t)+a));return{minimum:Math.min(i.minimum,o),maximum:o}}_contentRange(e){let t=J(e.maxWidth,this.padding),n=Y(t),r=m.get({...e,maxWidth:t.contentWidth},this.renderable);return{minimum:r.minimum+n,maximum:Math.min(e.maxWidth,r.maximum+n)}}_labelWidth(e){return this._titleLabel===void 0?0:Z(this._titleLabel,e).cellLength}get _declaredWidth(){return this.width===void 0?void 0:v(this.width)}_getPanelWidth(e){let t=Math.min(e.maxWidth,this._declaredWidth??e.maxWidth),n=this.expand?t:this._contentRange({...e,maxWidth:t}).maximum,r=this._titleLabel===void 0?0:this._labelWidth(e)+4;return Math.min(e.maxWidth,Math.max(n,r))}*_renderTopBorder(t,n,r,i){let a=Q(i,_(t,this.titleStyle??d));yield*$(t,n.top,r,r.spanWidth,this._titleLabel,a,i,n.top.right.repeat(r.right)),yield e.line()}*_renderBottomBorder(n,r,a,o){let l=this._resolveAccessory(this.bottomRightAccessory),u=l===void 0?``:typeof l==`string`?` ${l} `:` ${l.plain} `,f=c(u,t(Math.min(s(u),a.spanWidth))),p=l instanceof i?l.resolvedStyle(n):d,m=Q(o,_(n,this.subtitleStyle??d)),h=r.bottom.right.repeat(a.right),[g,v]=f===``?[h,``]:[``,h];yield*$(n,r.bottom,a,a.spanWidth-s(f),this._subtitleLabel,m,o,g),yield new e(f,Q(o,p)),yield new e(v,o),yield e.line()}_resolveAccessory(e){if(e!==void 0)return typeof e==`function`?e():e}static fit(e,t){return new r(e,{...t,expand:!1})}};export{F as C,b as D,ne as E,ee as O,oe as S,E as T,z as _,M as a,ie as b,j as c,V as d,H as f,L as g,ce as h,K as i,W as l,se as m,de as n,N as o,U as p,q as r,P as s,fe as t,G as u,R as v,I as w,ae as x,B as y};