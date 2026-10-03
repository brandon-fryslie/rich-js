import{B as e,Bt as t,F as n,H as r,J as i,Pt as a,R as o,Rt as s,Y as c,Yt as l,at as u,d,et as f,f as p,r as m,u as h,z as g}from"./console-DdqMIia3.js";var _=8,v=4,y={"╭":`┌`,"╮":`┐`,"╰":`└`,"╯":`┘`},b=e=>({left:e[0],horizontal:e[1],cross:e[2],right:e[3]}),x=e=>({left:e[0],vertical:e[2],right:e[3]}),S=class e{top;bottom;grid;headContent;headSeparator;bodyContent;rowSeparator;footSeparator;footContent;constructor(e){let n=e.split(`
`);if(n.length!==_||n.some(e=>Array.from(e).length!==v)||n.some(e=>t(e)!==v))throw Error(`A box grid is ${_} lines of ${v} single-cell characters; got ${n.length} line(s) measuring `+n.map(e=>`${Array.from(e).length}/${t(e)}`).join(`, `)+` characters/cells`);let r=n.map(e=>Array.from(e));this.grid=e,this.top=b(r[0]),this.headContent=x(r[1]),this.headSeparator=b(r[2]),this.bodyContent=x(r[3]),this.rowSeparator=b(r[4]),this.footSeparator=b(r[5]),this.footContent=x(r[6]),this.bottom=b(r[7])}getTop(e,t,n=!0){return this.getEdge(e,this.top,t,n)}getRow(e,t,n,r=!0){return this.getEdge(e,this.getRowChars(t),n,r)}getContentChars(e){switch(e){case`head`:return this.headContent;case`row`:case`mid`:return this.bodyContent;case`foot`:return this.footContent}}getBottom(e,t,n=!0){return this.getEdge(e,this.bottom,t,n)}substitute(e={}){let t=o(e,this,C,e=>e.grid);return t===this&&e.safe===!0?this.safeSubstitute():t}safeSubstitute(){return new e(Array.from(this.grid,e=>y[e]??e).join(``))}plainHeaded(){return H.find(([e])=>e.grid===this.grid)?.[1]??this}getEdge(e,t,n,r){let i=e.map(e=>t.horizontal.repeat(e)).join(t.cross),a=r?t.left+i+t.right:i;return[new f(a,n),f.line()]}getRowChars(e){switch(e){case`head`:return this.headSeparator;case`row`:return this.rowSeparator;case`foot`:return this.footSeparator;case`mid`:return{left:this.bodyContent.left,horizontal:` `,cross:this.bodyContent.vertical,right:this.bodyContent.right}}}},C=new S(`+--+
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
    `),H=[[R,E],[D,E],[k,O],[A,O],[T,w]];function U(e){let t=e=>Number.isFinite(e)?s(e):0,n=typeof e==`number`?[e,e,e,e]:e.length===2?[e[0],e[1],e[0],e[1]]:e;return[t(n[0]),t(n[1]),t(n[2]),t(n[3])]}function W(e,t,n){let r=s(e),i=e=>{let t=Math.min(e,r);return r-=t,t},a=i(1),o=i(t),c=i(n);return{left:o,contentWidth:a+r,right:c}}function G(e){return e.left+e.contentWidth+e.right}var K=class{renderable;top;right;bottom;left;style;expand;constructor(e,t,n){let[r,i,a,o]=U(t);this.renderable=d(e),this.top=r,this.right=i,this.bottom=a,this.left=o,this.style=n?.style??u,this.expand=n?.expand!==!1}*render(t){let n=i(t,this),a=W(this.expand?n.maxWidth:m.get(n,this).maximum,this.left,this.right),o={...n,maxWidth:a.contentWidth,height:r(n.height,this.top+this.bottom)},s=e(n,this.style),c=s.isNull?void 0:s,l=[...f.applyStyle(this.renderable.render(o),c)],u=g(f.splitLines(l),o.height),d=new f(` `.repeat(a.left),c),p=new f(` `.repeat(a.right),c),h=new f(` `.repeat(G(a)),c);for(let e=0;e<this.top;e++)yield h,yield f.line();for(let e of u)yield d,yield*f.adjustLineLength(e,a.contentWidth,c),yield p,yield f.line();for(let e=0;e<this.bottom;e++)yield h,yield f.line()}measure(e){let t=c(e),n=W(t.maxWidth,this.left,this.right),r=n.left+n.right,i=m.get({...t,maxWidth:n.contentWidth},this.renderable),a=Math.min(t.maxWidth,i.maximum+r);return{minimum:Math.min(i.minimum+r,a),maximum:a}}};function q(e,t){let[,n,,r]=t,i=s(e),a=e=>{let t=Math.min(e,i);return i-=t,t},o=a(1),c=a(1),l=a(1),u=a(r),d=a(n),f=l+i;return{left:o,right:c,padLeft:u,contentWidth:f,padRight:d,spanWidth:u+f+d}}function J(e){return e.left+e.right+e.padLeft+e.padRight}function Y(e){return{...e,markup:!0,highlight:!1}}function X(e,t){return t.isNull?e:(e??u).add(t)}function Z(e,n,r,i,a,s,c,l){let u=n.left.repeat(r.left);if(a===void 0||i<=2)return[new f(u+n.horizontal.repeat(i)+l,c)];let d=i-2,p=Y(e),m=a.text(p);if(m.cellLength>d){let n=m.overflow===`ellipsis`?o(e,`…`,`.`):``,r=d-t(n);m.truncate(r,{marker:``}),m.padRight(r-m.cellLength),m.append(n)}let g=h(m,p,s),_=d-f.getLineLength(g),v=Math.floor(_/2);return[new f(u+n.horizontal,c),new f(n.horizontal.repeat(v),c),...g,new f(n.horizontal.repeat(_-v),c),new f(n.horizontal+l,c)]}var Q=class o{renderable;box;title;subtitle;bottomRightAccessory;expand;style;borderStyle;titleStyle;subtitleStyle;width;padding;_titleLabel;_subtitleLabel;constructor(e,t){this.renderable=d(e),this.box=t?.box??F,this.title=t?.title,this.subtitle=t?.subtitle,this._titleLabel=p(this.title),this._subtitleLabel=p(this.subtitle),this.bottomRightAccessory=t?.bottomRightAccessory,this.expand=t?.expand!==!1,this.style=t?.style??u,this.borderStyle=t?.borderStyle??u,this.titleStyle=t?.titleStyle,this.subtitleStyle=t?.subtitleStyle,this.width=t?.width,this.padding=U(t?.padding??[0,1,0,1])}*render(t){let n=i(t,this),r=this.box.substitute(n),a=e(n,this.style),o=a.add(e(n,this.borderStyle)),s=o.isNull?void 0:o,c=a.isNull?void 0:a,l=q(this._getPanelWidth(n),this.padding),[u,,d]=this.padding,f=this._renderContent(n,l.contentWidth,c);yield*this._renderTopBorder(n,r,l,s);for(let e=0;e<u;e++)yield*this._renderPaddingRow(r,l,s,c);for(let e of f)yield*this._renderRow(r,l,e,s,c);for(let e=0;e<d;e++)yield*this._renderPaddingRow(r,l,s,c);yield*this._renderBottomBorder(n,r,l,s)}_renderContent(e,t,n){let[i,,a]=this.padding,o=r(e.height,2+i+a),s={...e,highlight:!1,maxWidth:t,height:o},c=g(f.splitLines([...f.applyStyle(this.renderable.render(s),n)]),o);return t===0?[]:c}*_renderRow(e,t,n,r,i){let a=e.getContentChars(`row`);yield new f(a.left.repeat(t.left),r),yield new f(` `.repeat(t.padLeft),i),yield*f.adjustLineLength(n,t.contentWidth,i),yield new f(` `.repeat(t.padRight),i),yield new f(a.right.repeat(t.right),r),yield f.line()}*_renderPaddingRow(e,t,n,r){let i=e.getContentChars(`row`);yield new f(i.left.repeat(t.left),n),yield new f(` `.repeat(t.spanWidth),r),yield new f(i.right.repeat(t.right),n),yield f.line()}measure(e){let t=c(e),n=this._declaredWidth;if(n!==void 0){let e=Math.min(t.maxWidth,n);return{minimum:e,maximum:e}}let r=this._contentRange(t),i=J(q(t.maxWidth,this.padding)),a=Math.min(t.maxWidth,Math.max(r.maximum,this._labelWidth(t)+i));return{minimum:Math.min(r.minimum,a),maximum:a}}_contentRange(e){let t=q(e.maxWidth,this.padding),n=J(t),r=m.get({...e,maxWidth:t.contentWidth},this.renderable);return{minimum:r.minimum+n,maximum:Math.min(e.maxWidth,r.maximum+n)}}_labelWidth(e){return this._titleLabel?.text(Y(e)).cellLength??0}get _declaredWidth(){return this.width===void 0?void 0:s(this.width)}_getPanelWidth(e){let t=Math.min(e.maxWidth,this._declaredWidth??e.maxWidth),n=this.expand?t:this._contentRange({...e,maxWidth:t}).maximum,r=this._titleLabel===void 0?0:this._labelWidth(e)+4;return Math.min(e.maxWidth,Math.max(n,r))}*_renderTopBorder(t,n,r,i){let a=X(i,e(t,this.titleStyle??u));yield*Z(t,n.top,r,r.spanWidth,this._titleLabel,a,i,n.top.right.repeat(r.right)),yield f.line()}*_renderBottomBorder(r,i,o,s){let c=this._resolveAccessory(this.bottomRightAccessory),d=c===void 0?``:typeof c==`string`?` ${c} `:` ${c.plain} `,p=l(d,a(Math.min(t(d),o.spanWidth))),m=c instanceof n?c.resolvedStyle(r):u,h=X(s,e(r,this.subtitleStyle??u)),g=i.bottom.right.repeat(o.right),[_,v]=p===``?[g,``]:[``,g];yield*Z(r,i.bottom,o,o.spanWidth-t(p),this._subtitleLabel,h,s,_),yield new f(p,X(s,m)),yield new f(v,s),yield f.line()}_resolveAccessory(e){if(e!==void 0)return typeof e==`function`?e():e}static fit(e,t){return new o(e,{...t,expand:!1})}};export{E as C,N as S,A as _,C as a,j as b,S as c,I as d,L as f,O as g,V as h,U as i,z as l,P as m,K as n,w as o,R as p,W as r,T as s,Q as t,B as u,k as v,D as w,M as x,F as y};