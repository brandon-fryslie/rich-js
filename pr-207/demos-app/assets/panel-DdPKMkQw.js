import{At as e,B as t,Ct as n,F as r,J as i,M as a,N as o,O as s,P as c,Tt as l,U as u,V as d,bt as f,i as p,o as m}from"./host-environment-C1VK3LNs.js";import{t as h}from"./measure-U6tA3VUi.js";var g=8,_=4,v=/^[\x00-\x7F]*$/,y={"╭":`┌`,"╮":`┐`,"╰":`└`,"╯":`┘`},b=e=>({left:e[0],horizontal:e[1],cross:e[2],right:e[3]}),x=e=>({left:e[0],vertical:e[2],right:e[3]}),S=class e{top;bottom;grid;ascii;headContent;headSeparator;bodyContent;rowSeparator;footSeparator;footContent;constructor(e){let t=e.split(`
`);if(t.length!==g||t.some(e=>Array.from(e).length!==_)||t.some(e=>l(e)!==_))throw Error(`A box grid is ${g} lines of ${_} single-cell characters; got ${t.length} line(s) measuring `+t.map(e=>`${Array.from(e).length}/${l(e)}`).join(`, `)+` characters/cells`);let n=t.map(e=>Array.from(e));this.grid=e,this.ascii=v.test(e),this.top=b(n[0]),this.headContent=x(n[1]),this.headSeparator=b(n[2]),this.bodyContent=x(n[3]),this.rowSeparator=b(n[4]),this.footSeparator=b(n[5]),this.footContent=x(n[6]),this.bottom=b(n[7])}getTop(e,t,n=!0){return this.getEdge(e,this.top,t,n)}getRow(e,t,n,r=!0){return this.getEdge(e,this.getRowChars(t),n,r)}getContentChars(e){switch(e){case`head`:return this.headContent;case`row`:case`mid`:return this.bodyContent;case`foot`:return this.footContent}}getBottom(e,t,n=!0){return this.getEdge(e,this.bottom,t,n)}substitute(e={}){return e.asciiOnly&&!this.ascii?C:e.safe?this.safeSubstitute():this}safeSubstitute(){return new e(Array.from(this.grid,e=>y[e]??e).join(``))}plainHeaded(){return H.find(([e])=>e.grid===this.grid)?.[1]??this}getEdge(e,t,n,r){let i=[];r&&i.push(new u(t.left,n));for(let r=0;r<e.length;r++)r>0&&i.push(new u(t.cross,n)),i.push(new u(t.horizontal.repeat(e[r]),n));return r&&i.push(new u(t.right,n)),i.push(u.line()),i}getRowChars(e){switch(e){case`head`:return this.headSeparator;case`row`:return this.rowSeparator;case`foot`:return this.footSeparator;case`mid`:return{left:this.bodyContent.left,horizontal:` `,cross:this.bodyContent.vertical,right:this.bodyContent.right}}}},C=new S(`+--+
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
    `),H=[[R,E],[D,E],[k,O],[A,O],[T,w]];function U(e){let t=e=>Number.isFinite(e)?n(e):0,r=typeof e==`number`?[e,e,e,e]:e.length===2?[e[0],e[1],e[0],e[1]]:e;return[t(r[0]),t(r[1]),t(r[2]),t(r[3])]}function W(e,t,r){let i=n(e),a=e=>{let t=Math.min(e,i);return i-=t,t},o=a(1),s=a(t),c=a(r);return{left:s,contentWidth:o+i,right:c}}function G(e){return e.left+e.contentWidth+e.right}var K=class{renderable;top;right;bottom;left;style;expand;constructor(e,t,n){let[r,a,o,s]=U(t);this.renderable=e,this.top=r,this.right=a,this.bottom=o,this.left=s,this.style=n?.style??i,this.expand=n?.expand!==!1}*render(e){let n=t(e,this),r=W(n.maxWidth,this.left,this.right),i={...n,maxWidth:r.contentWidth,height:c(n.height,this.top+this.bottom)},s=[...this.renderable.render(i)],l=a(u.splitLines(s),i.height),d=o(n,this.style),f=d.isNull?void 0:d,p=new u(` `.repeat(r.left),f),m=new u(` `.repeat(r.right),f),h=new u(` `.repeat(G(r)),f);for(let e=0;e<this.top;e++)yield h,yield u.line();for(let e of l)yield p,yield*u.adjustLineLength(e,r.contentWidth,f,this.expand),yield m,yield u.line();for(let e=0;e<this.bottom;e++)yield h,yield u.line()}measure(e){let t=d(e),n=W(t.maxWidth,this.left,this.right),i=n.left+n.right;if(r(this.renderable)){let e=h.get({...t,maxWidth:n.contentWidth},this.renderable),r=Math.min(t.maxWidth,e.maximum+i);return{minimum:Math.min(e.minimum+i,r),maximum:r}}return{minimum:i,maximum:t.maxWidth}}};function q(e,t){let[,r,,i]=t,a=n(e),o=e=>{let t=Math.min(e,a);return a-=t,t},s=o(1),c=o(1),l=o(1),u=o(i),d=o(r),f=l+a;return{left:s,right:c,padLeft:u,contentWidth:f,padRight:d,spanWidth:u+f+d}}function J(e){return e.left+e.right+e.padLeft+e.padRight}function Y(e,t,n){return t===void 0?n:o(e,t)}var X=class g{renderable;box;title;subtitle;bottomRightAccessory;expand;style;borderStyle;titleStyle;subtitleStyle;width;padding;constructor(e,t){this.renderable=p(e),this.box=t?.box??F,this.title=t?.title,this.subtitle=t?.subtitle,this.bottomRightAccessory=t?.bottomRightAccessory,this.expand=t?.expand!==!1,this.style=t?.style??i,this.borderStyle=t?.borderStyle??i,this.titleStyle=t?.titleStyle,this.subtitleStyle=t?.subtitleStyle,this.width=t?.width,this.padding=U(t?.padding??[0,1,0,1])}*render(e){let n=t(e,this),r=n.asciiOnly?this.box.substitute({asciiOnly:!0}):this.box,i=o(n,this.borderStyle),a=o(n,this.style),s=i.isNull?void 0:i,c=a.isNull?void 0:a,l=q(this._getPanelWidth(n),this.padding),[u,,d]=this.padding,f=this._renderContent(n,l.contentWidth);yield*this._renderTopBorder(n,r,l,s);for(let e=0;e<u;e++)yield*this._renderRow(r,l,[],s,c);for(let e of f)yield*this._renderRow(r,l,e,s,c);for(let e=0;e<d;e++)yield*this._renderRow(r,l,[],s,c);yield*this._renderBottomBorder(n,r,l,s)}_renderContent(e,t){let[n,,r]=this.padding,i=c(e.height,2+n+r),o={...e,maxWidth:t,height:i},s=a(u.splitLines([...this.renderable.render(o)]),i);return t===0?[]:s}*_renderRow(e,t,n,r,i){let a=e.getContentChars(`row`);yield new u(a.left.repeat(t.left),r);let o=u.adjustLineLength(n,t.contentWidth,i,!1),s=[new u(` `.repeat(t.padLeft),i),...o];yield*u.adjustLineLength(s,t.spanWidth,i),yield new u(a.right.repeat(t.right),r),yield u.line()}measure(e){let t=d(e),n=this._declaredWidth;if(n!==void 0){let e=Math.min(t.maxWidth,n);return{minimum:e,maximum:e}}return this._fitRange(t)}_fitRange(e){let t=q(e.maxWidth,this.padding),n=J(t);if(r(this.renderable)){let r={...e,maxWidth:t.contentWidth},i=h.get(r,this.renderable),a=Math.min(e.maxWidth,i.maximum+n);return{minimum:Math.min(i.minimum+n,a),maximum:a}}return{minimum:Math.min(n,e.maxWidth),maximum:e.maxWidth}}get _declaredWidth(){return this.width===void 0?void 0:n(this.width)}_getPanelWidth(e){let t=this._declaredWidth;return t===void 0?this.expand?e.maxWidth:this._fitRange(e).maximum:Math.min(t,e.maxWidth)}*_renderTopBorder(e,t,n,r){let i=n.spanWidth,a=Y(e,this.titleStyle,r),o=m(this.title,e,a),s=u.getLineLength(o);if(s===0){yield new u(t.top.left.repeat(n.left),r),yield new u(t.top.horizontal.repeat(i),r),yield new u(t.top.right.repeat(n.right),r),yield u.line();return}if(yield new u(t.top.left.repeat(n.left),r),s>=i)yield*u.adjustLineLength(o,i,a);else{let e=Math.floor((i-s)/2),n=i-s-e;e>0&&(yield new u(t.top.horizontal.repeat(e),r)),yield*o,n>0&&(yield new u(t.top.horizontal.repeat(n),r))}yield new u(t.top.right.repeat(n.right),r),yield u.line()}*_renderBottomBorder(t,n,r,a){let o=r.spanWidth,c=this._resolveAccessory(this.bottomRightAccessory),d=c===void 0?``:typeof c==`string`?` ${c} `:` ${c.plain} `,p=l(d),h=c instanceof s?c.resolvedStyle(t):i,g=h.isNull?a:h;yield new u(n.bottom.left.repeat(r.left),a);let _=Math.max(0,o-p),v=Y(t,this.subtitleStyle,a),y=m(this.subtitle,t,v),b=u.getLineLength(y);if(b===0)_>0&&(yield new u(n.bottom.horizontal.repeat(_),a));else if(b>=_)yield*u.adjustLineLength(y,_,v);else{let e=Math.floor((_-b)/2),t=_-b-e;e>0&&(yield new u(n.bottom.horizontal.repeat(e),a)),yield*y,t>0&&(yield new u(n.bottom.horizontal.repeat(t),a))}if(p>0){let t=p>o?e(d,f(o)):d;yield new u(t,g)}yield new u(n.bottom.right.repeat(r.right),a),yield u.line()}_resolveAccessory(e){if(e!==void 0)return typeof e==`function`?e():e}static fit(e,t){return new g(e,{...t,expand:!1})}};export{D as C,E as S,k as _,w as a,M as b,z as c,L as d,R as f,A as g,O as h,C as i,B as l,V as m,K as n,T as o,P as p,U as r,S as s,X as t,I as u,F as v,N as x,j as y};