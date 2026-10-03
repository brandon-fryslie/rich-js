import{F as e,Ht as t,I as n,L as r,M as i,Mt as a,Ot as o,P as s,Pt as c,U as l,W as u,Y as d,d as f,et as p,r as m,u as h}from"./console-gCrMQDhO.js";var g=8,_=4,v={"╭":`┌`,"╮":`┐`,"╰":`└`,"╯":`┘`},y=e=>({left:e[0],horizontal:e[1],cross:e[2],right:e[3]}),b=e=>({left:e[0],vertical:e[2],right:e[3]}),x=class e{top;bottom;grid;headContent;headSeparator;bodyContent;rowSeparator;footSeparator;footContent;constructor(e){let t=e.split(`
`);if(t.length!==g||t.some(e=>Array.from(e).length!==_)||t.some(e=>c(e)!==_))throw Error(`A box grid is ${g} lines of ${_} single-cell characters; got ${t.length} line(s) measuring `+t.map(e=>`${Array.from(e).length}/${c(e)}`).join(`, `)+` characters/cells`);let n=t.map(e=>Array.from(e));this.grid=e,this.top=y(n[0]),this.headContent=b(n[1]),this.headSeparator=y(n[2]),this.bodyContent=b(n[3]),this.rowSeparator=y(n[4]),this.footSeparator=y(n[5]),this.footContent=b(n[6]),this.bottom=y(n[7])}getTop(e,t,n=!0){return this.getEdge(e,this.top,t,n)}getRow(e,t,n,r=!0){return this.getEdge(e,this.getRowChars(t),n,r)}getContentChars(e){switch(e){case`head`:return this.headContent;case`row`:case`mid`:return this.bodyContent;case`foot`:return this.footContent}}getBottom(e,t,n=!0){return this.getEdge(e,this.bottom,t,n)}substitute(e={}){let t=s(e,this,S,e=>e.grid);return t===this&&e.safe===!0?this.safeSubstitute():t}safeSubstitute(){return new e(Array.from(this.grid,e=>v[e]??e).join(``))}plainHeaded(){return V.find(([e])=>e.grid===this.grid)?.[1]??this}getEdge(e,t,n,r){let i=e.map(e=>t.horizontal.repeat(e)).join(t.cross),a=r?t.left+i+t.right:i;return[new d(a,n),d.line()]}getRowChars(e){switch(e){case`head`:return this.headSeparator;case`row`:return this.rowSeparator;case`foot`:return this.footSeparator;case`mid`:return{left:this.bodyContent.left,horizontal:` `,cross:this.bodyContent.vertical,right:this.bodyContent.right}}}},S=new x(`+--+
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
    `),V=[[L,T],[E,T],[O,D],[k,D],[w,C]];function H(e){let t=e=>Number.isFinite(e)?a(e):0,n=typeof e==`number`?[e,e,e,e]:e.length===2?[e[0],e[1],e[0],e[1]]:e;return[t(n[0]),t(n[1]),t(n[2]),t(n[3])]}function U(e,t,n){let r=a(e),i=e=>{let t=Math.min(e,r);return r-=t,t},o=i(1),s=i(t),c=i(n);return{left:s,contentWidth:o+r,right:c}}function W(e){return e.left+e.contentWidth+e.right}var G=class{renderable;top;right;bottom;left;style;expand;constructor(e,t,n){let[r,i,a,o]=H(t);this.renderable=h(e),this.top=r,this.right=i,this.bottom=a,this.left=o,this.style=n?.style??p,this.expand=n?.expand!==!1}*render(t){let i=l(t,this),a=U(this.expand?i.maxWidth:m.get(i,this).maximum,this.left,this.right),o={...i,maxWidth:a.contentWidth,height:r(i.height,this.top+this.bottom)},s=n(i,this.style),c=s.isNull?void 0:s,u=[...d.applyStyle(this.renderable.render(o),c)],f=e(d.splitLines(u),o.height),p=new d(` `.repeat(a.left),c),h=new d(` `.repeat(a.right),c),g=new d(` `.repeat(W(a)),c);for(let e=0;e<this.top;e++)yield g,yield d.line();for(let e of f)yield p,yield*d.adjustLineLength(e,a.contentWidth,c),yield h,yield d.line();for(let e=0;e<this.bottom;e++)yield g,yield d.line()}measure(e){let t=u(e),n=U(t.maxWidth,this.left,this.right),r=n.left+n.right,i=m.get({...t,maxWidth:n.contentWidth},this.renderable),a=Math.min(t.maxWidth,i.maximum+r);return{minimum:Math.min(i.minimum+r,a),maximum:a}}};function K(e,t){let[,n,,r]=t,i=a(e),o=e=>{let t=Math.min(e,i);return i-=t,t},s=o(1),c=o(1),l=o(1),u=o(r),d=o(n),f=l+i;return{left:s,right:c,padLeft:u,contentWidth:f,padRight:d,spanWidth:u+f+d}}function q(e){return e.left+e.right+e.padLeft+e.padRight}function J(e){return{...e,markup:!0,highlighter:void 0}}function Y(e,t){return t.isNull?e:(e??p).add(t)}var X=class s{renderable;box;title;subtitle;bottomRightAccessory;expand;style;borderStyle;titleStyle;subtitleStyle;width;padding;constructor(e,t){this.renderable=h(e),this.box=t?.box??P,this.title=t?.title,this.subtitle=t?.subtitle,this.bottomRightAccessory=t?.bottomRightAccessory,this.expand=t?.expand!==!1,this.style=t?.style??p,this.borderStyle=t?.borderStyle??p,this.titleStyle=t?.titleStyle,this.subtitleStyle=t?.subtitleStyle,this.width=t?.width,this.padding=H(t?.padding??[0,1,0,1])}*render(e){let t=l(e,this),r=this.box.substitute(t),i=n(t,this.style),a=i.add(n(t,this.borderStyle)),o=a.isNull?void 0:a,s=i.isNull?void 0:i,c=K(this._getPanelWidth(t),this.padding),[u,,d]=this.padding,f=this._renderContent(t,c.contentWidth,s);yield*this._renderTopBorder(t,r,c,o);for(let e=0;e<u;e++)yield*this._renderRow(r,c,[],o,s);for(let e of f)yield*this._renderRow(r,c,e,o,s);for(let e=0;e<d;e++)yield*this._renderRow(r,c,[],o,s);yield*this._renderBottomBorder(t,r,c,o)}_renderContent(t,n,i){let[a,,o]=this.padding,s=r(t.height,2+a+o),c={...t,highlighter:void 0,maxWidth:n,height:s},l=e(d.splitLines([...d.applyStyle(this.renderable.render(c),i)]),s);return n===0?[]:l}*_renderRow(e,t,n,r,i){let a=e.getContentChars(`row`);yield new d(a.left.repeat(t.left),r);let o=d.adjustLineLength(n,t.contentWidth,i,!1),s=[new d(` `.repeat(t.padLeft),i),...o];yield*d.adjustLineLength(s,t.spanWidth,i),yield new d(a.right.repeat(t.right),r),yield d.line()}measure(e){let t=u(e),n=this._declaredWidth;if(n!==void 0){let e=Math.min(t.maxWidth,n);return{minimum:e,maximum:e}}return this._fitRange(t)}_fitRange(e){let t=K(e.maxWidth,this.padding),n=q(t),r=m.get({...e,maxWidth:t.contentWidth},this.renderable),i=Math.min(e.maxWidth,r.maximum+n);return{minimum:Math.min(r.minimum+n,i),maximum:i}}get _declaredWidth(){return this.width===void 0?void 0:a(this.width)}_getPanelWidth(e){let t=this._declaredWidth;return t===void 0?this.expand?e.maxWidth:this._fitRange(e).maximum:Math.min(t,e.maxWidth)}*_renderTopBorder(e,t,r,i){let a=r.spanWidth,o=Y(i,n(e,this.titleStyle??p)),s=f(this.title,J(e),o),c=d.getLineLength(s);if(c===0){yield new d(t.top.left.repeat(r.left),i),yield new d(t.top.horizontal.repeat(a),i),yield new d(t.top.right.repeat(r.right),i),yield d.line();return}if(yield new d(t.top.left.repeat(r.left),i),c>=a)yield*d.adjustLineLength(s,a,o);else{let e=Math.floor((a-c)/2),n=a-c-e;e>0&&(yield new d(t.top.horizontal.repeat(e),i)),yield*s,n>0&&(yield new d(t.top.horizontal.repeat(n),i))}yield new d(t.top.right.repeat(r.right),i),yield d.line()}*_renderBottomBorder(e,r,a,s){let l=a.spanWidth,u=this._resolveAccessory(this.bottomRightAccessory),m=u===void 0?``:typeof u==`string`?` ${u} `:` ${u.plain} `,h=c(m),g=Y(s,u instanceof i?u.resolvedStyle(e):p);yield new d(r.bottom.left.repeat(a.left),s);let _=Math.max(0,l-h),v=Y(s,n(e,this.subtitleStyle??p)),y=f(this.subtitle,J(e),v),b=d.getLineLength(y);if(b===0)_>0&&(yield new d(r.bottom.horizontal.repeat(_),s));else if(b>=_)yield*d.adjustLineLength(y,_,v);else{let e=Math.floor((_-b)/2),t=_-b-e;e>0&&(yield new d(r.bottom.horizontal.repeat(e),s)),yield*y,t>0&&(yield new d(r.bottom.horizontal.repeat(t),s))}if(h>0){let e=h>l?t(m,o(l)):m;yield new d(e,g)}yield new d(r.bottom.right.repeat(a.right),s),yield d.line()}_resolveAccessory(e){if(e!==void 0)return typeof e==`function`?e():e}static fit(e,t){return new s(e,{...t,expand:!1})}};export{T as C,M as S,k as _,S as a,A as b,x as c,F as d,I as f,D as g,B as h,H as i,R as l,N as m,G as n,C as o,L as p,U as r,w as s,X as t,z as u,O as v,E as w,j as x,P as y};