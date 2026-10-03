import{B as e,F as t,Ft as n,H as r,J as i,R as a,Vt as o,Xt as s,Y as c,at as l,d as u,et as d,f,r as p,u as m,z as h,zt as g}from"./console-CDwmeVZ6.js";var _=8,v=4,y={"╭":`┌`,"╮":`┐`,"╰":`└`,"╯":`┘`},b=e=>({left:e[0],horizontal:e[1],cross:e[2],right:e[3]}),x=e=>({left:e[0],vertical:e[2],right:e[3]}),S=class e{top;bottom;grid;headContent;headSeparator;bodyContent;rowSeparator;footSeparator;footContent;constructor(e){let t=e.split(`
`);if(t.length!==_||t.some(e=>Array.from(e).length!==v)||t.some(e=>o(e)!==v))throw Error(`A box grid is ${_} lines of ${v} single-cell characters; got ${t.length} line(s) measuring `+t.map(e=>`${Array.from(e).length}/${o(e)}`).join(`, `)+` characters/cells`);let n=t.map(e=>Array.from(e));this.grid=e,this.top=b(n[0]),this.headContent=x(n[1]),this.headSeparator=b(n[2]),this.bodyContent=x(n[3]),this.rowSeparator=b(n[4]),this.footSeparator=b(n[5]),this.footContent=x(n[6]),this.bottom=b(n[7])}getTop(e,t,n=!0){return this.getEdge(e,this.top,t,n)}getRow(e,t,n,r=!0){return this.getEdge(e,this.getRowChars(t),n,r)}getContentChars(e){switch(e){case`head`:return this.headContent;case`row`:case`mid`:return this.bodyContent;case`foot`:return this.footContent}}getBottom(e,t,n=!0){return this.getEdge(e,this.bottom,t,n)}substitute(e={}){let t=a(e,this,C,e=>e.grid);return t===this&&e.safe===!0?this.safeSubstitute():t}safeSubstitute(){return new e(Array.from(this.grid,e=>y[e]??e).join(``))}plainHeaded(){return H.find(([e])=>e.grid===this.grid)?.[1]??this}getEdge(e,t,n,r){let i=e.map(e=>t.horizontal.repeat(e)).join(t.cross),a=r?t.left+i+t.right:i;return[new d(a,n),d.line()]}getRowChars(e){switch(e){case`head`:return this.headSeparator;case`row`:return this.rowSeparator;case`foot`:return this.footSeparator;case`mid`:return{left:this.bodyContent.left,horizontal:` `,cross:this.bodyContent.vertical,right:this.bodyContent.right}}}},C=new S(`+--+
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
    `),H=[[R,E],[D,E],[k,O],[A,O],[T,w]];function U(e){let t=e=>Number.isFinite(e)?g(e):0,n=typeof e==`number`?[e,e,e,e]:e.length===2?[e[0],e[1],e[0],e[1]]:e;return[t(n[0]),t(n[1]),t(n[2]),t(n[3])]}function W(e,t,n){let r=g(e),i=e=>{let t=Math.min(e,r);return r-=t,t},a=i(1),o=i(t),s=i(n);return{left:o,contentWidth:a+r,right:s}}function G(e){return e.left+e.contentWidth+e.right}var K=class{renderable;top;right;bottom;left;style;expand;constructor(e,t,n){let[r,i,a,o]=U(t);this.renderable=u(e),this.top=r,this.right=i,this.bottom=a,this.left=o,this.style=n?.style??l,this.expand=n?.expand!==!1}*render(t){let n=i(t,this),a=W(this.expand?n.maxWidth:p.get(n,this).maximum,this.left,this.right),o={...n,maxWidth:a.contentWidth,height:r(n.height,this.top+this.bottom)},s=e(n,this.style),c=s.isNull?void 0:s,l=[...d.applyStyle(this.renderable.render(o),c)],u=h(d.splitLines(l),o.height),f=new d(` `.repeat(a.left),c),m=new d(` `.repeat(a.right),c),g=new d(` `.repeat(G(a)),c);for(let e=0;e<this.top;e++)yield g,yield d.line();for(let e of u)yield f,yield*d.adjustLineLength(e,a.contentWidth,c),yield m,yield d.line();for(let e=0;e<this.bottom;e++)yield g,yield d.line()}measure(e){let t=c(e),n=W(t.maxWidth,this.left,this.right),r=n.left+n.right,i=p.get({...t,maxWidth:n.contentWidth},this.renderable),a=Math.min(t.maxWidth,i.maximum+r);return{minimum:Math.min(i.minimum+r,a),maximum:a}}};function q(e,t){let[,n,,r]=t,i=g(e),a=e=>{let t=Math.min(e,i);return i-=t,t},o=a(1),s=a(1),c=a(1),l=a(r),u=a(n),d=c+i;return{left:o,right:s,padLeft:l,contentWidth:d,padRight:u,spanWidth:l+d+u}}function J(e){return e.left+e.right+e.padLeft+e.padRight}function Y(e){return{...e,markup:!0,highlight:!1}}function X(e,t){return t.isNull?e:(e??l).add(t)}function Z(e,t,n,r,i,s,c,l){let u=t.left.repeat(n.left);if(i===void 0||r<=2)return[new d(u+t.horizontal.repeat(r)+l,c)];let f=r-2,p=Y(e),h=i.text(p);if(h.cellLength>f){let t=h.overflow===`ellipsis`?a(e,`…`,`.`):``,n=f-o(t);h.truncate(n,{marker:``}),h.padRight(n-h.cellLength),h.append(t)}let g=m(h,p,s),_=f-d.getLineLength(g),v=Math.floor(_/2);return[new d(u+t.horizontal,c),new d(t.horizontal.repeat(v),c),...g,new d(t.horizontal.repeat(_-v),c),new d(t.horizontal+l,c)]}var Q=class a{renderable;box;title;subtitle;bottomRightAccessory;expand;style;borderStyle;titleStyle;subtitleStyle;width;padding;_titleLabel;_subtitleLabel;constructor(e,t){this.renderable=u(e),this.box=t?.box??F,this.title=t?.title,this.subtitle=t?.subtitle,this._titleLabel=f(this.title),this._subtitleLabel=f(this.subtitle),this.bottomRightAccessory=t?.bottomRightAccessory,this.expand=t?.expand!==!1,this.style=t?.style??l,this.borderStyle=t?.borderStyle??l,this.titleStyle=t?.titleStyle,this.subtitleStyle=t?.subtitleStyle,this.width=t?.width,this.padding=U(t?.padding??[0,1,0,1])}*render(t){let n=i(t,this),r=this.box.substitute(n),a=e(n,this.style),o=a.add(e(n,this.borderStyle)),s=o.isNull?void 0:o,c=a.isNull?void 0:a,l=q(this._getPanelWidth(n),this.padding),[u,,d]=this.padding,f=this._renderContent(n,l.contentWidth,c);yield*this._renderTopBorder(n,r,l,s);for(let e=0;e<u;e++)yield*this._renderPaddingRow(r,l,s,c);for(let e of f)yield*this._renderRow(r,l,e,s,c);for(let e=0;e<d;e++)yield*this._renderPaddingRow(r,l,s,c);yield*this._renderBottomBorder(n,r,l,s)}_renderContent(e,t,n){let[i,,a]=this.padding,o=r(e.height,2+i+a),s={...e,highlight:!1,maxWidth:t,height:o},c=h(d.splitLines([...d.applyStyle(this.renderable.render(s),n)]),o);return t===0?[]:c}*_renderRow(e,t,n,r,i){let a=e.getContentChars(`row`);yield new d(a.left.repeat(t.left),r),yield new d(` `.repeat(t.padLeft),i),yield*d.adjustLineLength(n,t.contentWidth,i),yield new d(` `.repeat(t.padRight),i),yield new d(a.right.repeat(t.right),r),yield d.line()}*_renderPaddingRow(e,t,n,r){let i=e.getContentChars(`row`);yield new d(i.left.repeat(t.left),n),yield new d(` `.repeat(t.spanWidth),r),yield new d(i.right.repeat(t.right),n),yield d.line()}measure(e){let t=c(e),n=this._declaredWidth;if(n!==void 0){let e=Math.min(t.maxWidth,n);return{minimum:e,maximum:e}}let r=this._contentRange(t),i=J(q(t.maxWidth,this.padding)),a=Math.min(t.maxWidth,Math.max(r.maximum,this._labelWidth(t)+i));return{minimum:Math.min(r.minimum,a),maximum:a}}_contentRange(e){let t=q(e.maxWidth,this.padding),n=J(t),r=p.get({...e,maxWidth:t.contentWidth},this.renderable);return{minimum:r.minimum+n,maximum:Math.min(e.maxWidth,r.maximum+n)}}_labelWidth(e){return this._titleLabel?.text(Y(e)).cellLength??0}get _declaredWidth(){return this.width===void 0?void 0:g(this.width)}_getPanelWidth(e){let t=Math.min(e.maxWidth,this._declaredWidth??e.maxWidth),n=this.expand?t:this._contentRange({...e,maxWidth:t}).maximum,r=this._titleLabel===void 0?0:this._labelWidth(e)+4;return Math.min(e.maxWidth,Math.max(n,r))}*_renderTopBorder(t,n,r,i){let a=X(i,e(t,this.titleStyle??l));yield*Z(t,n.top,r,r.spanWidth,this._titleLabel,a,i,n.top.right.repeat(r.right)),yield d.line()}*_renderBottomBorder(r,i,a,c){let u=this._resolveAccessory(this.bottomRightAccessory),f=u===void 0?``:typeof u==`string`?` ${u} `:` ${u.plain} `,p=s(f,n(Math.min(o(f),a.spanWidth))),m=u instanceof t?u.resolvedStyle(r):l,h=X(c,e(r,this.subtitleStyle??l)),g=i.bottom.right.repeat(a.right),[_,v]=p===``?[g,``]:[``,g];yield*Z(r,i.bottom,a,a.spanWidth-o(p),this._subtitleLabel,h,c,_),yield new d(p,X(c,m)),yield new d(v,c),yield d.line()}_resolveAccessory(e){if(e!==void 0)return typeof e==`function`?e():e}static fit(e,t){return new a(e,{...t,expand:!1})}};export{E as C,N as S,A as _,C as a,j as b,S as c,I as d,L as f,O as g,V as h,U as i,z as l,P as m,K as n,w as o,R as p,W as r,T as s,Q as t,B as u,k as v,D as w,M as x,F as y};