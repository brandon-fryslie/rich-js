import{A as e,At as t,Ct as n,D as r,J as i,M as a,R as o,Tt as s,U as c,bt as l,c as u,j as d,k as f,o as p,z as m}from"./console-CW2MjB9n.js";import{t as h}from"./measure-CA9SN5sN.js";var g=8,_=4,v=/^[\x00-\x7F]*$/,y={"╭":`┌`,"╮":`┐`,"╰":`└`,"╯":`┘`},b=e=>({left:e[0],horizontal:e[1],cross:e[2],right:e[3]}),x=e=>({left:e[0],vertical:e[2],right:e[3]}),S=class e{top;bottom;grid;ascii;headContent;headSeparator;bodyContent;rowSeparator;footSeparator;footContent;constructor(e){let t=e.split(`
`);if(t.length!==g||t.some(e=>Array.from(e).length!==_)||t.some(e=>s(e)!==_))throw Error(`A box grid is ${g} lines of ${_} single-cell characters; got ${t.length} line(s) measuring `+t.map(e=>`${Array.from(e).length}/${s(e)}`).join(`, `)+` characters/cells`);let n=t.map(e=>Array.from(e));this.grid=e,this.ascii=v.test(e),this.top=b(n[0]),this.headContent=x(n[1]),this.headSeparator=b(n[2]),this.bodyContent=x(n[3]),this.rowSeparator=b(n[4]),this.footSeparator=b(n[5]),this.footContent=x(n[6]),this.bottom=b(n[7])}getTop(e,t,n=!0){return this.getEdge(e,this.top,t,n)}getRow(e,t,n,r=!0){return this.getEdge(e,this.getRowChars(t),n,r)}getContentChars(e){switch(e){case`head`:return this.headContent;case`row`:case`mid`:return this.bodyContent;case`foot`:return this.footContent}}getBottom(e,t,n=!0){return this.getEdge(e,this.bottom,t,n)}substitute(e={}){return e.asciiOnly&&!this.ascii?C:e.safe?this.safeSubstitute():this}safeSubstitute(){return new e(Array.from(this.grid,e=>y[e]??e).join(``))}plainHeaded(){return H.find(([e])=>e.grid===this.grid)?.[1]??this}getEdge(e,t,n,r){let i=[];r&&i.push(new c(t.left,n));for(let r=0;r<e.length;r++)r>0&&i.push(new c(t.cross,n)),i.push(new c(t.horizontal.repeat(e[r]),n));return r&&i.push(new c(t.right,n)),i.push(c.line()),i}getRowChars(e){switch(e){case`head`:return this.headSeparator;case`row`:return this.rowSeparator;case`foot`:return this.footSeparator;case`mid`:return{left:this.bodyContent.left,horizontal:` `,cross:this.bodyContent.vertical,right:this.bodyContent.right}}}},C=new S(`+--+
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
    `),H=[[R,E],[D,E],[k,O],[A,O],[T,w]];function U(e){let t=e=>Number.isFinite(e)?n(e):0,r=typeof e==`number`?[e,e,e,e]:e.length===2?[e[0],e[1],e[0],e[1]]:e;return[t(r[0]),t(r[1]),t(r[2]),t(r[3])]}function W(e,t,r){let i=n(e),a=e=>{let t=Math.min(e,i);return i-=t,t},o=a(1),s=a(t),c=a(r);return{left:s,contentWidth:o+i,right:c}}function G(e){return e.left+e.contentWidth+e.right}var K=class{renderable;top;right;bottom;left;style;expand;constructor(e,t,n){let[r,a,o,s]=U(t);this.renderable=e,this.top=r,this.right=a,this.bottom=o,this.left=s,this.style=n?.style??i,this.expand=n?.expand!==!1}*render(t){let n=o(t,this),r=W(n.maxWidth,this.left,this.right),i={...n,maxWidth:r.contentWidth,height:d(n.height,this.top+this.bottom)},a=[...this.renderable.render(i)],s=f(c.splitLines(a),i.height),l=e(n,this.style),u=l.isNull?void 0:l,p=new c(` `.repeat(r.left),u),m=new c(` `.repeat(r.right),u),h=new c(` `.repeat(G(r)),u);for(let e=0;e<this.top;e++)yield h,yield c.line();for(let e of s)yield p,yield*c.adjustLineLength(e,r.contentWidth,u,this.expand),yield m,yield c.line();for(let e=0;e<this.bottom;e++)yield h,yield c.line()}measure(e){let t=m(e),n=W(t.maxWidth,this.left,this.right),r=n.left+n.right;if(a(this.renderable)){let e=h.get({...t,maxWidth:n.contentWidth},this.renderable),i=Math.min(t.maxWidth,e.maximum+r);return{minimum:Math.min(e.minimum+r,i),maximum:i}}return{minimum:r,maximum:t.maxWidth}}};function q(e,t){let[,r,,i]=t,a=n(e),o=e=>{let t=Math.min(e,a);return a-=t,t},s=o(1),c=o(1),l=o(1),u=o(i),d=o(r),f=l+a;return{left:s,right:c,padLeft:u,contentWidth:f,padRight:d,spanWidth:u+f+d}}function J(e){return e.left+e.right+e.padLeft+e.padRight}function Y(t,n,r){return n===void 0?r:e(t,n)}var X=class g{renderable;box;title;subtitle;bottomRightAccessory;expand;style;borderStyle;titleStyle;subtitleStyle;width;padding;constructor(e,t){this.renderable=p(e),this.box=t?.box??F,this.title=t?.title,this.subtitle=t?.subtitle,this.bottomRightAccessory=t?.bottomRightAccessory,this.expand=t?.expand!==!1,this.style=t?.style??i,this.borderStyle=t?.borderStyle??i,this.titleStyle=t?.titleStyle,this.subtitleStyle=t?.subtitleStyle,this.width=t?.width,this.padding=U(t?.padding??[0,1,0,1])}*render(t){let n=o(t,this),r=n.asciiOnly?this.box.substitute({asciiOnly:!0}):this.box,i=e(n,this.borderStyle),a=e(n,this.style),s=i.isNull?void 0:i,c=a.isNull?void 0:a,l=q(this._getPanelWidth(n),this.padding),[u,,d]=this.padding,f=this._renderContent(n,l.contentWidth);yield*this._renderTopBorder(n,r,l,s);for(let e=0;e<u;e++)yield*this._renderRow(r,l,[],s,c);for(let e of f)yield*this._renderRow(r,l,e,s,c);for(let e=0;e<d;e++)yield*this._renderRow(r,l,[],s,c);yield*this._renderBottomBorder(n,r,l,s)}_renderContent(e,t){let[n,,r]=this.padding,i=d(e.height,2+n+r),a={...e,maxWidth:t,height:i},o=f(c.splitLines([...this.renderable.render(a)]),i);return t===0?[]:o}*_renderRow(e,t,n,r,i){let a=e.getContentChars(`row`);yield new c(a.left.repeat(t.left),r);let o=c.adjustLineLength(n,t.contentWidth,i,!1),s=[new c(` `.repeat(t.padLeft),i),...o];yield*c.adjustLineLength(s,t.spanWidth,i),yield new c(a.right.repeat(t.right),r),yield c.line()}measure(e){let t=m(e),n=this._declaredWidth;if(n!==void 0){let e=Math.min(t.maxWidth,n);return{minimum:e,maximum:e}}return this._fitRange(t)}_fitRange(e){let t=q(e.maxWidth,this.padding),n=J(t);if(a(this.renderable)){let r={...e,maxWidth:t.contentWidth},i=h.get(r,this.renderable),a=Math.min(e.maxWidth,i.maximum+n);return{minimum:Math.min(i.minimum+n,a),maximum:a}}return{minimum:Math.min(n,e.maxWidth),maximum:e.maxWidth}}get _declaredWidth(){return this.width===void 0?void 0:n(this.width)}_getPanelWidth(e){let t=this._declaredWidth;return t===void 0?this.expand?e.maxWidth:this._fitRange(e).maximum:Math.min(t,e.maxWidth)}*_renderTopBorder(e,t,n,r){let i=n.spanWidth,a=Y(e,this.titleStyle,r),o=u(this.title,e,a),s=c.getLineLength(o);if(s===0){yield new c(t.top.left.repeat(n.left),r),yield new c(t.top.horizontal.repeat(i),r),yield new c(t.top.right.repeat(n.right),r),yield c.line();return}if(yield new c(t.top.left.repeat(n.left),r),s>=i)yield*c.adjustLineLength(o,i,a);else{let e=Math.floor((i-s)/2),n=i-s-e;e>0&&(yield new c(t.top.horizontal.repeat(e),r)),yield*o,n>0&&(yield new c(t.top.horizontal.repeat(n),r))}yield new c(t.top.right.repeat(n.right),r),yield c.line()}*_renderBottomBorder(e,n,a,o){let d=a.spanWidth,f=this._resolveAccessory(this.bottomRightAccessory),p=f===void 0?``:typeof f==`string`?` ${f} `:` ${f.plain} `,m=s(p),h=f instanceof r?f.resolvedStyle(e):i,g=h.isNull?o:h;yield new c(n.bottom.left.repeat(a.left),o);let _=Math.max(0,d-m),v=Y(e,this.subtitleStyle,o),y=u(this.subtitle,e,v),b=c.getLineLength(y);if(b===0)_>0&&(yield new c(n.bottom.horizontal.repeat(_),o));else if(b>=_)yield*c.adjustLineLength(y,_,v);else{let e=Math.floor((_-b)/2),t=_-b-e;e>0&&(yield new c(n.bottom.horizontal.repeat(e),o)),yield*y,t>0&&(yield new c(n.bottom.horizontal.repeat(t),o))}if(m>0){let e=m>d?t(p,l(d)):p;yield new c(e,g)}yield new c(n.bottom.right.repeat(a.right),o),yield c.line()}_resolveAccessory(e){if(e!==void 0)return typeof e==`function`?e():e}static fit(e,t){return new g(e,{...t,expand:!1})}};export{D as C,E as S,k as _,w as a,M as b,z as c,L as d,R as f,A as g,O as h,C as i,B as l,V as m,K as n,T as o,P as p,U as r,S as s,X as t,I as u,F as v,N as x,j as y};