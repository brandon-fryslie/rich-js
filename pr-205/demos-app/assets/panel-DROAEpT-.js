import{B as e,F as t,H as n,M as r,N as i,O as a,P as o,St as s,i as c,kt as l,o as u,q as d,wt as f,yt as p,z as m}from"./host-environment-f8FYvxm8.js";import{t as h}from"./measure-ifWDzcEG.js";var g=8,_=4,v=/^[\x00-\x7F]*$/,y={"╭":`┌`,"╮":`┐`,"╰":`└`,"╯":`┘`},b=e=>({left:e[0],horizontal:e[1],cross:e[2],right:e[3]}),x=e=>({left:e[0],vertical:e[2],right:e[3]}),S=class e{top;bottom;grid;ascii;headContent;headSeparator;bodyContent;rowSeparator;footSeparator;footContent;constructor(e){let t=e.split(`
`);if(t.length!==g||t.some(e=>Array.from(e).length!==_)||t.some(e=>f(e)!==_))throw Error(`A box grid is ${g} lines of ${_} single-cell characters; got ${t.length} line(s) measuring `+t.map(e=>`${Array.from(e).length}/${f(e)}`).join(`, `)+` characters/cells`);let n=t.map(e=>Array.from(e));this.grid=e,this.ascii=v.test(e),this.top=b(n[0]),this.headContent=x(n[1]),this.headSeparator=b(n[2]),this.bodyContent=x(n[3]),this.rowSeparator=b(n[4]),this.footSeparator=b(n[5]),this.footContent=x(n[6]),this.bottom=b(n[7])}getTop(e,t,n=!0){return this.getEdge(e,this.top,t,n)}getRow(e,t,n,r=!0){return this.getEdge(e,this.getRowChars(t),n,r)}getContentChars(e){switch(e){case`head`:return this.headContent;case`row`:case`mid`:return this.bodyContent;case`foot`:return this.footContent}}getBottom(e,t,n=!0){return this.getEdge(e,this.bottom,t,n)}substitute(e={}){return e.asciiOnly&&!this.ascii?C:e.safe?this.safeSubstitute():this}safeSubstitute(){return new e(Array.from(this.grid,e=>y[e]??e).join(``))}plainHeaded(){return H.find(([e])=>e.grid===this.grid)?.[1]??this}getEdge(e,t,r,i){let a=[];i&&a.push(new n(t.left,r));for(let i=0;i<e.length;i++)i>0&&a.push(new n(t.cross,r)),a.push(new n(t.horizontal.repeat(e[i]),r));return i&&a.push(new n(t.right,r)),a.push(n.line()),a}getRowChars(e){switch(e){case`head`:return this.headSeparator;case`row`:return this.rowSeparator;case`foot`:return this.footSeparator;case`mid`:return{left:this.bodyContent.left,horizontal:` `,cross:this.bodyContent.vertical,right:this.bodyContent.right}}}},C=new S(`+--+
| ||
|-+|
| ||
|-+|
|-+|
| ||
+--+`),w=new S(`+-++
| ||
+-++
| ||
+-++
+-++
| ||
+-++`),T=new S(`+-++
| ||
+=++
| ||
+-++
+-++
| ||
+-++`),E=new S(`┌─┬┐
│ ││
├─┼┤
│ ││
├─┼┤
├─┼┤
│ ││
└─┴┘`),D=new S(`┌─┬┐
│ ││
╞═╪╡
│ ││
├─┼┤
├─┼┤
│ ││
└─┴┘`),O=new S(`  ╷ 
  │ 
╶─┼╴
  │ 
╶─┼╴
╶─┼╴
  │ 
  ╵ `),k=new S(`  ╷ 
  │ 
╺━┿╸
  │ 
╶─┼╴
╶─┼╴
  │ 
  ╵ `),A=new S(`  ╷ 
  │ 
 ═╪ 
  │ 
 ─┼ 
 ─┼ 
  │ 
  ╵ `),j=new S(`    
    
 ── 
    
    
 ── 
    
    `),M=new S(`    
    
 ── 
    
    
    
    
    `),N=new S(`    
    
 ━━ 
    
    
 ━━ 
    
    `),P=new S(` ── 
    
 ── 
    
 ── 
 ── 
    
 ── `),F=new S(`╭─┬╮
│ ││
├─┼┤
│ ││
├─┼┤
├─┼┤
│ ││
╰─┴╯`),I=new S(`┏━┳┓
┃ ┃┃
┣━╋┫
┃ ┃┃
┣━╋┫
┣━╋┫
┃ ┃┃
┗━┻┛`),L=new S(`┏━┯┓
┃ │┃
┠─┼┨
┃ │┃
┠─┼┨
┠─┼┨
┃ │┃
┗━┷┛`),R=new S(`┏━┳┓
┃ ┃┃
┡━╇┩
│ ││
├─┼┤
├─┼┤
│ ││
└─┴┘`),z=new S(`╔═╦╗
║ ║║
╠═╬╣
║ ║║
╠═╬╣
╠═╬╣
║ ║║
╚═╩╝`),B=new S(`╔═╤╗
║ │║
╟─┼╢
║ │║
╟─┼╢
╟─┼╢
║ │║
╚═╧╝`),V=new S(`    
| ||
|-||
| ||
|-||
|-||
| ||
    `),H=[[R,E],[D,E],[k,O],[A,O],[T,w]];function U(e){let t=e=>Number.isFinite(e)?s(e):0,n=typeof e==`number`?[e,e,e,e]:e.length===2?[e[0],e[1],e[0],e[1]]:e;return[t(n[0]),t(n[1]),t(n[2]),t(n[3])]}function W(e,t,n){let r=s(e),i=e=>{let t=Math.min(e,r);return r-=t,t},a=i(1),o=i(t),c=i(n);return{left:o,contentWidth:a+r,right:c}}function G(e){return e.left+e.contentWidth+e.right}var K=class{renderable;top;right;bottom;left;style;expand;constructor(e,t,n){let[r,i,a,o]=U(t);this.renderable=e,this.top=r,this.right=i,this.bottom=a,this.left=o,this.style=n?.style??d,this.expand=n?.expand!==!1}*render(e){let t=m(e,this),a=W(t.maxWidth,this.left,this.right),s={...t,maxWidth:a.contentWidth,height:o(t.height,this.top+this.bottom)},c=[...this.renderable.render(s)],l=r(n.splitLines(c),s.height),u=i(t,this.style),d=u.isNull?void 0:u,f=new n(` `.repeat(a.left),d),p=new n(` `.repeat(a.right),d),h=new n(` `.repeat(G(a)),d);for(let e=0;e<this.top;e++)yield h,yield n.line();for(let e of l)yield f,yield*n.adjustLineLength(e,a.contentWidth,d,this.expand),yield p,yield n.line();for(let e=0;e<this.bottom;e++)yield h,yield n.line()}measure(n){let r=e(n),i=W(r.maxWidth,this.left,this.right),a=i.left+i.right;if(t(this.renderable)){let e=h.get({...r,maxWidth:i.contentWidth},this.renderable),t=Math.min(r.maxWidth,e.maximum+a);return{minimum:Math.min(e.minimum+a,t),maximum:t}}return{minimum:a,maximum:r.maxWidth}}};function q(e,t){let[,n,,r]=t,i=s(e),a=e=>{let t=Math.min(e,i);return i-=t,t},o=a(1),c=a(1),l=a(1),u=a(r),d=a(n),f=l+i;return{left:o,right:c,padLeft:u,contentWidth:f,padRight:d,spanWidth:u+f+d}}function J(e){return e.left+e.right+e.padLeft+e.padRight}function Y(e,t,n){return t===void 0?n:i(e,t)}var X=class g{renderable;box;title;subtitle;bottomRightAccessory;expand;style;borderStyle;titleStyle;subtitleStyle;width;padding;constructor(e,t){this.renderable=c(e),this.box=t?.box??F,this.title=t?.title,this.subtitle=t?.subtitle,this.bottomRightAccessory=t?.bottomRightAccessory,this.expand=t?.expand!==!1,this.style=t?.style??d,this.borderStyle=t?.borderStyle??d,this.titleStyle=t?.titleStyle,this.subtitleStyle=t?.subtitleStyle,this.width=t?.width,this.padding=U(t?.padding??[0,1,0,1])}*render(e){let t=m(e,this),n=t.asciiOnly?this.box.substitute({asciiOnly:!0}):this.box,r=i(t,this.borderStyle),a=i(t,this.style),o=r.isNull?void 0:r,s=a.isNull?void 0:a,c=q(this._getPanelWidth(t),this.padding),[l,,u]=this.padding,d=this._renderContent(t,c.contentWidth);yield*this._renderTopBorder(t,n,c,o);for(let e=0;e<l;e++)yield*this._renderRow(n,c,[],o,s);for(let e of d)yield*this._renderRow(n,c,e,o,s);for(let e=0;e<u;e++)yield*this._renderRow(n,c,[],o,s);yield*this._renderBottomBorder(t,n,c,o)}_renderContent(e,t){let[i,,a]=this.padding,s=o(e.height,2+i+a),c={...e,maxWidth:t,height:s},l=r(n.splitLines([...this.renderable.render(c)]),s);return t===0?[]:l}*_renderRow(e,t,r,i,a){let o=e.getContentChars(`row`);yield new n(o.left.repeat(t.left),i);let s=n.adjustLineLength(r,t.contentWidth,a,!1),c=[new n(` `.repeat(t.padLeft),a),...s];yield*n.adjustLineLength(c,t.spanWidth,a),yield new n(o.right.repeat(t.right),i),yield n.line()}measure(t){let n=e(t),r=this._declaredWidth;if(r!==void 0){let e=Math.min(n.maxWidth,r);return{minimum:e,maximum:e}}return this._fitRange(n)}_fitRange(e){let n=q(e.maxWidth,this.padding),r=J(n);if(t(this.renderable)){let t={...e,maxWidth:n.contentWidth},i=h.get(t,this.renderable),a=Math.min(e.maxWidth,i.maximum+r);return{minimum:Math.min(i.minimum+r,a),maximum:a}}return{minimum:Math.min(r,e.maxWidth),maximum:e.maxWidth}}get _declaredWidth(){return this.width===void 0?void 0:s(this.width)}_getPanelWidth(e){let t=this._declaredWidth;return t===void 0?this.expand?e.maxWidth:this._fitRange(e).maximum:Math.min(t,e.maxWidth)}*_renderTopBorder(e,t,r,i){let a=r.spanWidth,o=Y(e,this.titleStyle,i),s=u(this.title,e,o),c=n.getLineLength(s);if(c===0){yield new n(t.top.left.repeat(r.left),i),yield new n(t.top.horizontal.repeat(a),i),yield new n(t.top.right.repeat(r.right),i),yield n.line();return}if(yield new n(t.top.left.repeat(r.left),i),c>=a)yield*n.adjustLineLength(s,a,o);else{let e=Math.floor((a-c)/2),r=a-c-e;e>0&&(yield new n(t.top.horizontal.repeat(e),i)),yield*s,r>0&&(yield new n(t.top.horizontal.repeat(r),i))}yield new n(t.top.right.repeat(r.right),i),yield n.line()}*_renderBottomBorder(e,t,r,i){let o=r.spanWidth,s=this._resolveAccessory(this.bottomRightAccessory),c=s===void 0?``:typeof s==`string`?` ${s} `:` ${s.plain} `,m=f(c),h=s instanceof a?s.resolvedStyle(e):d,g=h.isNull?i:h;yield new n(t.bottom.left.repeat(r.left),i);let _=Math.max(0,o-m),v=Y(e,this.subtitleStyle,i),y=u(this.subtitle,e,v),b=n.getLineLength(y);if(b===0)_>0&&(yield new n(t.bottom.horizontal.repeat(_),i));else if(b>=_)yield*n.adjustLineLength(y,_,v);else{let e=Math.floor((_-b)/2),r=_-b-e;e>0&&(yield new n(t.bottom.horizontal.repeat(e),i)),yield*y,r>0&&(yield new n(t.bottom.horizontal.repeat(r),i))}if(m>0){let e=m>o?l(c,p(o)):c;yield new n(e,g)}yield new n(t.bottom.right.repeat(r.right),i),yield n.line()}_resolveAccessory(e){if(e!==void 0)return typeof e==`function`?e():e}static fit(e,t){return new g(e,{...t,expand:!1})}};export{D as C,E as S,k as _,w as a,M as b,z as c,L as d,R as f,A as g,O as h,C as i,B as l,V as m,K as n,T as o,P as p,U as r,S as s,X as t,I as u,F as v,N as x,j as y};