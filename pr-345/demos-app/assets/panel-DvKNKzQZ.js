import{B as e,I as t,Lt as n,Qt as r,U as i,Ut as a,V as o,Vt as s,X as c,Y as l,d as u,f as d,ot as f,p,r as m,tt as h,u as g,z as _}from"./console-Crgkzg9R.js";var v=8,y=4,b={"╭":`┌`,"╮":`┐`,"╰":`└`,"╯":`┘`},x=e=>({left:e[0],horizontal:e[1],cross:e[2],right:e[3]}),S=e=>({left:e[0],vertical:e[2],right:e[3]}),C=class e{top;bottom;grid;headContent;headSeparator;bodyContent;rowSeparator;footSeparator;footContent;constructor(e){let t=e.split(`
`);if(t.length!==v||t.some(e=>Array.from(e).length!==y)||t.some(e=>a(e)!==y))throw Error(`A box grid is ${v} lines of ${y} single-cell characters; got ${t.length} line(s) measuring `+t.map(e=>`${Array.from(e).length}/${a(e)}`).join(`, `)+` characters/cells`);let n=t.map(e=>Array.from(e));this.grid=e,this.top=x(n[0]),this.headContent=S(n[1]),this.headSeparator=x(n[2]),this.bodyContent=S(n[3]),this.rowSeparator=x(n[4]),this.footSeparator=x(n[5]),this.footContent=S(n[6]),this.bottom=x(n[7])}getTop(e,t,n=!0){return this.getEdge(e,this.top,t,n)}getRow(e,t,n,r=!0){return this.getEdge(e,this.getRowChars(t),n,r)}getContentChars(e){switch(e){case`head`:return this.headContent;case`row`:case`mid`:return this.bodyContent;case`foot`:return this.footContent}}getBottom(e,t,n=!0){return this.getEdge(e,this.bottom,t,n)}substitute(e={}){let t=_(e,this,w,e=>e.grid);return t===this&&e.safe===!0?this.safeSubstitute():t}safeSubstitute(){return new e(Array.from(this.grid,e=>b[e]??e).join(``))}plainHeaded(){return U.find(([e])=>e.grid===this.grid)?.[1]??this}getEdge(e,t,n,r){let i=e.map(e=>t.horizontal.repeat(e)).join(t.cross),a=r?t.left+i+t.right:i;return[new h(a,n),h.line()]}getRowChars(e){switch(e){case`head`:return this.headSeparator;case`row`:return this.rowSeparator;case`foot`:return this.footSeparator;case`mid`:return{left:this.bodyContent.left,horizontal:` `,cross:this.bodyContent.vertical,right:this.bodyContent.right}}}},w=new C(`+--+
| ||
|-+|
| ||
|-+|
|-+|
| ||
+--+`),T=new C(`+-++
| ||
+-++
| ||
+-++
+-++
| ||
+-++`),E=new C(`+-++
| ||
+=++
| ||
+-++
+-++
| ||
+-++`),D=new C(`┌─┬┐
│ ││
├─┼┤
│ ││
├─┼┤
├─┼┤
│ ││
└─┴┘`),O=new C(`┌─┬┐
│ ││
╞═╪╡
│ ││
├─┼┤
├─┼┤
│ ││
└─┴┘`),k=new C(`  ╷ 
  │ 
╶─┼╴
  │ 
╶─┼╴
╶─┼╴
  │ 
  ╵ `),A=new C(`  ╷ 
  │ 
╺━┿╸
  │ 
╶─┼╴
╶─┼╴
  │ 
  ╵ `),j=new C(`  ╷ 
  │ 
 ═╪ 
  │ 
 ─┼ 
 ─┼ 
  │ 
  ╵ `),M=new C(`    
    
 ── 
    
    
 ── 
    
    `),N=new C(`    
    
 ── 
    
    
    
    
    `),P=new C(`    
    
 ━━ 
    
    
 ━━ 
    
    `),F=new C(` ── 
    
 ── 
    
 ── 
 ── 
    
 ── `),I=new C(`╭─┬╮
│ ││
├─┼┤
│ ││
├─┼┤
├─┼┤
│ ││
╰─┴╯`),L=new C(`┏━┳┓
┃ ┃┃
┣━╋┫
┃ ┃┃
┣━╋┫
┣━╋┫
┃ ┃┃
┗━┻┛`),R=new C(`┏━┯┓
┃ │┃
┠─┼┨
┃ │┃
┠─┼┨
┠─┼┨
┃ │┃
┗━┷┛`),z=new C(`┏━┳┓
┃ ┃┃
┡━╇┩
│ ││
├─┼┤
├─┼┤
│ ││
└─┴┘`),B=new C(`╔═╦╗
║ ║║
╠═╬╣
║ ║║
╠═╬╣
╠═╬╣
║ ║║
╚═╩╝`),V=new C(`╔═╤╗
║ │║
╟─┼╢
║ │║
╟─┼╢
╟─┼╢
║ │║
╚═╧╝`),H=new C(`    
| ||
|-||
| ||
|-||
|-||
| ||
    `),U=[[z,D],[O,D],[A,k],[j,k],[E,T]];function W(e){let t=e=>Number.isFinite(e)?s(e):0,n=typeof e==`number`?[e,e,e,e]:e.length===2?[e[0],e[1],e[0],e[1]]:e;return[t(n[0]),t(n[1]),t(n[2]),t(n[3])]}function G(e,t,n){let r=s(e),i=e=>{let t=Math.min(e,r);return r-=t,t},a=i(1),o=i(t),c=i(n);return{left:o,contentWidth:a+r,right:c}}function K(e){return e.left+e.contentWidth+e.right}var q=class{renderable;top;right;bottom;left;style;expand;constructor(e,t,n){let[r,i,a,o]=W(t);this.renderable=d(e),this.top=r,this.right=i,this.bottom=a,this.left=o,this.style=n?.style??f,this.expand=n?.expand!==!1}*render(t){let n=l(t,this),r=G(this.expand?n.maxWidth:m.get(n,this).maximum,this.left,this.right),a={...n,maxWidth:r.contentWidth,height:i(n.height,this.top+this.bottom)},s=o(n,this.style),c=s.isNull?void 0:s,u=[...h.applyStyle(this.renderable.render(a),c)],d=e(h.splitLines(u),a.height),f=new h(` `.repeat(r.left),c),p=new h(` `.repeat(r.right),c),g=new h(` `.repeat(K(r)),c);for(let e=0;e<this.top;e++)yield g,yield h.line();for(let e of d)yield f,yield*h.adjustLineLength(e,r.contentWidth,c),yield p,yield h.line();for(let e=0;e<this.bottom;e++)yield g,yield h.line()}measure(e){let t=c(e),n=G(t.maxWidth,this.left,this.right),r=n.left+n.right,i=m.get({...t,maxWidth:n.contentWidth},this.renderable),a=Math.min(t.maxWidth,i.maximum+r);return{minimum:Math.min(i.minimum+r,a),maximum:a}}};function J(e,t){let[,n,,r]=t,i=s(e),a=e=>{let t=Math.min(e,i);return i-=t,t},o=a(1),c=a(1),l=a(1),u=a(r),d=a(n),f=l+i;return{left:o,right:c,padLeft:u,contentWidth:f,padRight:d,spanWidth:u+f+d}}function Y(e){return e.left+e.right+e.padLeft+e.padRight}function X(e){return{...e,markup:!0,highlight:!1}}function Z(e,t){return e.text(X(t)).pad(1)}function Q(e,t){return t.isNull?e:(e??f).add(t)}function $(e,t,n,r,i,a,o,s){let c=t.left.repeat(n.left);if(i===void 0||r<=2)return[new h(c+t.horizontal.repeat(r)+s,o)];let l=r-2,d=Z(i,e);g(d,l,d.overflow===`ellipsis`?_(e,`…`,`.`):``);let f=u(d,X(e),a),p=l-h.getLineLength(f),m=Math.floor(p/2);return[new h(c+t.horizontal,o),new h(t.horizontal.repeat(m),o),...f,new h(t.horizontal.repeat(p-m),o),new h(t.horizontal+s,o)]}var ee=class u{renderable;box;title;subtitle;bottomRightAccessory;expand;style;borderStyle;titleStyle;subtitleStyle;width;padding;_titleLabel;_subtitleLabel;constructor(e,t){this.renderable=d(e),this.box=t?.box??I,this.title=t?.title,this.subtitle=t?.subtitle,this._titleLabel=p(this.title),this._subtitleLabel=p(this.subtitle),this.bottomRightAccessory=t?.bottomRightAccessory,this.expand=t?.expand!==!1,this.style=t?.style??f,this.borderStyle=t?.borderStyle??f,this.titleStyle=t?.titleStyle,this.subtitleStyle=t?.subtitleStyle,this.width=t?.width,this.padding=W(t?.padding??[0,1,0,1])}*render(e){let t=l(e,this),n=this.box.substitute(t),r=o(t,this.style),i=r.add(o(t,this.borderStyle)),a=i.isNull?void 0:i,s=r.isNull?void 0:r,c=J(this._getPanelWidth(t),this.padding),[u,,d]=this.padding,f=this._renderContent(t,c.contentWidth,s);yield*this._renderTopBorder(t,n,c,a);for(let e=0;e<u;e++)yield*this._renderPaddingRow(n,c,a,s);for(let e of f)yield*this._renderRow(n,c,e,a,s);for(let e=0;e<d;e++)yield*this._renderPaddingRow(n,c,a,s);yield*this._renderBottomBorder(t,n,c,a)}_renderContent(t,n,r){let[a,,o]=this.padding,s=i(t.height,2+a+o),c={...t,highlight:!1,maxWidth:n,height:s},l=e(h.splitLines([...h.applyStyle(this.renderable.render(c),r)]),s);return n===0?[]:l}*_renderRow(e,t,n,r,i){let a=e.getContentChars(`row`);yield new h(a.left.repeat(t.left),r),yield new h(` `.repeat(t.padLeft),i),yield*h.adjustLineLength(n,t.contentWidth,i),yield new h(` `.repeat(t.padRight),i),yield new h(a.right.repeat(t.right),r),yield h.line()}*_renderPaddingRow(e,t,n,r){let i=e.getContentChars(`row`);yield new h(i.left.repeat(t.left),n),yield new h(` `.repeat(t.spanWidth),r),yield new h(i.right.repeat(t.right),n),yield h.line()}measure(e){let t=c(e),n=this._declaredWidth;if(n!==void 0){let e=Math.min(t.maxWidth,n);return{minimum:e,maximum:e}}let r=this._contentRange(t),i=Y(J(t.maxWidth,this.padding)),a=Math.min(t.maxWidth,Math.max(r.maximum,this._labelWidth(t)+i));return{minimum:Math.min(r.minimum,a),maximum:a}}_contentRange(e){let t=J(e.maxWidth,this.padding),n=Y(t),r=m.get({...e,maxWidth:t.contentWidth},this.renderable);return{minimum:r.minimum+n,maximum:Math.min(e.maxWidth,r.maximum+n)}}_labelWidth(e){return this._titleLabel===void 0?0:Z(this._titleLabel,e).cellLength}get _declaredWidth(){return this.width===void 0?void 0:s(this.width)}_getPanelWidth(e){let t=Math.min(e.maxWidth,this._declaredWidth??e.maxWidth),n=this.expand?t:this._contentRange({...e,maxWidth:t}).maximum,r=this._titleLabel===void 0?0:this._labelWidth(e)+4;return Math.min(e.maxWidth,Math.max(n,r))}*_renderTopBorder(e,t,n,r){let i=Q(r,o(e,this.titleStyle??f));yield*$(e,t.top,n,n.spanWidth,this._titleLabel,i,r,t.top.right.repeat(n.right)),yield h.line()}*_renderBottomBorder(e,i,s,c){let l=this._resolveAccessory(this.bottomRightAccessory),u=l===void 0?``:typeof l==`string`?` ${l} `:` ${l.plain} `,d=r(u,n(Math.min(a(u),s.spanWidth))),p=l instanceof t?l.resolvedStyle(e):f,m=Q(c,o(e,this.subtitleStyle??f)),g=i.bottom.right.repeat(s.right),[_,v]=d===``?[g,``]:[``,g];yield*$(e,i.bottom,s,s.spanWidth-a(d),this._subtitleLabel,m,c,_),yield new h(d,Q(c,p)),yield new h(v,c),yield h.line()}_resolveAccessory(e){if(e!==void 0)return typeof e==`function`?e():e}static fit(e,t){return new u(e,{...t,expand:!1})}};export{D as C,P as S,j as _,w as a,M as b,C as c,L as d,R as f,k as g,H as h,W as i,B as l,F as m,q as n,T as o,z as p,G as r,E as s,ee as t,V as u,A as v,O as w,N as x,I as y};