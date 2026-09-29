import{A as e,Ct as t,Et as n,F as r,H as i,I as a,K as o,M as s,N as c,Nt as l,Ot as u,P as d,V as f,Z as p,d as m,l as h,r as g}from"./console-DIhqDZk0.js";var _=8,v=4,y={"╭":`┌`,"╮":`┐`,"╰":`└`,"╯":`┘`},b=e=>({left:e[0],horizontal:e[1],cross:e[2],right:e[3]}),x=e=>({left:e[0],vertical:e[2],right:e[3]}),S=class e{top;bottom;grid;headContent;headSeparator;bodyContent;rowSeparator;footSeparator;footContent;constructor(e){let t=e.split(`
`);if(t.length!==_||t.some(e=>Array.from(e).length!==v)||t.some(e=>u(e)!==v))throw Error(`A box grid is ${_} lines of ${v} single-cell characters; got ${t.length} line(s) measuring `+t.map(e=>`${Array.from(e).length}/${u(e)}`).join(`, `)+` characters/cells`);let n=t.map(e=>Array.from(e));this.grid=e,this.top=b(n[0]),this.headContent=x(n[1]),this.headSeparator=b(n[2]),this.bodyContent=x(n[3]),this.rowSeparator=b(n[4]),this.footSeparator=b(n[5]),this.footContent=x(n[6]),this.bottom=b(n[7])}getTop(e,t,n=!0){return this.getEdge(e,this.top,t,n)}getRow(e,t,n,r=!0){return this.getEdge(e,this.getRowChars(t),n,r)}getContentChars(e){switch(e){case`head`:return this.headContent;case`row`:case`mid`:return this.bodyContent;case`foot`:return this.footContent}}getBottom(e,t,n=!0){return this.getEdge(e,this.bottom,t,n)}substitute(e={}){let t=s(e,this,C,e=>e.grid);return t===this&&e.safe===!0?this.safeSubstitute():t}safeSubstitute(){return new e(Array.from(this.grid,e=>y[e]??e).join(``))}plainHeaded(){return H.find(([e])=>e.grid===this.grid)?.[1]??this}getEdge(e,t,n,r){let i=[];r&&i.push(new o(t.left,n));for(let r=0;r<e.length;r++)r>0&&i.push(new o(t.cross,n)),i.push(new o(t.horizontal.repeat(e[r]),n));return r&&i.push(new o(t.right,n)),i.push(o.line()),i}getRowChars(e){switch(e){case`head`:return this.headSeparator;case`row`:return this.rowSeparator;case`foot`:return this.footSeparator;case`mid`:return{left:this.bodyContent.left,horizontal:` `,cross:this.bodyContent.vertical,right:this.bodyContent.right}}}},C=new S(`+--+
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
    `),H=[[R,E],[D,E],[k,O],[A,O],[T,w]];function U(e){let t=e=>Number.isFinite(e)?n(e):0,r=typeof e==`number`?[e,e,e,e]:e.length===2?[e[0],e[1],e[0],e[1]]:e;return[t(r[0]),t(r[1]),t(r[2]),t(r[3])]}function W(e,t,r){let i=n(e),a=e=>{let t=Math.min(e,i);return i-=t,t},o=a(1),s=a(t),c=a(r);return{left:s,contentWidth:o+i,right:c}}function G(e){return e.left+e.contentWidth+e.right}var K=class{renderable;top;right;bottom;left;style;expand;constructor(e,t,n){let[r,i,a,o]=U(t);this.renderable=e,this.top=r,this.right=i,this.bottom=a,this.left=o,this.style=n?.style??p,this.expand=n?.expand!==!1}*render(e){let t=f(e,this),n=W(t.maxWidth,this.left,this.right),i={...t,maxWidth:n.contentWidth,height:r(t.height,this.top+this.bottom)},a=[...this.renderable.render(i)],s=c(o.splitLines(a),i.height),l=d(t,this.style),u=l.isNull?void 0:l,p=new o(` `.repeat(n.left),u),m=new o(` `.repeat(n.right),u),h=new o(` `.repeat(G(n)),u);for(let e=0;e<this.top;e++)yield h,yield o.line();for(let e of s)yield p,yield*o.adjustLineLength(e,n.contentWidth,u,this.expand),yield m,yield o.line();for(let e=0;e<this.bottom;e++)yield h,yield o.line()}measure(e){let t=i(e),n=W(t.maxWidth,this.left,this.right),r=n.left+n.right;if(a(this.renderable)){let e=g.get({...t,maxWidth:n.contentWidth},this.renderable),i=Math.min(t.maxWidth,e.maximum+r);return{minimum:Math.min(e.minimum+r,i),maximum:i}}return{minimum:r,maximum:t.maxWidth}}};function q(e,t){let[,r,,i]=t,a=n(e),o=e=>{let t=Math.min(e,a);return a-=t,t},s=o(1),c=o(1),l=o(1),u=o(i),d=o(r),f=l+a;return{left:s,right:c,padLeft:u,contentWidth:f,padRight:d,spanWidth:u+f+d}}function J(e){return e.left+e.right+e.padLeft+e.padRight}function Y(e,t,n){return t===void 0?n:d(e,t)}var X=class s{renderable;box;title;subtitle;bottomRightAccessory;expand;style;borderStyle;titleStyle;subtitleStyle;width;padding;constructor(e,t){this.renderable=h(e),this.box=t?.box??F,this.title=t?.title,this.subtitle=t?.subtitle,this.bottomRightAccessory=t?.bottomRightAccessory,this.expand=t?.expand!==!1,this.style=t?.style??p,this.borderStyle=t?.borderStyle??p,this.titleStyle=t?.titleStyle,this.subtitleStyle=t?.subtitleStyle,this.width=t?.width,this.padding=U(t?.padding??[0,1,0,1])}*render(e){let t=f(e,this),n=this.box.substitute(t),r=d(t,this.borderStyle),i=d(t,this.style),a=r.isNull?void 0:r,o=i.isNull?void 0:i,s=q(this._getPanelWidth(t),this.padding),[c,,l]=this.padding,u=this._renderContent(t,s.contentWidth);yield*this._renderTopBorder(t,n,s,a);for(let e=0;e<c;e++)yield*this._renderRow(n,s,[],a,o);for(let e of u)yield*this._renderRow(n,s,e,a,o);for(let e=0;e<l;e++)yield*this._renderRow(n,s,[],a,o);yield*this._renderBottomBorder(t,n,s,a)}_renderContent(e,t){let[n,,i]=this.padding,a=r(e.height,2+n+i),s={...e,maxWidth:t,height:a},l=c(o.splitLines([...this.renderable.render(s)]),a);return t===0?[]:l}*_renderRow(e,t,n,r,i){let a=e.getContentChars(`row`);yield new o(a.left.repeat(t.left),r);let s=o.adjustLineLength(n,t.contentWidth,i,!1),c=[new o(` `.repeat(t.padLeft),i),...s];yield*o.adjustLineLength(c,t.spanWidth,i),yield new o(a.right.repeat(t.right),r),yield o.line()}measure(e){let t=i(e),n=this._declaredWidth;if(n!==void 0){let e=Math.min(t.maxWidth,n);return{minimum:e,maximum:e}}return this._fitRange(t)}_fitRange(e){let t=q(e.maxWidth,this.padding),n=J(t);if(a(this.renderable)){let r={...e,maxWidth:t.contentWidth},i=g.get(r,this.renderable),a=Math.min(e.maxWidth,i.maximum+n);return{minimum:Math.min(i.minimum+n,a),maximum:a}}return{minimum:Math.min(n,e.maxWidth),maximum:e.maxWidth}}get _declaredWidth(){return this.width===void 0?void 0:n(this.width)}_getPanelWidth(e){let t=this._declaredWidth;return t===void 0?this.expand?e.maxWidth:this._fitRange(e).maximum:Math.min(t,e.maxWidth)}*_renderTopBorder(e,t,n,r){let i=n.spanWidth,a=Y(e,this.titleStyle,r),s=m(this.title,e,a),c=o.getLineLength(s);if(c===0){yield new o(t.top.left.repeat(n.left),r),yield new o(t.top.horizontal.repeat(i),r),yield new o(t.top.right.repeat(n.right),r),yield o.line();return}if(yield new o(t.top.left.repeat(n.left),r),c>=i)yield*o.adjustLineLength(s,i,a);else{let e=Math.floor((i-c)/2),n=i-c-e;e>0&&(yield new o(t.top.horizontal.repeat(e),r)),yield*s,n>0&&(yield new o(t.top.horizontal.repeat(n),r))}yield new o(t.top.right.repeat(n.right),r),yield o.line()}*_renderBottomBorder(n,r,i,a){let s=i.spanWidth,c=this._resolveAccessory(this.bottomRightAccessory),d=c===void 0?``:typeof c==`string`?` ${c} `:` ${c.plain} `,f=u(d),h=c instanceof e?c.resolvedStyle(n):p,g=h.isNull?a:h;yield new o(r.bottom.left.repeat(i.left),a);let _=Math.max(0,s-f),v=Y(n,this.subtitleStyle,a),y=m(this.subtitle,n,v),b=o.getLineLength(y);if(b===0)_>0&&(yield new o(r.bottom.horizontal.repeat(_),a));else if(b>=_)yield*o.adjustLineLength(y,_,v);else{let e=Math.floor((_-b)/2),t=_-b-e;e>0&&(yield new o(r.bottom.horizontal.repeat(e),a)),yield*y,t>0&&(yield new o(r.bottom.horizontal.repeat(t),a))}if(f>0){let e=f>s?l(d,t(s)):d;yield new o(e,g)}yield new o(r.bottom.right.repeat(i.right),a),yield o.line()}_resolveAccessory(e){if(e!==void 0)return typeof e==`function`?e():e}static fit(e,t){return new s(e,{...t,expand:!1})}};export{D as C,E as S,k as _,w as a,M as b,z as c,L as d,R as f,A as g,O as h,C as i,B as l,V as m,K as n,T as o,P as p,U as r,S as s,X as t,I as u,F as v,N as x,j as y};