import{Et as e,F as t,H as n,M as r,N as i,O as a,P as o,V as s,W as c,Y as l,i as u,jt as d,o as f,wt as p,xt as m}from"./host-environment-Cc0LP7Fa.js";import{t as h}from"./measure-DOG4T1-d.js";var g=8,_=4,v=/^[\x00-\x7F]*$/,y={"╭":`┌`,"╮":`┐`,"╰":`└`,"╯":`┘`},b=e=>({left:e[0],horizontal:e[1],cross:e[2],right:e[3]}),x=e=>({left:e[0],vertical:e[2],right:e[3]}),S=class t{top;bottom;grid;ascii;headContent;headSeparator;bodyContent;rowSeparator;footSeparator;footContent;constructor(t){let n=t.split(`
`);if(n.length!==g||n.some(e=>Array.from(e).length!==_)||n.some(t=>e(t)!==_))throw Error(`A box grid is ${g} lines of ${_} single-cell characters; got ${n.length} line(s) measuring `+n.map(t=>`${Array.from(t).length}/${e(t)}`).join(`, `)+` characters/cells`);let r=n.map(e=>Array.from(e));this.grid=t,this.ascii=v.test(t),this.top=b(r[0]),this.headContent=x(r[1]),this.headSeparator=b(r[2]),this.bodyContent=x(r[3]),this.rowSeparator=b(r[4]),this.footSeparator=b(r[5]),this.footContent=x(r[6]),this.bottom=b(r[7])}getTop(e,t,n=!0){return this.getEdge(e,this.top,t,n)}getRow(e,t,n,r=!0){return this.getEdge(e,this.getRowChars(t),n,r)}getContentChars(e){switch(e){case`head`:return this.headContent;case`row`:case`mid`:return this.bodyContent;case`foot`:return this.footContent}}getBottom(e,t,n=!0){return this.getEdge(e,this.bottom,t,n)}substitute(e={}){return e.asciiOnly&&!this.ascii?C:e.safe?this.safeSubstitute():this}safeSubstitute(){return new t(Array.from(this.grid,e=>y[e]??e).join(``))}plainHeaded(){return H.find(([e])=>e.grid===this.grid)?.[1]??this}getEdge(e,t,n,r){let i=[];r&&i.push(new c(t.left,n));for(let r=0;r<e.length;r++)r>0&&i.push(new c(t.cross,n)),i.push(new c(t.horizontal.repeat(e[r]),n));return r&&i.push(new c(t.right,n)),i.push(c.line()),i}getRowChars(e){switch(e){case`head`:return this.headSeparator;case`row`:return this.rowSeparator;case`foot`:return this.footSeparator;case`mid`:return{left:this.bodyContent.left,horizontal:` `,cross:this.bodyContent.vertical,right:this.bodyContent.right}}}},C=new S(`+--+
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
    `),H=[[R,E],[D,E],[k,O],[A,O],[T,w]];function U(e){let t=e=>Number.isFinite(e)?p(e):0,n=typeof e==`number`?[e,e,e,e]:e.length===2?[e[0],e[1],e[0],e[1]]:e;return[t(n[0]),t(n[1]),t(n[2]),t(n[3])]}function W(e,t,n){let r=p(e),i=e=>{let t=Math.min(e,r);return r-=t,t},a=i(1),o=i(t),s=i(n);return{left:o,contentWidth:a+r,right:s}}function G(e){return e.left+e.contentWidth+e.right}var K=class{renderable;top;right;bottom;left;style;expand;constructor(e,t,n){let[r,i,a,o]=U(t);this.renderable=e,this.top=r,this.right=i,this.bottom=a,this.left=o,this.style=n?.style??l,this.expand=n?.expand!==!1}*render(e){let t=s(e,this),n=W(t.maxWidth,this.left,this.right),a={...t,maxWidth:n.contentWidth,height:o(t.height,this.top+this.bottom)},l=[...this.renderable.render(a)],u=r(c.splitLines(l),a.height),d=i(t,this.style),f=d.isNull?void 0:d,p=new c(` `.repeat(n.left),f),m=new c(` `.repeat(n.right),f),h=new c(` `.repeat(G(n)),f);for(let e=0;e<this.top;e++)yield h,yield c.line();for(let e of u)yield p,yield*c.adjustLineLength(e,n.contentWidth,f,this.expand),yield m,yield c.line();for(let e=0;e<this.bottom;e++)yield h,yield c.line()}measure(e){let r=n(e),i=W(r.maxWidth,this.left,this.right),a=i.left+i.right;if(t(this.renderable)){let e=h.get({...r,maxWidth:i.contentWidth},this.renderable),t=Math.min(r.maxWidth,e.maximum+a);return{minimum:Math.min(e.minimum+a,t),maximum:t}}return{minimum:a,maximum:r.maxWidth}}};function q(e,t){let[,n,,r]=t,i=p(e),a=e=>{let t=Math.min(e,i);return i-=t,t},o=a(1),s=a(1),c=a(1),l=a(r),u=a(n),d=c+i;return{left:o,right:s,padLeft:l,contentWidth:d,padRight:u,spanWidth:l+d+u}}function J(e){return e.left+e.right+e.padLeft+e.padRight}function Y(e,t,n){return t===void 0?n:i(e,t)}var X=class g{renderable;box;title;subtitle;bottomRightAccessory;expand;style;borderStyle;titleStyle;subtitleStyle;width;padding;constructor(e,t){this.renderable=u(e),this.box=t?.box??F,this.title=t?.title,this.subtitle=t?.subtitle,this.bottomRightAccessory=t?.bottomRightAccessory,this.expand=t?.expand!==!1,this.style=t?.style??l,this.borderStyle=t?.borderStyle??l,this.titleStyle=t?.titleStyle,this.subtitleStyle=t?.subtitleStyle,this.width=t?.width,this.padding=U(t?.padding??[0,1,0,1])}*render(e){let t=s(e,this),n=t.asciiOnly?this.box.substitute({asciiOnly:!0}):this.box,r=i(t,this.borderStyle),a=i(t,this.style),o=r.isNull?void 0:r,c=a.isNull?void 0:a,l=q(this._getPanelWidth(t),this.padding),[u,,d]=this.padding,f=this._renderContent(t,l.contentWidth);yield*this._renderTopBorder(t,n,l,o);for(let e=0;e<u;e++)yield*this._renderRow(n,l,[],o,c);for(let e of f)yield*this._renderRow(n,l,e,o,c);for(let e=0;e<d;e++)yield*this._renderRow(n,l,[],o,c);yield*this._renderBottomBorder(t,n,l,o)}_renderContent(e,t){let[n,,i]=this.padding,a=o(e.height,2+n+i),s={...e,maxWidth:t,height:a},l=r(c.splitLines([...this.renderable.render(s)]),a);return t===0?[]:l}*_renderRow(e,t,n,r,i){let a=e.getContentChars(`row`);yield new c(a.left.repeat(t.left),r);let o=c.adjustLineLength(n,t.contentWidth,i,!1),s=[new c(` `.repeat(t.padLeft),i),...o];yield*c.adjustLineLength(s,t.spanWidth,i),yield new c(a.right.repeat(t.right),r),yield c.line()}measure(e){let t=n(e),r=this._declaredWidth;if(r!==void 0){let e=Math.min(t.maxWidth,r);return{minimum:e,maximum:e}}return this._fitRange(t)}_fitRange(e){let n=q(e.maxWidth,this.padding),r=J(n);if(t(this.renderable)){let t={...e,maxWidth:n.contentWidth},i=h.get(t,this.renderable),a=Math.min(e.maxWidth,i.maximum+r);return{minimum:Math.min(i.minimum+r,a),maximum:a}}return{minimum:Math.min(r,e.maxWidth),maximum:e.maxWidth}}get _declaredWidth(){return this.width===void 0?void 0:p(this.width)}_getPanelWidth(e){let t=this._declaredWidth;return t===void 0?this.expand?e.maxWidth:this._fitRange(e).maximum:Math.min(t,e.maxWidth)}*_renderTopBorder(e,t,n,r){let i=n.spanWidth,a=Y(e,this.titleStyle,r),o=f(this.title,e,a),s=c.getLineLength(o);if(s===0){yield new c(t.top.left.repeat(n.left),r),yield new c(t.top.horizontal.repeat(i),r),yield new c(t.top.right.repeat(n.right),r),yield c.line();return}if(yield new c(t.top.left.repeat(n.left),r),s>=i)yield*c.adjustLineLength(o,i,a);else{let e=Math.floor((i-s)/2),n=i-s-e;e>0&&(yield new c(t.top.horizontal.repeat(e),r)),yield*o,n>0&&(yield new c(t.top.horizontal.repeat(n),r))}yield new c(t.top.right.repeat(n.right),r),yield c.line()}*_renderBottomBorder(t,n,r,i){let o=r.spanWidth,s=this._resolveAccessory(this.bottomRightAccessory),u=s===void 0?``:typeof s==`string`?` ${s} `:` ${s.plain} `,p=e(u),h=s instanceof a?s.resolvedStyle(t):l,g=h.isNull?i:h;yield new c(n.bottom.left.repeat(r.left),i);let _=Math.max(0,o-p),v=Y(t,this.subtitleStyle,i),y=f(this.subtitle,t,v),b=c.getLineLength(y);if(b===0)_>0&&(yield new c(n.bottom.horizontal.repeat(_),i));else if(b>=_)yield*c.adjustLineLength(y,_,v);else{let e=Math.floor((_-b)/2),t=_-b-e;e>0&&(yield new c(n.bottom.horizontal.repeat(e),i)),yield*y,t>0&&(yield new c(n.bottom.horizontal.repeat(t),i))}if(p>0){let e=p>o?d(u,m(o)):u;yield new c(e,g)}yield new c(n.bottom.right.repeat(r.right),i),yield c.line()}_resolveAccessory(e){if(e!==void 0)return typeof e==`function`?e():e}static fit(e,t){return new g(e,{...t,expand:!1})}};export{D as C,E as S,k as _,w as a,M as b,z as c,L as d,R as f,A as g,O as h,C as i,B as l,V as m,K as n,T as o,P as p,U as r,S as s,X as t,I as u,F as v,N as x,j as y};