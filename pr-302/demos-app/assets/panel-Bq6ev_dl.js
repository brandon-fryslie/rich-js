import{F as e,Ft as t,G as n,I as r,K as i,Kt as a,L as o,Lt as s,M as c,Z as l,d as u,jt as d,nt as f,r as p,u as m,z as h}from"./console-Cs3Tq-96.js";var g=8,_=4,v={"╭":`┌`,"╮":`┐`,"╰":`└`,"╯":`┘`},y=e=>({left:e[0],horizontal:e[1],cross:e[2],right:e[3]}),b=e=>({left:e[0],vertical:e[2],right:e[3]}),x=class t{top;bottom;grid;headContent;headSeparator;bodyContent;rowSeparator;footSeparator;footContent;constructor(e){let t=e.split(`
`);if(t.length!==g||t.some(e=>Array.from(e).length!==_)||t.some(e=>s(e)!==_))throw Error(`A box grid is ${g} lines of ${_} single-cell characters; got ${t.length} line(s) measuring `+t.map(e=>`${Array.from(e).length}/${s(e)}`).join(`, `)+` characters/cells`);let n=t.map(e=>Array.from(e));this.grid=e,this.top=y(n[0]),this.headContent=b(n[1]),this.headSeparator=y(n[2]),this.bodyContent=b(n[3]),this.rowSeparator=y(n[4]),this.footSeparator=y(n[5]),this.footContent=b(n[6]),this.bottom=y(n[7])}getTop(e,t,n=!0){return this.getEdge(e,this.top,t,n)}getRow(e,t,n,r=!0){return this.getEdge(e,this.getRowChars(t),n,r)}getContentChars(e){switch(e){case`head`:return this.headContent;case`row`:case`mid`:return this.bodyContent;case`foot`:return this.footContent}}getBottom(e,t,n=!0){return this.getEdge(e,this.bottom,t,n)}substitute(t={}){let n=e(t,this,S,e=>e.grid);return n===this&&t.safe===!0?this.safeSubstitute():n}safeSubstitute(){return new t(Array.from(this.grid,e=>v[e]??e).join(``))}plainHeaded(){return V.find(([e])=>e.grid===this.grid)?.[1]??this}getEdge(e,t,n,r){let i=e.map(e=>t.horizontal.repeat(e)).join(t.cross),a=r?t.left+i+t.right:i;return[new l(a,n),l.line()]}getRowChars(e){switch(e){case`head`:return this.headSeparator;case`row`:return this.rowSeparator;case`foot`:return this.footSeparator;case`mid`:return{left:this.bodyContent.left,horizontal:` `,cross:this.bodyContent.vertical,right:this.bodyContent.right}}}},S=new x(`+--+
| ||
|-+|
| ||
|-+|
|-+|
| ||
+--+`),C=new x(`+-++
| ||
+-++
| ||
+-++
+-++
| ||
+-++`),w=new x(`+-++
| ||
+=++
| ||
+-++
+-++
| ||
+-++`),T=new x(`┌─┬┐
│ ││
├─┼┤
│ ││
├─┼┤
├─┼┤
│ ││
└─┴┘`),E=new x(`┌─┬┐
│ ││
╞═╪╡
│ ││
├─┼┤
├─┼┤
│ ││
└─┴┘`),D=new x(`  ╷ 
  │ 
╶─┼╴
  │ 
╶─┼╴
╶─┼╴
  │ 
  ╵ `),O=new x(`  ╷ 
  │ 
╺━┿╸
  │ 
╶─┼╴
╶─┼╴
  │ 
  ╵ `),k=new x(`  ╷ 
  │ 
 ═╪ 
  │ 
 ─┼ 
 ─┼ 
  │ 
  ╵ `),A=new x(`    
    
 ── 
    
    
 ── 
    
    `),j=new x(`    
    
 ── 
    
    
    
    
    `),M=new x(`    
    
 ━━ 
    
    
 ━━ 
    
    `),N=new x(` ── 
    
 ── 
    
 ── 
 ── 
    
 ── `),P=new x(`╭─┬╮
│ ││
├─┼┤
│ ││
├─┼┤
├─┼┤
│ ││
╰─┴╯`),F=new x(`┏━┳┓
┃ ┃┃
┣━╋┫
┃ ┃┃
┣━╋┫
┣━╋┫
┃ ┃┃
┗━┻┛`),I=new x(`┏━┯┓
┃ │┃
┠─┼┨
┃ │┃
┠─┼┨
┠─┼┨
┃ │┃
┗━┷┛`),L=new x(`┏━┳┓
┃ ┃┃
┡━╇┩
│ ││
├─┼┤
├─┼┤
│ ││
└─┴┘`),R=new x(`╔═╦╗
║ ║║
╠═╬╣
║ ║║
╠═╬╣
╠═╬╣
║ ║║
╚═╩╝`),z=new x(`╔═╤╗
║ │║
╟─┼╢
║ │║
╟─┼╢
╟─┼╢
║ │║
╚═╧╝`),B=new x(`    
| ||
|-||
| ||
|-||
|-||
| ||
    `),V=[[L,T],[E,T],[O,D],[k,D],[w,C]];function H(e){let n=e=>Number.isFinite(e)?t(e):0,r=typeof e==`number`?[e,e,e,e]:e.length===2?[e[0],e[1],e[0],e[1]]:e;return[n(r[0]),n(r[1]),n(r[2]),n(r[3])]}function U(e,n,r){let i=t(e),a=e=>{let t=Math.min(e,i);return i-=t,t},o=a(1),s=a(n),c=a(r);return{left:s,contentWidth:o+i,right:c}}function W(e){return e.left+e.contentWidth+e.right}var G=class{renderable;top;right;bottom;left;style;expand;constructor(e,t,n){let[r,i,a,o]=H(t);this.renderable=m(e),this.top=r,this.right=i,this.bottom=a,this.left=o,this.style=n?.style??f,this.expand=n?.expand!==!1}*render(e){let t=n(e,this),i=U(this.expand?t.maxWidth:p.get(t,this).maximum,this.left,this.right),a={...t,maxWidth:i.contentWidth,height:h(t.height,this.top+this.bottom)},s=o(t,this.style),c=s.isNull?void 0:s,u=[...l.applyStyle(this.renderable.render(a),c)],d=r(l.splitLines(u),a.height),f=new l(` `.repeat(i.left),c),m=new l(` `.repeat(i.right),c),g=new l(` `.repeat(W(i)),c);for(let e=0;e<this.top;e++)yield g,yield l.line();for(let e of d)yield f,yield*l.adjustLineLength(e,i.contentWidth,c),yield m,yield l.line();for(let e=0;e<this.bottom;e++)yield g,yield l.line()}measure(e){let t=i(e),n=U(t.maxWidth,this.left,this.right),r=n.left+n.right,a=p.get({...t,maxWidth:n.contentWidth},this.renderable),o=Math.min(t.maxWidth,a.maximum+r);return{minimum:Math.min(a.minimum+r,o),maximum:o}}};function K(e,n){let[,r,,i]=n,a=t(e),o=e=>{let t=Math.min(e,a);return a-=t,t},s=o(1),c=o(1),l=o(1),u=o(i),d=o(r),f=l+a;return{left:s,right:c,padLeft:u,contentWidth:f,padRight:d,spanWidth:u+f+d}}function q(e){return e.left+e.right+e.padLeft+e.padRight}function J(e){return{...e,markup:!0,highlight:!1}}function Y(e,t){return t.isNull?e:(e??f).add(t)}var X=class e{renderable;box;title;subtitle;bottomRightAccessory;expand;style;borderStyle;titleStyle;subtitleStyle;width;padding;constructor(e,t){this.renderable=m(e),this.box=t?.box??P,this.title=t?.title,this.subtitle=t?.subtitle,this.bottomRightAccessory=t?.bottomRightAccessory,this.expand=t?.expand!==!1,this.style=t?.style??f,this.borderStyle=t?.borderStyle??f,this.titleStyle=t?.titleStyle,this.subtitleStyle=t?.subtitleStyle,this.width=t?.width,this.padding=H(t?.padding??[0,1,0,1])}*render(e){let t=n(e,this),r=this.box.substitute(t),i=o(t,this.style),a=i.add(o(t,this.borderStyle)),s=a.isNull?void 0:a,c=i.isNull?void 0:i,l=K(this._getPanelWidth(t),this.padding),[u,,d]=this.padding,f=this._renderContent(t,l.contentWidth,c);yield*this._renderTopBorder(t,r,l,s);for(let e=0;e<u;e++)yield*this._renderRow(r,l,[],s,c);for(let e of f)yield*this._renderRow(r,l,e,s,c);for(let e=0;e<d;e++)yield*this._renderRow(r,l,[],s,c);yield*this._renderBottomBorder(t,r,l,s)}_renderContent(e,t,n){let[i,,a]=this.padding,o=h(e.height,2+i+a),s={...e,highlight:!1,maxWidth:t,height:o},c=r(l.splitLines([...l.applyStyle(this.renderable.render(s),n)]),o);return t===0?[]:c}*_renderRow(e,t,n,r,i){let a=e.getContentChars(`row`);yield new l(a.left.repeat(t.left),r);let o=l.adjustLineLength(n,t.contentWidth,i,!1),s=[new l(` `.repeat(t.padLeft),i),...o];yield*l.adjustLineLength(s,t.spanWidth,i),yield new l(a.right.repeat(t.right),r),yield l.line()}measure(e){let t=i(e),n=this._declaredWidth;if(n!==void 0){let e=Math.min(t.maxWidth,n);return{minimum:e,maximum:e}}return this._fitRange(t)}_fitRange(e){let t=K(e.maxWidth,this.padding),n=q(t),r=p.get({...e,maxWidth:t.contentWidth},this.renderable),i=Math.min(e.maxWidth,r.maximum+n);return{minimum:Math.min(r.minimum+n,i),maximum:i}}get _declaredWidth(){return this.width===void 0?void 0:t(this.width)}_getPanelWidth(e){let t=this._declaredWidth;return t===void 0?this.expand?e.maxWidth:this._fitRange(e).maximum:Math.min(t,e.maxWidth)}*_renderTopBorder(e,t,n,r){let i=n.spanWidth,a=Y(r,o(e,this.titleStyle??f)),s=u(this.title,J(e),a),c=l.getLineLength(s);if(c===0){yield new l(t.top.left.repeat(n.left),r),yield new l(t.top.horizontal.repeat(i),r),yield new l(t.top.right.repeat(n.right),r),yield l.line();return}if(yield new l(t.top.left.repeat(n.left),r),c>=i)yield*l.adjustLineLength(s,i,a);else{let e=Math.floor((i-c)/2),n=i-c-e;e>0&&(yield new l(t.top.horizontal.repeat(e),r)),yield*s,n>0&&(yield new l(t.top.horizontal.repeat(n),r))}yield new l(t.top.right.repeat(n.right),r),yield l.line()}*_renderBottomBorder(e,t,n,r){let i=n.spanWidth,p=this._resolveAccessory(this.bottomRightAccessory),m=p===void 0?``:typeof p==`string`?` ${p} `:` ${p.plain} `,h=s(m),g=Y(r,p instanceof c?p.resolvedStyle(e):f);yield new l(t.bottom.left.repeat(n.left),r);let _=Math.max(0,i-h),v=Y(r,o(e,this.subtitleStyle??f)),y=u(this.subtitle,J(e),v),b=l.getLineLength(y);if(b===0)_>0&&(yield new l(t.bottom.horizontal.repeat(_),r));else if(b>=_)yield*l.adjustLineLength(y,_,v);else{let e=Math.floor((_-b)/2),n=_-b-e;e>0&&(yield new l(t.bottom.horizontal.repeat(e),r)),yield*y,n>0&&(yield new l(t.bottom.horizontal.repeat(n),r))}if(h>0){let e=h>i?a(m,d(i)):m;yield new l(e,g)}yield new l(t.bottom.right.repeat(n.right),r),yield l.line()}_resolveAccessory(e){if(e!==void 0)return typeof e==`function`?e():e}static fit(t,n){return new e(t,{...n,expand:!1})}};export{T as C,M as S,k as _,S as a,A as b,x as c,F as d,I as f,D as g,B as h,H as i,R as l,N as m,G as n,C as o,L as p,U as r,w as s,X as t,z as u,O as v,E as w,j as x,P as y};