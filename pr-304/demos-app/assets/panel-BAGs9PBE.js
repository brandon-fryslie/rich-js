import{$ as e,J as t,Jt as n,L as r,Lt as i,Nt as a,P as o,R as s,V as c,d as l,it as u,q as d,r as f,u as p,z as m,zt as h}from"./console-CIueGTrq.js";var g=8,_=4,v={"╭":`┌`,"╮":`┐`,"╰":`└`,"╯":`┘`},y=e=>({left:e[0],horizontal:e[1],cross:e[2],right:e[3]}),b=e=>({left:e[0],vertical:e[2],right:e[3]}),x=class t{top;bottom;grid;headContent;headSeparator;bodyContent;rowSeparator;footSeparator;footContent;constructor(e){let t=e.split(`
`);if(t.length!==g||t.some(e=>Array.from(e).length!==_)||t.some(e=>h(e)!==_))throw Error(`A box grid is ${g} lines of ${_} single-cell characters; got ${t.length} line(s) measuring `+t.map(e=>`${Array.from(e).length}/${h(e)}`).join(`, `)+` characters/cells`);let n=t.map(e=>Array.from(e));this.grid=e,this.top=y(n[0]),this.headContent=b(n[1]),this.headSeparator=y(n[2]),this.bodyContent=b(n[3]),this.rowSeparator=y(n[4]),this.footSeparator=y(n[5]),this.footContent=b(n[6]),this.bottom=y(n[7])}getTop(e,t,n=!0){return this.getEdge(e,this.top,t,n)}getRow(e,t,n,r=!0){return this.getEdge(e,this.getRowChars(t),n,r)}getContentChars(e){switch(e){case`head`:return this.headContent;case`row`:case`mid`:return this.bodyContent;case`foot`:return this.footContent}}getBottom(e,t,n=!0){return this.getEdge(e,this.bottom,t,n)}substitute(e={}){let t=r(e,this,S,e=>e.grid);return t===this&&e.safe===!0?this.safeSubstitute():t}safeSubstitute(){return new t(Array.from(this.grid,e=>v[e]??e).join(``))}plainHeaded(){return V.find(([e])=>e.grid===this.grid)?.[1]??this}getEdge(t,n,r,i){let a=t.map(e=>n.horizontal.repeat(e)).join(n.cross),o=i?n.left+a+n.right:a;return[new e(o,r),e.line()]}getRowChars(e){switch(e){case`head`:return this.headSeparator;case`row`:return this.rowSeparator;case`foot`:return this.footSeparator;case`mid`:return{left:this.bodyContent.left,horizontal:` `,cross:this.bodyContent.vertical,right:this.bodyContent.right}}}},S=new x(`+--+
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
    `),V=[[L,T],[E,T],[O,D],[k,D],[w,C]];function H(e){let t=e=>Number.isFinite(e)?i(e):0,n=typeof e==`number`?[e,e,e,e]:e.length===2?[e[0],e[1],e[0],e[1]]:e;return[t(n[0]),t(n[1]),t(n[2]),t(n[3])]}function U(e,t,n){let r=i(e),a=e=>{let t=Math.min(e,r);return r-=t,t},o=a(1),s=a(t),c=a(n);return{left:s,contentWidth:o+r,right:c}}function W(e){return e.left+e.contentWidth+e.right}var G=class{renderable;top;right;bottom;left;style;expand;constructor(e,t,n){let[r,i,a,o]=H(t);this.renderable=p(e),this.top=r,this.right=i,this.bottom=a,this.left=o,this.style=n?.style??u,this.expand=n?.expand!==!1}*render(t){let n=d(t,this),r=U(this.expand?n.maxWidth:f.get(n,this).maximum,this.left,this.right),i={...n,maxWidth:r.contentWidth,height:c(n.height,this.top+this.bottom)},a=m(n,this.style),o=a.isNull?void 0:a,l=[...e.applyStyle(this.renderable.render(i),o)],u=s(e.splitLines(l),i.height),p=new e(` `.repeat(r.left),o),h=new e(` `.repeat(r.right),o),g=new e(` `.repeat(W(r)),o);for(let t=0;t<this.top;t++)yield g,yield e.line();for(let t of u)yield p,yield*e.adjustLineLength(t,r.contentWidth,o),yield h,yield e.line();for(let t=0;t<this.bottom;t++)yield g,yield e.line()}measure(e){let n=t(e),r=U(n.maxWidth,this.left,this.right),i=r.left+r.right,a=f.get({...n,maxWidth:r.contentWidth},this.renderable),o=Math.min(n.maxWidth,a.maximum+i);return{minimum:Math.min(a.minimum+i,o),maximum:o}}};function K(e,t){let[,n,,r]=t,a=i(e),o=e=>{let t=Math.min(e,a);return a-=t,t},s=o(1),c=o(1),l=o(1),u=o(r),d=o(n),f=l+a;return{left:s,right:c,padLeft:u,contentWidth:f,padRight:d,spanWidth:u+f+d}}function q(e){return e.left+e.right+e.padLeft+e.padRight}function J(e){return{...e,markup:!0,highlight:!1}}function Y(e,t){return t.isNull?e:(e??u).add(t)}function X(t,n,r,i,a,o,s,c){let l=n.left.repeat(r.left);if(a===void 0||i<=2)return[new e(l+n.horizontal.repeat(i)+c,s)];let u=i-2,d=J(t),f=a.text(d);f.truncate(u,f.overflow===`ellipsis`?void 0:{marker:``}),f.overflow=`ignore`;let p=[...e.applyStyle(f.render(d),o)],m=u-e.getLineLength(p),h=Math.floor(m/2);return[new e(l+n.horizontal,s),new e(n.horizontal.repeat(h),s),...p,new e(n.horizontal.repeat(m-h),s),new e(n.horizontal+c,s)]}var Z=class r{renderable;box;title;subtitle;bottomRightAccessory;expand;style;borderStyle;titleStyle;subtitleStyle;width;padding;_titleLabel;_subtitleLabel;constructor(e,t){this.renderable=p(e),this.box=t?.box??P,this.title=t?.title,this.subtitle=t?.subtitle,this._titleLabel=l(this.title),this._subtitleLabel=l(this.subtitle),this.bottomRightAccessory=t?.bottomRightAccessory,this.expand=t?.expand!==!1,this.style=t?.style??u,this.borderStyle=t?.borderStyle??u,this.titleStyle=t?.titleStyle,this.subtitleStyle=t?.subtitleStyle,this.width=t?.width,this.padding=H(t?.padding??[0,1,0,1])}*render(e){let t=d(e,this),n=this.box.substitute(t),r=m(t,this.style),i=r.add(m(t,this.borderStyle)),a=i.isNull?void 0:i,o=r.isNull?void 0:r,s=K(this._getPanelWidth(t),this.padding),[c,,l]=this.padding,u=this._renderContent(t,s.contentWidth,o);yield*this._renderTopBorder(t,n,s,a);for(let e=0;e<c;e++)yield*this._renderPaddingRow(n,s,a,o);for(let e of u)yield*this._renderRow(n,s,e,a,o);for(let e=0;e<l;e++)yield*this._renderPaddingRow(n,s,a,o);yield*this._renderBottomBorder(t,n,s,a)}_renderContent(t,n,r){let[i,,a]=this.padding,o=c(t.height,2+i+a),l={...t,highlight:!1,maxWidth:n,height:o},u=s(e.splitLines([...e.applyStyle(this.renderable.render(l),r)]),o);return n===0?[]:u}*_renderRow(t,n,r,i,a){let o=t.getContentChars(`row`);yield new e(o.left.repeat(n.left),i),yield new e(` `.repeat(n.padLeft),a),yield*e.adjustLineLength(r,n.contentWidth,a),yield new e(` `.repeat(n.padRight),a),yield new e(o.right.repeat(n.right),i),yield e.line()}*_renderPaddingRow(t,n,r,i){let a=t.getContentChars(`row`);yield new e(a.left.repeat(n.left),r),yield new e(` `.repeat(n.spanWidth),i),yield new e(a.right.repeat(n.right),r),yield e.line()}measure(e){let n=t(e);if(this._declaredWidth!==void 0){let e=this._getPanelWidth(n);return{minimum:e,maximum:e}}return this._fitRange(n)}_fitRange(e){let t=this._contentRange(e),n=this._titled(e,t.maximum);return{minimum:Math.min(t.minimum,n),maximum:n}}_contentRange(e){let t=K(e.maxWidth,this.padding),n=q(t),r=f.get({...e,maxWidth:t.contentWidth},this.renderable);return{minimum:r.minimum+n,maximum:Math.min(e.maxWidth,r.maximum+n)}}_titled(e,t){let n=this._titleLabel?.text(J(e)),r=n===void 0?0:n.cellLength+4;return Math.min(e.maxWidth,Math.max(t,r))}get _declaredWidth(){return this.width===void 0?void 0:i(this.width)}_getPanelWidth(e){let t=Math.min(e.maxWidth,this._declaredWidth??e.maxWidth),n=this.expand?t:this._contentRange({...e,maxWidth:t}).maximum;return this._titled(e,n)}*_renderTopBorder(t,n,r,i){let a=Y(i,m(t,this.titleStyle??u));yield*X(t,n.top,r,r.spanWidth,this._titleLabel,a,i,n.top.right.repeat(r.right)),yield e.line()}*_renderBottomBorder(t,r,i,s){let c=this._resolveAccessory(this.bottomRightAccessory),l=c===void 0?``:typeof c==`string`?` ${c} `:` ${c.plain} `,d=n(l,a(Math.min(h(l),i.spanWidth))),f=c instanceof o?c.resolvedStyle(t):u,p=Y(s,m(t,this.subtitleStyle??u)),g=r.bottom.right.repeat(i.right),[_,v]=d===``?[g,``]:[``,g];yield*X(t,r.bottom,i,i.spanWidth-h(d),this._subtitleLabel,p,s,_),yield new e(d,Y(s,f)),yield new e(v,s),yield e.line()}_resolveAccessory(e){if(e!==void 0)return typeof e==`function`?e():e}static fit(e,t){return new r(e,{...t,expand:!1})}};export{T as C,M as S,k as _,S as a,A as b,x as c,F as d,I as f,D as g,B as h,H as i,R as l,N as m,G as n,C as o,L as p,U as r,w as s,Z as t,z as u,O as v,E as w,j as x,P as y};