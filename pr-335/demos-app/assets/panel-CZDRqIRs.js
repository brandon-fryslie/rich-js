import{B as e,Bt as t,Ht as n,I as r,It as i,U as a,V as o,X as s,Y as c,Zt as l,d as u,f as d,ot as f,p,r as m,tt as h,u as g,z as _}from"./console-DKE-hDju.js";var v=8,y=4,b={"╭":`┌`,"╮":`┐`,"╰":`└`,"╯":`┘`},x=e=>({left:e[0],horizontal:e[1],cross:e[2],right:e[3]}),S=e=>({left:e[0],vertical:e[2],right:e[3]}),C=class e{top;bottom;grid;headContent;headSeparator;bodyContent;rowSeparator;footSeparator;footContent;constructor(e){let t=e.split(`
`);if(t.length!==v||t.some(e=>Array.from(e).length!==y)||t.some(e=>n(e)!==y))throw Error(`A box grid is ${v} lines of ${y} single-cell characters; got ${t.length} line(s) measuring `+t.map(e=>`${Array.from(e).length}/${n(e)}`).join(`, `)+` characters/cells`);let r=t.map(e=>Array.from(e));this.grid=e,this.top=x(r[0]),this.headContent=S(r[1]),this.headSeparator=x(r[2]),this.bodyContent=S(r[3]),this.rowSeparator=x(r[4]),this.footSeparator=x(r[5]),this.footContent=S(r[6]),this.bottom=x(r[7])}getTop(e,t,n=!0){return this.getEdge(e,this.top,t,n)}getRow(e,t,n,r=!0){return this.getEdge(e,this.getRowChars(t),n,r)}getContentChars(e){switch(e){case`head`:return this.headContent;case`row`:case`mid`:return this.bodyContent;case`foot`:return this.footContent}}getBottom(e,t,n=!0){return this.getEdge(e,this.bottom,t,n)}substitute(e={}){let t=_(e,this,w,e=>e.grid);return t===this&&e.safe===!0?this.safeSubstitute():t}safeSubstitute(){return new e(Array.from(this.grid,e=>b[e]??e).join(``))}plainHeaded(){return U.find(([e])=>e.grid===this.grid)?.[1]??this}getEdge(e,t,n,r){let i=e.map(e=>t.horizontal.repeat(e)).join(t.cross),a=r?t.left+i+t.right:i;return[new h(a,n),h.line()]}getRowChars(e){switch(e){case`head`:return this.headSeparator;case`row`:return this.rowSeparator;case`foot`:return this.footSeparator;case`mid`:return{left:this.bodyContent.left,horizontal:` `,cross:this.bodyContent.vertical,right:this.bodyContent.right}}}},w=new C(`+--+
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
    `),U=[[z,D],[O,D],[A,k],[j,k],[E,T]];function W(e){let n=e=>Number.isFinite(e)?t(e):0,r=typeof e==`number`?[e,e,e,e]:e.length===2?[e[0],e[1],e[0],e[1]]:e;return[n(r[0]),n(r[1]),n(r[2]),n(r[3])]}function G(e,n,r){let i=t(e),a=e=>{let t=Math.min(e,i);return i-=t,t},o=a(1),s=a(n),c=a(r);return{left:s,contentWidth:o+i,right:c}}function K(e){return e.left+e.contentWidth+e.right}var q=class{renderable;top;right;bottom;left;style;expand;constructor(e,t,n){let[r,i,a,o]=W(t);this.renderable=d(e),this.top=r,this.right=i,this.bottom=a,this.left=o,this.style=n?.style??f,this.expand=n?.expand!==!1}*render(t){let n=c(t,this),r=G(this.expand?n.maxWidth:m.get(n,this).maximum,this.left,this.right),i={...n,maxWidth:r.contentWidth,height:a(n.height,this.top+this.bottom)},s=o(n,this.style),l=s.isNull?void 0:s,u=[...h.applyStyle(this.renderable.render(i),l)],d=e(h.splitLines(u),i.height),f=new h(` `.repeat(r.left),l),p=new h(` `.repeat(r.right),l),g=new h(` `.repeat(K(r)),l);for(let e=0;e<this.top;e++)yield g,yield h.line();for(let e of d)yield f,yield*h.adjustLineLength(e,r.contentWidth,l),yield p,yield h.line();for(let e=0;e<this.bottom;e++)yield g,yield h.line()}measure(e){let t=s(e),n=G(t.maxWidth,this.left,this.right),r=n.left+n.right,i=m.get({...t,maxWidth:n.contentWidth},this.renderable),a=Math.min(t.maxWidth,i.maximum+r);return{minimum:Math.min(i.minimum+r,a),maximum:a}}};function J(e,n){let[,r,,i]=n,a=t(e),o=e=>{let t=Math.min(e,a);return a-=t,t},s=o(1),c=o(1),l=o(1),u=o(i),d=o(r),f=l+a;return{left:s,right:c,padLeft:u,contentWidth:f,padRight:d,spanWidth:u+f+d}}function Y(e){return e.left+e.right+e.padLeft+e.padRight}function X(e){return{...e,markup:!0,highlight:!1}}function Z(e,t){return e.text(X(t)).pad(1)}function Q(e,t){return t.isNull?e:(e??f).add(t)}function $(e,t,n,r,i,a,o,s){let c=t.left.repeat(n.left);if(i===void 0||r<=2)return[new h(c+t.horizontal.repeat(r)+s,o)];let l=r-2,d=Z(i,e);g(d,l,d.overflow===`ellipsis`?_(e,`…`,`.`):``);let f=u(d,X(e),a),p=l-h.getLineLength(f),m=Math.floor(p/2);return[new h(c+t.horizontal,o),new h(t.horizontal.repeat(m),o),...f,new h(t.horizontal.repeat(p-m),o),new h(t.horizontal+s,o)]}var ee=class u{renderable;box;title;subtitle;bottomRightAccessory;expand;style;borderStyle;titleStyle;subtitleStyle;width;padding;_titleLabel;_subtitleLabel;constructor(e,t){this.renderable=d(e),this.box=t?.box??I,this.title=t?.title,this.subtitle=t?.subtitle,this._titleLabel=p(this.title),this._subtitleLabel=p(this.subtitle),this.bottomRightAccessory=t?.bottomRightAccessory,this.expand=t?.expand!==!1,this.style=t?.style??f,this.borderStyle=t?.borderStyle??f,this.titleStyle=t?.titleStyle,this.subtitleStyle=t?.subtitleStyle,this.width=t?.width,this.padding=W(t?.padding??[0,1,0,1])}*render(e){let t=c(e,this),n=this.box.substitute(t),r=o(t,this.style),i=r.add(o(t,this.borderStyle)),a=i.isNull?void 0:i,s=r.isNull?void 0:r,l=J(this._getPanelWidth(t),this.padding),[u,,d]=this.padding,f=this._renderContent(t,l.contentWidth,s);yield*this._renderTopBorder(t,n,l,a);for(let e=0;e<u;e++)yield*this._renderPaddingRow(n,l,a,s);for(let e of f)yield*this._renderRow(n,l,e,a,s);for(let e=0;e<d;e++)yield*this._renderPaddingRow(n,l,a,s);yield*this._renderBottomBorder(t,n,l,a)}_renderContent(t,n,r){let[i,,o]=this.padding,s=a(t.height,2+i+o),c={...t,highlight:!1,maxWidth:n,height:s},l=e(h.splitLines([...h.applyStyle(this.renderable.render(c),r)]),s);return n===0?[]:l}*_renderRow(e,t,n,r,i){let a=e.getContentChars(`row`);yield new h(a.left.repeat(t.left),r),yield new h(` `.repeat(t.padLeft),i),yield*h.adjustLineLength(n,t.contentWidth,i),yield new h(` `.repeat(t.padRight),i),yield new h(a.right.repeat(t.right),r),yield h.line()}*_renderPaddingRow(e,t,n,r){let i=e.getContentChars(`row`);yield new h(i.left.repeat(t.left),n),yield new h(` `.repeat(t.spanWidth),r),yield new h(i.right.repeat(t.right),n),yield h.line()}measure(e){let t=s(e),n=this._declaredWidth;if(n!==void 0){let e=Math.min(t.maxWidth,n);return{minimum:e,maximum:e}}let r=this._contentRange(t),i=Y(J(t.maxWidth,this.padding)),a=Math.min(t.maxWidth,Math.max(r.maximum,this._labelWidth(t)+i));return{minimum:Math.min(r.minimum,a),maximum:a}}_contentRange(e){let t=J(e.maxWidth,this.padding),n=Y(t),r=m.get({...e,maxWidth:t.contentWidth},this.renderable);return{minimum:r.minimum+n,maximum:Math.min(e.maxWidth,r.maximum+n)}}_labelWidth(e){return this._titleLabel===void 0?0:Z(this._titleLabel,e).cellLength}get _declaredWidth(){return this.width===void 0?void 0:t(this.width)}_getPanelWidth(e){let t=Math.min(e.maxWidth,this._declaredWidth??e.maxWidth),n=this.expand?t:this._contentRange({...e,maxWidth:t}).maximum,r=this._titleLabel===void 0?0:this._labelWidth(e)+4;return Math.min(e.maxWidth,Math.max(n,r))}*_renderTopBorder(e,t,n,r){let i=Q(r,o(e,this.titleStyle??f));yield*$(e,t.top,n,n.spanWidth,this._titleLabel,i,r,t.top.right.repeat(n.right)),yield h.line()}*_renderBottomBorder(e,t,a,s){let c=this._resolveAccessory(this.bottomRightAccessory),u=c===void 0?``:typeof c==`string`?` ${c} `:` ${c.plain} `,d=l(u,i(Math.min(n(u),a.spanWidth))),p=c instanceof r?c.resolvedStyle(e):f,m=Q(s,o(e,this.subtitleStyle??f)),g=t.bottom.right.repeat(a.right),[_,v]=d===``?[g,``]:[``,g];yield*$(e,t.bottom,a,a.spanWidth-n(d),this._subtitleLabel,m,s,_),yield new h(d,Q(s,p)),yield new h(v,s),yield h.line()}_resolveAccessory(e){if(e!==void 0)return typeof e==`function`?e():e}static fit(e,t){return new u(e,{...t,expand:!1})}};export{D as C,P as S,j as _,w as a,M as b,C as c,L as d,R as f,k as g,H as h,W as i,B as l,F as m,q as n,T as o,z as p,G as r,E as s,ee as t,V as u,A as v,O as w,N as x,I as y};