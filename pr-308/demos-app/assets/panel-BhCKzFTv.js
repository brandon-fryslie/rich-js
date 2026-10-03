import{B as e,F as t,Ft as n,U as r,V as i,Vt as a,X as o,Xt as s,Y as c,d as l,f as u,ot as d,r as f,tt as p,u as m,z as h,zt as g}from"./console-BL2Rjvm_.js";var _=8,v=4,y={"╭":`┌`,"╮":`┐`,"╰":`└`,"╯":`┘`},b=e=>({left:e[0],horizontal:e[1],cross:e[2],right:e[3]}),x=e=>({left:e[0],vertical:e[2],right:e[3]}),S=class e{top;bottom;grid;headContent;headSeparator;bodyContent;rowSeparator;footSeparator;footContent;constructor(e){let t=e.split(`
`);if(t.length!==_||t.some(e=>Array.from(e).length!==v)||t.some(e=>a(e)!==v))throw Error(`A box grid is ${_} lines of ${v} single-cell characters; got ${t.length} line(s) measuring `+t.map(e=>`${Array.from(e).length}/${a(e)}`).join(`, `)+` characters/cells`);let n=t.map(e=>Array.from(e));this.grid=e,this.top=b(n[0]),this.headContent=x(n[1]),this.headSeparator=b(n[2]),this.bodyContent=x(n[3]),this.rowSeparator=b(n[4]),this.footSeparator=b(n[5]),this.footContent=x(n[6]),this.bottom=b(n[7])}getTop(e,t,n=!0){return this.getEdge(e,this.top,t,n)}getRow(e,t,n,r=!0){return this.getEdge(e,this.getRowChars(t),n,r)}getContentChars(e){switch(e){case`head`:return this.headContent;case`row`:case`mid`:return this.bodyContent;case`foot`:return this.footContent}}getBottom(e,t,n=!0){return this.getEdge(e,this.bottom,t,n)}substitute(e={}){let t=h(e,this,C,e=>e.grid);return t===this&&e.safe===!0?this.safeSubstitute():t}safeSubstitute(){return new e(Array.from(this.grid,e=>y[e]??e).join(``))}plainHeaded(){return H.find(([e])=>e.grid===this.grid)?.[1]??this}getEdge(e,t,n,r){let i=e.map(e=>t.horizontal.repeat(e)).join(t.cross),a=r?t.left+i+t.right:i;return[new p(a,n),p.line()]}getRowChars(e){switch(e){case`head`:return this.headSeparator;case`row`:return this.rowSeparator;case`foot`:return this.footSeparator;case`mid`:return{left:this.bodyContent.left,horizontal:` `,cross:this.bodyContent.vertical,right:this.bodyContent.right}}}},C=new S(`+--+
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
    `),H=[[R,E],[D,E],[k,O],[A,O],[T,w]];function U(e){let t=e=>Number.isFinite(e)?g(e):0,n=typeof e==`number`?[e,e,e,e]:e.length===2?[e[0],e[1],e[0],e[1]]:e;return[t(n[0]),t(n[1]),t(n[2]),t(n[3])]}function W(e,t,n){let r=g(e),i=e=>{let t=Math.min(e,r);return r-=t,t},a=i(1),o=i(t),s=i(n);return{left:o,contentWidth:a+r,right:s}}function G(e){return e.left+e.contentWidth+e.right}var K=class{renderable;top;right;bottom;left;style;expand;constructor(e,t,n){let[r,i,a,o]=U(t);this.renderable=l(e),this.top=r,this.right=i,this.bottom=a,this.left=o,this.style=n?.style??d,this.expand=n?.expand!==!1}*render(t){let n=c(t,this),a=W(this.expand?n.maxWidth:f.get(n,this).maximum,this.left,this.right),o={...n,maxWidth:a.contentWidth,height:r(n.height,this.top+this.bottom)},s=i(n,this.style),l=s.isNull?void 0:s,u=[...p.applyStyle(this.renderable.render(o),l)],d=e(p.splitLines(u),o.height),m=new p(` `.repeat(a.left),l),h=new p(` `.repeat(a.right),l),g=new p(` `.repeat(G(a)),l);for(let e=0;e<this.top;e++)yield g,yield p.line();for(let e of d)yield m,yield*p.adjustLineLength(e,a.contentWidth,l),yield h,yield p.line();for(let e=0;e<this.bottom;e++)yield g,yield p.line()}measure(e){let t=o(e),n=W(t.maxWidth,this.left,this.right),r=n.left+n.right,i=f.get({...t,maxWidth:n.contentWidth},this.renderable),a=Math.min(t.maxWidth,i.maximum+r);return{minimum:Math.min(i.minimum+r,a),maximum:a}}};function q(e,t){let[,n,,r]=t,i=g(e),a=e=>{let t=Math.min(e,i);return i-=t,t},o=a(1),s=a(1),c=a(1),l=a(r),u=a(n),d=c+i;return{left:o,right:s,padLeft:l,contentWidth:d,padRight:u,spanWidth:l+d+u}}function J(e){return e.left+e.right+e.padLeft+e.padRight}function Y(e){return{...e,markup:!0,highlight:!1}}function X(e,t){return t.isNull?e:(e??d).add(t)}function Z(e,t,n,r,i,o,s,c){let l=t.left.repeat(n.left);if(i===void 0||r<=2)return[new p(l+t.horizontal.repeat(r)+c,s)];let u=r-2,d=Y(e),f=i.text(d);if(f.cellLength>u){let t=f.overflow===`ellipsis`?h(e,`…`,`.`):``,n=u-a(t);f.truncate(n,{marker:``}),f.padRight(n-f.cellLength),f.append(t)}let g=m(f,d,o),_=u-p.getLineLength(g),v=Math.floor(_/2);return[new p(l+t.horizontal,s),new p(t.horizontal.repeat(v),s),...g,new p(t.horizontal.repeat(_-v),s),new p(t.horizontal+c,s)]}var Q=class m{renderable;box;title;subtitle;bottomRightAccessory;expand;style;borderStyle;titleStyle;subtitleStyle;width;padding;_titleLabel;_subtitleLabel;constructor(e,t){this.renderable=l(e),this.box=t?.box??F,this.title=t?.title,this.subtitle=t?.subtitle,this._titleLabel=u(this.title),this._subtitleLabel=u(this.subtitle),this.bottomRightAccessory=t?.bottomRightAccessory,this.expand=t?.expand!==!1,this.style=t?.style??d,this.borderStyle=t?.borderStyle??d,this.titleStyle=t?.titleStyle,this.subtitleStyle=t?.subtitleStyle,this.width=t?.width,this.padding=U(t?.padding??[0,1,0,1])}*render(e){let t=c(e,this),n=this.box.substitute(t),r=i(t,this.style),a=r.add(i(t,this.borderStyle)),o=a.isNull?void 0:a,s=r.isNull?void 0:r,l=q(this._getPanelWidth(t),this.padding),[u,,d]=this.padding,f=this._renderContent(t,l.contentWidth,s);yield*this._renderTopBorder(t,n,l,o);for(let e=0;e<u;e++)yield*this._renderPaddingRow(n,l,o,s);for(let e of f)yield*this._renderRow(n,l,e,o,s);for(let e=0;e<d;e++)yield*this._renderPaddingRow(n,l,o,s);yield*this._renderBottomBorder(t,n,l,o)}_renderContent(t,n,i){let[a,,o]=this.padding,s=r(t.height,2+a+o),c={...t,highlight:!1,maxWidth:n,height:s},l=e(p.splitLines([...p.applyStyle(this.renderable.render(c),i)]),s);return n===0?[]:l}*_renderRow(e,t,n,r,i){let a=e.getContentChars(`row`);yield new p(a.left.repeat(t.left),r),yield new p(` `.repeat(t.padLeft),i),yield*p.adjustLineLength(n,t.contentWidth,i),yield new p(` `.repeat(t.padRight),i),yield new p(a.right.repeat(t.right),r),yield p.line()}*_renderPaddingRow(e,t,n,r){let i=e.getContentChars(`row`);yield new p(i.left.repeat(t.left),n),yield new p(` `.repeat(t.spanWidth),r),yield new p(i.right.repeat(t.right),n),yield p.line()}measure(e){let t=o(e),n=this._declaredWidth;if(n!==void 0){let e=Math.min(t.maxWidth,n);return{minimum:e,maximum:e}}let r=this._contentRange(t),i=J(q(t.maxWidth,this.padding)),a=Math.min(t.maxWidth,Math.max(r.maximum,this._labelWidth(t)+i));return{minimum:Math.min(r.minimum,a),maximum:a}}_contentRange(e){let t=q(e.maxWidth,this.padding),n=J(t),r=f.get({...e,maxWidth:t.contentWidth},this.renderable);return{minimum:r.minimum+n,maximum:Math.min(e.maxWidth,r.maximum+n)}}_labelWidth(e){return this._titleLabel?.text(Y(e)).cellLength??0}get _declaredWidth(){return this.width===void 0?void 0:g(this.width)}_getPanelWidth(e){let t=Math.min(e.maxWidth,this._declaredWidth??e.maxWidth),n=this.expand?t:this._contentRange({...e,maxWidth:t}).maximum,r=this._titleLabel===void 0?0:this._labelWidth(e)+4;return Math.min(e.maxWidth,Math.max(n,r))}*_renderTopBorder(e,t,n,r){let a=X(r,i(e,this.titleStyle??d));yield*Z(e,t.top,n,n.spanWidth,this._titleLabel,a,r,t.top.right.repeat(n.right)),yield p.line()}*_renderBottomBorder(e,r,o,c){let l=this._resolveAccessory(this.bottomRightAccessory),u=l===void 0?``:typeof l==`string`?` ${l} `:` ${l.plain} `,f=s(u,n(Math.min(a(u),o.spanWidth))),m=l instanceof t?l.resolvedStyle(e):d,h=X(c,i(e,this.subtitleStyle??d)),g=r.bottom.right.repeat(o.right),[_,v]=f===``?[g,``]:[``,g];yield*Z(e,r.bottom,o,o.spanWidth-a(f),this._subtitleLabel,h,c,_),yield new p(f,X(c,m)),yield new p(v,c),yield p.line()}_resolveAccessory(e){if(e!==void 0)return typeof e==`function`?e():e}static fit(e,t){return new m(e,{...t,expand:!1})}};export{E as C,N as S,A as _,C as a,j as b,S as c,I as d,L as f,O as g,V as h,U as i,z as l,P as m,K as n,w as o,R as p,W as r,T as s,Q as t,B as u,k as v,D as w,M as x,F as y};