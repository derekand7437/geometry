import { rnd, ri, shuffle, modeOf, withDistractors } from "./util.js";

const PI = Math.PI;

/* ---------- number helpers ---------- */
function parseNum(s){
  s=String(s==null?"":s).trim().replace(/,/g,"").replace(/sqrt/gi,"√").replace(/\s+/g,"").replace(/pi/gi,"π");
  var m=/^(-?\d*\.?\d*)√(\d+\.?\d*)$/.exec(s);
  if(m){ var a=(m[1]===""||m[1]==="-")?m[1]+"1":m[1]; return parseFloat(a)*Math.sqrt(parseFloat(m[2])); }
  var p=/^(-?\d*\.?\d*)π$/.exec(s);
  if(p){ var b=(p[1]===""||p[1]==="-")?p[1]+"1":p[1]; return parseFloat(b)*PI; }
  var f=/^(-?\d+\.?\d*)\/(-?\d+\.?\d*)$/.exec(s);
  if(f) return parseFloat(f[1])/parseFloat(f[2]);
  var v=parseFloat(s); return isNaN(v)?NaN:v;
}
function nearly(a,b){ if(!isFinite(a)||!isFinite(b)) return false; if(Math.abs(b)<1e-9) return Math.abs(a)<1e-6; return Math.abs(a-b)<=Math.max(Math.abs(b)*0.012,0.005)+1e-9; }
function r2(x){ return Math.round(x*100)/100; }
function gcd(a,b){ a=Math.abs(a); b=Math.abs(b); while(b){ var t=b; b=a%b; a=t; } return a||1; }
function frac(n,d){ var g=gcd(n,d); n/=g; d/=g; if(d<0){ n=-n; d=-d; } return d===1? String(n) : n+"/"+d; }
function sig(x){ var v=Math.round(x*1000)/1000; return String(v); }

/* ---------- figures ---------- */
function transversalSVG(hi){
  hi=hi||[];
  var P={1:[112,56],2:[152,50],3:[110,92],4:[152,88],5:[186,136],6:[228,130],7:[184,172],8:[226,168]};
  var s='<svg viewBox="0 0 320 220" role="img" aria-label="Two parallel lines cut by a transversal, angles numbered one to eight">';
  s+='<path class="svg-line" d="M18 70 H302"/><path class="svg-line" d="M18 150 H302"/>';
  s+='<path class="svg-draw" d="M80 15 L260 205"/>';
  s+='<circle class="svg-dot" cx="132" cy="70" r="3.2"/><circle class="svg-dot" cx="208" cy="150" r="3.2"/>';
  s+='<text class="svg-mut" x="24" y="64">l</text><text class="svg-mut" x="24" y="144">m</text><text class="svg-mut" x="266" y="205">t</text>';
  for(var k=1;k<=8;k++){
    var on=hi.indexOf(k)>=0;
    if(on) s+='<circle class="hi-ring" cx="'+(P[k][0]+4)+'" cy="'+(P[k][1]-4)+'" r="12"/>';
    s+='<text class="'+(on?"svg-hi":"svg-txt")+'" x="'+P[k][0]+'" y="'+P[k][1]+'">'+k+'</text>';
  }
  return s+'</svg>';
}
function trianglePairSVG(marks){
  marks=marks||{};
  function tri(ox){
    var A=[ox+10,110], B=[ox+95,110], C=[ox+62,32];
    var g='<path class="svg-line" d="M'+A[0]+' '+A[1]+' L'+B[0]+' '+B[1]+' L'+C[0]+' '+C[1]+' Z"/>';
    function ticks(p,q,n,cls){
      var mx=(p[0]+q[0])/2, my=(p[1]+q[1])/2, dx=q[0]-p[0], dy=q[1]-p[1], L=Math.sqrt(dx*dx+dy*dy);
      var nx=-dy/L*5, ny=dx/L*5, tx=dx/L*3.4, ty=dy/L*3.4, out="";
      for(var i=0;i<n;i++){ var o=(i-(n-1)/2)*4.4, cx=mx+dx/L*o, cy=my+dy/L*o;
        out+='<path class="'+cls+'" d="M'+(cx-nx)+' '+(cy-ny)+' L'+(cx+nx)+' '+(cy+ny)+'"/>'; }
      return out;
    }
    function arc(v,p,q,cls){
      function u(a,b){ var dx=b[0]-a[0], dy=b[1]-a[1], L=Math.sqrt(dx*dx+dy*dy); return [dx/L,dy/L]; }
      var u1=u(v,p), u2=u(v,q), R=17;
      var sweep=(u1[0]*u2[1]-u1[1]*u2[0])>0?1:0;
      return '<path class="'+cls+'" d="M'+(v[0]+u1[0]*R)+' '+(v[1]+u1[1]*R)+' A'+R+' '+R+' 0 0 '+sweep+' '+(v[0]+u2[0]*R)+' '+(v[1]+u2[1]*R)+'"/>';
    }
    if(marks.AB) g+=ticks(A,B,marks.AB,"svg-draw");
    if(marks.BC) g+=ticks(B,C,marks.BC,"svg-draw");
    if(marks.AC) g+=ticks(A,C,marks.AC,"svg-draw");
    if(marks.angA) g+=arc(A,B,C,"svg-draw");
    if(marks.angB) g+=arc(B,C,A,"svg-draw");
    if(marks.angC) g+=arc(C,A,B,"svg-draw");
    if(marks.rightC) g+='<path class="svg-draw" d="M'+(C[0]-9)+' '+(C[1]+7)+' l6 8 l8 -6"/>';
    g+='<text class="svg-mut" x="'+(A[0]-11)+'" y="'+(A[1]+14)+'">'+(ox<150?"A":"D")+'</text>';
    g+='<text class="svg-mut" x="'+(B[0]+4)+'" y="'+(B[1]+14)+'">'+(ox<150?"B":"E")+'</text>';
    g+='<text class="svg-mut" x="'+(C[0]-4)+'" y="'+(C[1]-8)+'">'+(ox<150?"C":"F")+'</text>';
    return g;
  }
  return '<svg viewBox="0 0 320 130" role="img" aria-label="Two triangles with matching marks">'+tri(15)+tri(185)+'</svg>';
}
function rightSVG(a,b){
  var W=300,H=170, pad=34;
  var sc=Math.min((W-2*pad)/Math.max(a,0.1),(H-2*pad)/Math.max(b,0.1));
  var la=a*sc, lb=b*sc;
  var x0=pad, y0=H-pad;
  var c=Math.sqrt(a*a+b*b);
  var s='<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Right triangle with legs '+a+' and '+b+'">';
  s+='<path class="svg-fill" d="M'+x0+' '+y0+' L'+(x0+la)+' '+y0+' L'+x0+' '+(y0-lb)+' Z"/>';
  s+='<path class="svg-line" d="M'+(x0+2)+' '+(y0-14)+' h12 v12"/>';
  s+='<text class="svg-txt" x="'+(x0+la/2-8)+'" y="'+(y0+18)+'">a='+r2(a)+'</text>';
  s+='<text class="svg-txt" x="'+(x0-26)+'" y="'+(y0-lb/2)+'">b='+r2(b)+'</text>';
  s+='<text class="svg-hi" x="'+(x0+la/2+2)+'" y="'+(y0-lb/2-6)+'">c='+r2(c)+'</text>';
  return s+'</svg>';
}
function similarSVG(){
  return '<svg viewBox="0 0 320 140" role="img" aria-label="A small triangle and a larger similar triangle">'+
  '<path class="svg-line" d="M20 110 L100 110 L64 52 Z"/>'+
  '<path class="svg-draw" d="M150 122 L300 122 L232 12 Z"/>'+
  '<text class="svg-mut" x="52" y="128">&#9651;ABC</text><text class="svg-mut" x="204" y="138">&#9651;DEF</text>'+
  '<text class="svg-txt" x="108" y="86">~</text></svg>';
}
function circleSVG(){
  var cx=160, cy=95, r=66;
  var a1=-140*PI/180, a2=-40*PI/180;
  var A=[cx+r*Math.cos(a1), cy+r*Math.sin(a1)], B=[cx+r*Math.cos(a2), cy+r*Math.sin(a2)];
  var Pp=[cx+r*Math.cos(100*PI/180), cy+r*Math.sin(100*PI/180)];
  var s='<svg viewBox="0 0 320 190" role="img" aria-label="A circle showing a central angle and an inscribed angle on the same arc">';
  s+='<circle class="svg-line" cx="'+cx+'" cy="'+cy+'" r="'+r+'"/>';
  s+='<path class="svg-fill" d="M'+cx+' '+cy+' L'+A[0]+' '+A[1]+' A'+r+' '+r+' 0 0 1 '+B[0]+' '+B[1]+' Z"/>';
  s+='<path class="svg-thin" d="M'+Pp[0]+' '+Pp[1]+' L'+A[0]+' '+A[1]+' M'+Pp[0]+' '+Pp[1]+' L'+B[0]+' '+B[1]+'"/>';
  s+='<circle class="svg-dot" cx="'+cx+'" cy="'+cy+'" r="3"/>';
  s+='<text class="svg-mut" x="'+(cx+6)+'" y="'+(cy+14)+'">O</text>';
  s+='<text class="svg-hi" x="'+(cx-16)+'" y="'+(cy-16)+'">central</text>';
  s+='<text class="svg-mut" x="'+(Pp[0]-30)+'" y="'+(Pp[1]+18)+'">inscribed</text>';
  s+='<text class="svg-mut" x="'+(A[0]-16)+'" y="'+(A[1]-6)+'">A</text><text class="svg-mut" x="'+(B[0]+4)+'" y="'+(B[1]-6)+'">B</text>';
  return s+'</svg>';
}
function gridSVG(p1,p2){
  var W=300,H=200, step=18, ox=W/2, oy=H/2;
  var s='<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Two points plotted on a coordinate grid">';
  for(var x=ox%step;x<W;x+=step) s+='<path class="svg-thin" d="M'+x+' 0 V'+H+'"/>';
  for(var y=oy%step;y<H;y+=step) s+='<path class="svg-thin" d="M0 '+y+' H'+W+'"/>';
  s+='<path class="svg-line" d="M0 '+oy+' H'+W+' M'+ox+' 0 V'+H+'"/>';
  function px(p){ return [ox+p[0]*step, oy-p[1]*step]; }
  var A=px(p1), B=px(p2);
  s+='<path class="svg-draw" d="M'+A[0]+' '+A[1]+' L'+B[0]+' '+B[1]+'"/>';
  s+='<circle class="svg-dot" cx="'+A[0]+'" cy="'+A[1]+'" r="4"/><circle class="svg-dot" cx="'+B[0]+'" cy="'+B[1]+'" r="4"/>';
  s+='<text class="svg-txt" x="'+(A[0]+7)+'" y="'+(A[1]-7)+'">('+p1[0]+", "+p1[1]+')</text>';
  s+='<text class="svg-txt" x="'+(B[0]+7)+'" y="'+(B[1]-7)+'">('+p2[0]+", "+p2[1]+')</text>';
  return s+'</svg>';
}

/* ---------- angle-pair table ---------- */
var REL={};
function setRel(pairs,name,cong){ pairs.forEach(function(p){ REL[p[0]+"-"+p[1]]={name:name,cong:cong}; REL[p[1]+"-"+p[0]]={name:name,cong:cong}; }); }
setRel([[1,4],[2,3],[5,8],[6,7]],"vertical angles",1);
setRel([[1,5],[2,6],[3,7],[4,8]],"corresponding angles",1);
setRel([[3,6],[4,5]],"alternate interior angles",1);
setRel([[1,8],[2,7]],"alternate exterior angles",1);
setRel([[3,5],[4,6]],"same-side interior angles",0);
setRel([[1,7],[2,8]],"same-side exterior angles",0);
setRel([[1,2],[3,4],[1,3],[2,4],[5,6],[7,8],[5,7],[6,8]],"a linear pair",0);
var REL_NAMES=["vertical angles","corresponding angles","alternate interior angles","alternate exterior angles","same-side interior angles","same-side exterior angles","a linear pair"];
var GROUP_A=[1,4,5,8];
function relOf(i,j){ return REL[i+"-"+j] || {name:(GROUP_A.indexOf(i)>=0)===(GROUP_A.indexOf(j)>=0)?"congruent angles":"supplementary angles", cong:(GROUP_A.indexOf(i)>=0)===(GROUP_A.indexOf(j)>=0)?1:0}; }

/* ---------- congruence cases ---------- */
var CONG=[
 {m:{AB:1,BC:2,AC:3},ans:"SSS",why:"All three pairs of sides are marked congruent, so the triangles are rigid copies of each other."},
 {m:{AB:1,angB:1,BC:2},ans:"SAS",why:"Two sides are marked, and the marked angle B sits between them — an included angle, which is what SAS requires."},
 {m:{angA:1,AB:1,angB:1},ans:"ASA",why:"Two angles are marked with the side between them, which is ASA."},
 {m:{angA:1,angB:1,BC:1},ans:"AAS",why:"Two angles are marked, but side BC is outside them, so this is AAS rather than ASA."},
 {m:{rightC:1,AB:1,BC:2},ans:"HL",why:"There is a right angle, and the marked parts are the hypotenuse AB plus a leg — HL, which only exists for right triangles."},
 {m:{AB:1,BC:2,angA:1},ans:"none of these",why:"Two sides and an angle that is not between them is SSA, the swinging-door case. It can produce two different triangles, so it proves nothing."},
 {m:{angA:1,angB:1,angC:1},ans:"none of these",why:"Three angles is AAA. It guarantees the same shape, but the triangles could be any size, so it only proves similarity."}
];
var CONG_CHOICES=["SSS","SAS","ASA","AAS","HL","none of these"];

/* ---------- generators ---------- */
const G={};
function bar(t){ return '<span style="border-top:1.5px solid currentColor; padding-top:1px">'+t+'</span>'; }

var NOTATION=[
 ["segment","the segment from A to B","AB with a bar over it", bar("AB")],
 ["ray","the ray starting at A and going through B","AB with a one-way arrow over it", bar("AB")+"&#8594;"],
 ["line","the line through A and B","AB with a two-way arrow over it", bar("AB")+"&#8596;"],
 ["length","the distance from A to B","AB with nothing over it", "AB"]
];
var VOCAB=[
 ["collinear","points that all lie on one straight line"],
 ["coplanar","points that all lie in one flat plane"],
 ["midpoint","the point that divides a segment into two equal halves"],
 ["angle bisector","a ray that splits an angle into two equal angles"],
 ["vertex","the corner point where two sides or rays meet"],
 ["ray","a piece of a line with one endpoint that goes forever the other way"],
 ["segment","a piece of a line with an endpoint at each end"],
 ["perpendicular","two lines that meet at exactly 90 degrees"],
 ["parallel","two lines in the same plane that never meet"],
 ["congruent","the same size and the same shape"]
];

G.basics=function(opt){
  opt=opt||{};
  var mode=modeOf(opt,["notation","vocab","segadd"]);
  if(mode==="notation"){
    var n=rnd(NOTATION);
    return {kind:"mc", prompt:"How do you write <b>"+n[1]+"</b>?",
      choices:withDistractors(n[2],NOTATION.map(function(x){return x[2]}).filter(function(x){return x!==n[2]}),4),
      correct:n[2], answer:n[2],
      steps:["The "+n[0]+" from A to B is written "+n[3]+".",
             "A bar means a segment, which has two endpoints. An arrow means it keeps going in that direction. No mark at all means the number you would measure — a length."]};
  }
  if(mode==="vocab"){
    var v=rnd(VOCAB);
    return {kind:"mc", prompt:"Which word means <b>"+v[1]+"</b>?",
      choices:withDistractors(v[0],VOCAB.map(function(x){return x[0]}).filter(function(x){return x!==v[0]}),4),
      correct:v[0], answer:v[0],
      steps:["A "+v[0]+" is "+v[1]+".","Geometry is unusually strict about vocabulary, because proofs later on have to cite these definitions by name."]};
  }
  var ab=ri(3,20), bc=ri(3,20), ac=ab+bc, ask=ri(1,2);
  if(ask===1) return {kind:"text", prompt:"Point B lies between A and C. If AB = <b>"+ab+"</b> and BC = <b>"+bc+"</b>, find AC.",
    unit:"units", placeholder:"length",
    check:function(x){ return nearly(parseNum(x),ac); }, answer:String(ac),
    steps:["When a point is between two others, the two short pieces add up to the whole: AB + BC = AC.",
           ab+" + "+bc+" = "+ac+"."]};
  return {kind:"text", prompt:"Point B lies between A and C. If AC = <b>"+ac+"</b> and AB = <b>"+ab+"</b>, find BC.",
    unit:"units", placeholder:"length",
    check:function(x){ return nearly(parseNum(x),bc); }, answer:String(bc),
    steps:["AB + BC = AC, so BC = AC − AB.",
           ac+" − "+ab+" = "+bc+"."]};
};

G.anglekinds=function(opt){
  opt=opt||{};
  var mode=modeOf(opt,["classify","comp","supp","vertical","linear"]);
  if(mode==="classify"){
    var m=rnd([ri(1,89),ri(91,179),90,180,ri(1,89),ri(91,179)]);
    var ans = m<90?"acute" : m===90?"right" : m<180?"obtuse" : "straight";
    return {kind:"mc", prompt:"An angle measures <b>"+m+"&deg;</b>. What kind of angle is it?",
      choices:["acute","right","obtuse","straight"], correct:ans, answer:ans,
      steps:["Under 90° is acute, exactly 90° is right, between 90° and 180° is obtuse, and exactly 180° is straight.",
             m+"° is "+ans+"."]};
  }
  if(mode==="comp"||mode==="supp"){
    var total=mode==="comp"?90:180, a=ri(10,total-10), b=total-a;
    return {kind:"text", prompt:"Two angles are <b>"+(mode==="comp"?"complementary":"supplementary")+"</b>. One measures <b>"+a+"&deg;</b>. Find the other.",
      unit:"degrees", placeholder:"degrees",
      check:function(x){ return nearly(parseNum(x),b); }, answer:b+"°",
      steps:[(mode==="comp"?"Complementary angles add to 90°.":"Supplementary angles add to 180°."),
             total+" − "+a+" = "+b+"°.",
             "Remember which is which: C comes before S, and 90 comes before 180."]};
  }
  if(mode==="vertical"){
    var v=ri(15,165);
    return {kind:"text", prompt:"&ang;1 and &ang;2 are <b>vertical angles</b>. If m&ang;1 = <b>"+v+"&deg;</b>, find m&ang;2.",
      unit:"degrees", placeholder:"degrees",
      check:function(x){ return nearly(parseNum(x),v); }, answer:v+"°",
      steps:["Vertical angles sit across the X from each other where two lines cross.",
             "They are always congruent, so m&ang;2 = "+v+"° too."]};
  }
  var p1=ri(20,160), p2=180-p1;
  return {kind:"text", prompt:"&ang;A and &ang;B form a <b>linear pair</b>. If m&ang;A = <b>"+p1+"&deg;</b>, find m&ang;B.",
    unit:"degrees", placeholder:"degrees",
    check:function(x){ return nearly(parseNum(x),p2); }, answer:p2+"°",
    steps:["A linear pair sits side by side and together forms a straight line.",
           "A straight line is 180°, so 180 − "+p1+" = "+p2+"°."]};
};

G.trianglebasics=function(opt){
  opt=opt||{};
  var mode=modeOf(opt,["sum","byangle","byside"]);
  if(mode==="sum"){
    var a=ri(20,110), b=ri(20,150-a), c=180-a-b;
    return {kind:"text", prompt:"Two angles of a triangle measure <b>"+a+"&deg;</b> and <b>"+b+"&deg;</b>. Find the third.",
      unit:"degrees", placeholder:"degrees",
      check:function(x){ return nearly(parseNum(x),c); }, answer:c+"°",
      steps:["The three angles of any triangle always add to 180°.",
             "180 − "+a+" − "+b+" = "+c+"°."]};
  }
  if(mode==="byangle"){
    var kind=rnd(["acute","right","obtuse"]), A,B,C;
    if(kind==="right"){ A=90; B=ri(20,70); C=90-B; }
    else if(kind==="obtuse"){ A=ri(95,140); B=ri(15,180-A-15); C=180-A-B; }
    else { A=ri(50,85); B=ri(50,85); C=180-A-B; if(C>=90||C<=0) { A=60;B=60;C=60; } }
    return {kind:"mc", prompt:"A triangle has angles of <b>"+A+"&deg;, "+B+"&deg;, and "+C+"&deg;</b>. What kind of triangle is it?",
      choices:["acute","right","obtuse"], correct:kind, answer:kind,
      steps:["Look at the largest angle only.",
             "All three under 90° is acute, exactly one 90° is right, and one over 90° is obtuse.",
             "The largest here is "+Math.max(A,B,C)+"°, so it is "+kind+"."]};
  }
  var kind2=rnd(["scalene","isosceles","equilateral"]), x,y,z;
  if(kind2==="equilateral"){ x=y=z=ri(3,15); }
  else if(kind2==="isosceles"){ x=y=ri(5,15); z=ri(3,9); while(z===x) z=ri(3,9); }
  else { x=ri(4,9); y=x+ri(1,4); z=y+ri(1,4); }
  return {kind:"mc", prompt:"A triangle has sides of <b>"+x+", "+y+", and "+z+"</b>. What kind of triangle is it?",
    choices:["scalene","isosceles","equilateral"], correct:kind2, answer:kind2,
    steps:["Count how many sides are equal.",
           "No equal sides is scalene, exactly two is isosceles, all three is equilateral.",
           "Here it is "+kind2+"."]};
};

G.angles=function(opt){
  opt=opt||{};
  var mode=modeOf(opt,["rel","measure","algebra"]);
  function pickPair(named){
    var i,j,g=0;
    do{ i=ri(1,8); j=ri(1,8); g++; } while((j===i || (named && !REL[i+"-"+j])) && g<300);
    return [i,j];
  }
  if(mode==="rel"){
    var pr=pickPair(true), i=pr[0], j=pr[1], rel=relOf(i,j);
    return {kind:"mc", fig:transversalSVG([i,j]),
      prompt:"Lines l and m are parallel. What is the relationship between <b>&ang;"+i+"</b> and <b>&ang;"+j+"</b>?",
      choices:withDistractors(rel.name,REL_NAMES.filter(function(n){return n!==rel.name}),4),
      correct:rel.name, answer:rel.name,
      steps:["&ang;"+i+" and &ang;"+j+" are "+rel.name+".",
             rel.cong?"That pair is congruent — equal measures.":"That pair is supplementary — the two measures add to 180°."]};
  }
  if(mode==="measure"){
    var pr2=pickPair(false), a=pr2[0], b=pr2[1], r2r=relOf(a,b), v=ri(25,155);
    var target=r2r.cong? v : 180-v;
    return {kind:"text", fig:transversalSVG([a,b]),
      prompt:"Lines l and m are parallel and <b>m&ang;"+a+" = "+v+"&deg;</b>. Find <b>m&ang;"+b+"</b>.",
      unit:"degrees", placeholder:"degrees",
      check:function(x){ return nearly(parseNum(x),target); }, answer:target+"°",
      steps:["&ang;"+a+" and &ang;"+b+" are "+r2r.name+".",
             r2r.cong? "Congruent, so the measure carries straight across." : "Supplementary, so subtract: 180 − "+v+".",
             "m&ang;"+b+" = "+target+"°."]};
  }
  var co=ri(3,9), cn=ri(20,70), val=co*ri(4,12)+cn, x2=Math.round((val-cn)/co);
  var pr3=pickPair(false), kk=pr3[0], ll=pr3[1], rr=relOf(kk,ll);
  var other=rr.cong? val : 180-val;
  return {kind:"text", fig:transversalSVG([kk,ll]),
    prompt:"Lines l and m are parallel. m&ang;"+kk+" = <b>("+co+"x + "+cn+")&deg;</b> and m&ang;"+ll+" = <b>"+other+"&deg;</b>. Solve for x.",
    unit:"x =", placeholder:"value of x",
    check:function(v3){ return nearly(parseNum(v3),x2); }, answer:"x = "+x2,
    steps:["&ang;"+kk+" and &ang;"+ll+" are "+rr.name+", so "+(rr.cong?"set the two expressions equal":"make the two expressions add to 180")+".",
           rr.cong? (co+"x + "+cn+" = "+other) : (co+"x + "+cn+" + "+other+" = 180"),
           co+"x = "+(val-cn)+", so x = "+x2+"."]};
};

G.congruence=function(opt){
  opt=opt||{};
  var pool=CONG;
  if(opt.subset) pool=CONG.filter(function(c){ return opt.subset.indexOf(c.ans)>=0; });
  var c=rnd(pool);
  return {kind:"mc", fig:trianglePairSVG(c.m),
    prompt:"Matching marks show which parts are congruent. <b>Which postulate proves the two triangles congruent?</b>",
    choices:CONG_CHOICES.slice(), correct:c.ans, answer:c.ans,
    steps:[c.why,"Read the marks in order around the triangle: an angle between two marked sides is SAS, a side between two marked angles is ASA."]};
};

G.right=function(opt){
  opt=opt||{};
  var mode=modeOf(opt,["hyp","leg","sp45","sp30"]);
  if(mode==="hyp"){
    var t=rnd([[3,4,5],[5,12,13],[8,15,17],[7,24,25],[9,12,15],[6,8,10],[20,21,29]]), k=rnd([1,1,2,3]);
    var a=t[0]*k, b=t[1]*k, c=t[2]*k;
    return {kind:"text", fig:rightSVG(a,b),
      prompt:"The legs of a right triangle are <b>"+a+"</b> and <b>"+b+"</b>. Find the hypotenuse.",
      unit:"units", placeholder:"length of c",
      check:function(v){ return nearly(parseNum(v),c); }, answer:String(c),
      steps:["a² + b² = c², and c is always the side across from the right angle.",
             a+"² + "+b+"² = "+(a*a)+" + "+(b*b)+" = "+(a*a+b*b)+".",
             "c = √"+(a*a+b*b)+" = "+c+"."]};
  }
  if(mode==="leg"){
    var t2=rnd([[3,4,5],[5,12,13],[8,15,17],[7,24,25],[6,8,10],[9,40,41]]);
    return {kind:"text",
      prompt:"A right triangle has a hypotenuse of <b>"+t2[2]+"</b> and one leg of <b>"+t2[1]+"</b>. Find the other leg.",
      unit:"units", placeholder:"length of the leg",
      check:function(v){ return nearly(parseNum(v),t2[0]); }, answer:String(t2[0]),
      steps:["The hypotenuse is given, so this is a subtraction: a² = c² − b².",
             "a² = "+t2[2]+"² − "+t2[1]+"² = "+(t2[2]*t2[2])+" − "+(t2[1]*t2[1])+" = "+(t2[2]*t2[2]-t2[1]*t2[1])+".",
             "a = √"+(t2[2]*t2[2]-t2[1]*t2[1])+" = "+t2[0]+"."]};
  }
  if(mode==="sp45"){
    var L=ri(2,14), hy=L*Math.SQRT2;
    return {kind:"text", prompt:"In a <b>45&deg;-45&deg;-90&deg;</b> triangle each leg measures <b>"+L+"</b>. Find the hypotenuse.",
      unit:"units", placeholder:"exact or decimal",
      check:function(v){ return nearly(parseNum(v),hy); }, answer:L+"√2 ≈ "+r2(hy),
      steps:["A 45-45-90 triangle is x, x, x√2.",
             "Hypotenuse = "+L+"√2, about "+r2(hy)+".",
             "You can type it either way — 5sqrt2 or 7.07 both count."]};
  }
  var sh=ri(2,12), ask=ri(1,2), lng=sh*Math.sqrt(3), hyp2=2*sh;
  if(ask===1) return {kind:"text", prompt:"In a <b>30&deg;-60&deg;-90&deg;</b> triangle the short leg is <b>"+sh+"</b>. Find the longer leg.",
    unit:"units", placeholder:"exact or decimal",
    check:function(v){ return nearly(parseNum(v),lng); }, answer:sh+"√3 ≈ "+r2(lng),
    steps:["A 30-60-90 triangle is x, x√3, 2x, where x is the short leg across from the 30° angle.",
           "Longer leg = "+sh+"√3 ≈ "+r2(lng)+"."]};
  return {kind:"text", prompt:"In a <b>30&deg;-60&deg;-90&deg;</b> triangle the short leg is <b>"+sh+"</b>. Find the hypotenuse.",
    unit:"units", placeholder:"length",
    check:function(v){ return nearly(parseNum(v),hyp2); }, answer:String(hyp2),
    steps:["The hypotenuse of a 30-60-90 is exactly twice the short leg.",
           "2 × "+sh+" = "+hyp2+"."]};
};

G.similar=function(opt){
  opt=opt||{};
  var mode=modeOf(opt,["side","area","perim"]);
  if(mode==="side"){
    var k=rnd([2,3,1.5,2.5,4]), a=ri(3,12), b=ri(4,15), a2=r2(a*k), b2=r2(b*k);
    return {kind:"text", fig:similarSVG(),
      prompt:"&#9651;ABC ~ &#9651;DEF. AB = <b>"+a+"</b>, DE = <b>"+a2+"</b>, and BC = <b>"+b+"</b>. Find EF.",
      unit:"units", placeholder:"length of EF",
      check:function(v){ return nearly(parseNum(v),b2); }, answer:String(b2),
      steps:["Matching sides give the scale factor: k = DE/AB = "+a2+"/"+a+" = "+k+".",
             "Every length in the big triangle is "+k+" times the small one.",
             "EF = "+b+" × "+k+" = "+b2+"."]};
  }
  if(mode==="area"){
    var A1=ri(4,30), k2=rnd([2,3,4,5]), A2=A1*k2*k2;
    return {kind:"text",
      prompt:"Two similar figures have a scale factor of <b>"+k2+"</b>. The smaller has an area of <b>"+A1+" cm&sup2;</b>. Find the larger area.",
      unit:"cm²", placeholder:"area",
      check:function(v){ return nearly(parseNum(v),A2); }, answer:A2+" cm²",
      steps:["Lengths scale by k, but area scales by k² — area is two dimensions.",
             "k² = "+k2+"² = "+(k2*k2)+".",
             A1+" × "+(k2*k2)+" = "+A2+" cm²."]};
  }
  var s1=ri(2,9), s2=s1*rnd([2,3]), p1=ri(10,40), p2=p1*(s2/s1);
  return {kind:"text",
    prompt:"Two similar polygons have matching sides of <b>"+s1+"</b> and <b>"+s2+"</b>. The smaller has a perimeter of <b>"+p1+"</b>. Find the larger perimeter.",
    unit:"units", placeholder:"perimeter",
    check:function(v){ return nearly(parseNum(v),p2); }, answer:String(p2),
    steps:["k = "+s2+"/"+s1+" = "+(s2/s1)+".",
           "Perimeter is a length, so it scales by k — not k², which is the area rule.",
           p1+" × "+(s2/s1)+" = "+p2+"."]};
};

G.circles=function(opt){
  opt=opt||{};
  var mode=modeOf(opt,["inscribed","arc2ang","arclen","sector","tangent"]);
  if(mode==="inscribed"){
    var arc=ri(20,85)*2, ins=arc/2;
    return {kind:"text", fig:circleSVG(),
      prompt:"An inscribed angle intercepts an arc of <b>"+arc+"&deg;</b>. What is the measure of the angle?",
      unit:"degrees", placeholder:"degrees",
      check:function(v){ return nearly(parseNum(v),ins); }, answer:ins+"°",
      steps:["An inscribed angle has its vertex on the circle, and it is always half of the arc it opens onto.",
             arc+" ÷ 2 = "+ins+"°."]};
  }
  if(mode==="arc2ang"){
    var ang=ri(20,80), arc2=ang*2;
    return {kind:"text",
      prompt:"An inscribed angle measures <b>"+ang+"&deg;</b>. Find the arc it intercepts.",
      unit:"degrees", placeholder:"degrees",
      check:function(v){ return nearly(parseNum(v),arc2); }, answer:arc2+"°",
      steps:["The angle is half the arc, so the arc is twice the angle.",
             "2 × "+ang+" = "+arc2+"°.",
             "A central angle, with its vertex at the middle, would equal the arc instead."]};
  }
  if(mode==="arclen"){
    var r=ri(3,15), th=rnd([30,45,60,90,120,135,150,180]), len=(th/360)*2*PI*r;
    return {kind:"text",
      prompt:"A circle has radius <b>"+r+"</b>. Find the length of an arc with a central angle of <b>"+th+"&deg;</b>. Use &pi; &asymp; 3.14.",
      unit:"units", placeholder:"arc length",
      check:function(v){ return nearly(parseNum(v),len); }, answer:r2(len)+" units",
      steps:["An arc is just a fraction of the way around: (θ/360) × 2πr.",
             "The whole circumference is 2π("+r+") ≈ "+r2(2*PI*r)+", and you want "+th+"/360 of it.",
             "≈ "+r2(len)+"."]};
  }
  if(mode==="sector"){
    var r3=ri(3,14), th3=rnd([30,45,60,90,120,180]), ar=(th3/360)*PI*r3*r3;
    return {kind:"text",
      prompt:"Find the area of a sector with radius <b>"+r3+"</b> and central angle <b>"+th3+"&deg;</b>. Use &pi; &asymp; 3.14.",
      unit:"square units", placeholder:"sector area",
      check:function(v){ return nearly(parseNum(v),ar); }, answer:r2(ar)+" square units",
      steps:["A sector is a slice of pie: (θ/360) × πr².",
             "The whole circle is π("+r3+")² ≈ "+r2(PI*r3*r3)+".",
             "Take "+th3+"/360 of that: ≈ "+r2(ar)+"."]};
  }
  var t=rnd([[3,4,5],[5,12,13],[8,15,17],[6,8,10]]);
  return {kind:"text",
    prompt:"A tangent touches a circle of radius <b>"+t[0]+"</b>. The tangent segment from an outside point P is <b>"+t[1]+"</b>. How far is P from the centre?",
    unit:"units", placeholder:"distance",
    check:function(v){ return nearly(parseNum(v),t[2]); }, answer:String(t[2]),
    steps:["A tangent meets the radius at exactly 90°, so you have a right triangle.",
           "The radius and the tangent are the legs; the distance to the centre is the hypotenuse.",
           t[0]+"² + "+t[1]+"² = "+(t[0]*t[0]+t[1]*t[1])+", so the distance is "+t[2]+"."]};
};

G.coords=function(opt){
  opt=opt||{};
  var mode=modeOf(opt,["dist","mid","slope"]);
  var p1=[ri(-5,5),ri(-5,5)], p2=[ri(-5,5),ri(-5,5)];
  while(p2[0]===p1[0]&&p2[1]===p1[1]) p2=[ri(-5,5),ri(-5,5)];
  var dx=p2[0]-p1[0], dy=p2[1]-p1[1];
  if(mode==="dist"){
    var d=Math.sqrt(dx*dx+dy*dy);
    return {kind:"text", fig:gridSVG(p1,p2),
      prompt:"Find the distance between <b>("+p1.join(", ")+")</b> and <b>("+p2.join(", ")+")</b>.",
      unit:"units", placeholder:"distance",
      check:function(v){ return nearly(parseNum(v),d); }, answer:(Number.isInteger(d)?String(d):"√"+(dx*dx+dy*dy)+" ≈ "+r2(d)),
      steps:["Δx = "+p2[0]+" − ("+p1[0]+") = "+dx+", and Δy = "+p2[1]+" − ("+p1[1]+") = "+dy+".",
             "Those two are the legs of a right triangle, so d = √("+dx+"² + "+dy+"²) = √"+(dx*dx+dy*dy)+".",
             "≈ "+r2(d)+"."]};
  }
  if(mode==="mid"){
    var mx=(p1[0]+p2[0])/2, my=(p1[1]+p2[1])/2;
    return {kind:"point", fig:gridSVG(p1,p2),
      prompt:"Find the midpoint of the segment joining <b>("+p1.join(", ")+")</b> and <b>("+p2.join(", ")+")</b>.",
      check:function(v){ var n=String(v).replace(/[()\s]/g,"").split(","); if(n.length!==2) return false;
        return nearly(parseNum(n[0]),mx) && nearly(parseNum(n[1]),my); },
      answer:"("+mx+", "+my+")",
      steps:["Average the x-values: ("+p1[0]+" + "+p2[0]+")/2 = "+mx+".",
             "Average the y-values: ("+p1[1]+" + "+p2[1]+")/2 = "+my+".",
             "The answer is a point, not a single number: ("+mx+", "+my+")."]};
  }
  if(dx===0){ p2[0]=p1[0]+ri(1,4); dx=p2[0]-p1[0]; }
  var m=dy/dx;
  return {kind:"text", fig:gridSVG(p1,p2),
    prompt:"Find the slope of the line through <b>("+p1.join(", ")+")</b> and <b>("+p2.join(", ")+")</b>.",
    unit:"slope", placeholder:"e.g. 3/4 or 0.75",
    check:function(v){ return nearly(parseNum(v),m); },
    answer:frac(dy,dx)+(Number.isInteger(m)?"":" ≈ "+r2(m)),
    steps:["Slope is rise over run: (y₂ − y₁)/(x₂ − x₁).",
           "("+p2[1]+" − "+p1[1]+")/("+p2[0]+" − "+p1[0]+") = "+dy+"/"+dx+".",
           Number.isInteger(m)? "That reduces to "+m+"." : "Reduced, that is "+frac(dy,dx)+", or about "+r2(m)+"."]};
};

G.solids=function(opt){
  opt=opt||{};
  var mode=modeOf(opt,["tri","trap","circle","cyl","sphere","poly"]);
  if(mode==="tri"){
    var b=ri(4,20), h=ri(3,16), A=0.5*b*h;
    return {kind:"text", prompt:"Find the area of a triangle with base <b>"+b+"</b> and height <b>"+h+"</b>.",
      unit:"square units", placeholder:"area",
      check:function(v){ return nearly(parseNum(v),A); }, answer:String(A),
      steps:["A = ½bh — a triangle is exactly half of the rectangle around it.",
             "½ × "+b+" × "+h+" = "+A+"."]};
  }
  if(mode==="trap"){
    var b1=ri(4,14), b2=ri(6,20), h2=ri(3,12), A2=0.5*(b1+b2)*h2;
    return {kind:"text", prompt:"A trapezoid has parallel sides of <b>"+b1+"</b> and <b>"+b2+"</b> and a height of <b>"+h2+"</b>. Find its area.",
      unit:"square units", placeholder:"area",
      check:function(v){ return nearly(parseNum(v),A2); }, answer:String(A2),
      steps:["A = ½(b₁ + b₂)h — average the two parallel sides, then treat it like a rectangle.",
             "½ × ("+b1+" + "+b2+") × "+h2+" = ½ × "+(b1+b2)+" × "+h2+".",
             "= "+A2+"."]};
  }
  if(mode==="circle"){
    var r=ri(2,12), A3=PI*r*r;
    return {kind:"text", prompt:"Find the area of a circle with radius <b>"+r+"</b>. Use &pi; &asymp; 3.14.",
      unit:"square units", placeholder:"area",
      check:function(v){ return nearly(parseNum(v),A3); }, answer:r2(A3),
      steps:["A = πr². Square the radius first, then multiply by π.",
             "π × "+r+"² = π × "+(r*r)+" ≈ "+r2(A3)+".",
             "If a problem gives the diameter, halve it before you start."]};
  }
  if(mode==="cyl"){
    var r4=ri(2,9), h4=ri(3,15), V=PI*r4*r4*h4;
    return {kind:"text", prompt:"Find the volume of a cylinder with radius <b>"+r4+"</b> and height <b>"+h4+"</b>. Use &pi; &asymp; 3.14.",
      unit:"cubic units", placeholder:"volume",
      check:function(v){ return nearly(parseNum(v),V); }, answer:r2(V),
      steps:["V = πr²h — find the area of the circular base, then stack it up by the height.",
             "Base ≈ "+r2(PI*r4*r4)+", times "+h4+".",
             "≈ "+r2(V)+"."]};
  }
  if(mode==="sphere"){
    var r5=ri(2,9), V5=(4/3)*PI*r5*r5*r5;
    return {kind:"text", prompt:"Find the volume of a sphere with radius <b>"+r5+"</b>. Use &pi; &asymp; 3.14.",
      unit:"cubic units", placeholder:"volume",
      check:function(v){ return nearly(parseNum(v),V5); }, answer:r2(V5),
      steps:["V = ⁴⁄₃πr³.","r³ = "+(r5*r5*r5)+".","⁴⁄₃ × π × "+(r5*r5*r5)+" ≈ "+r2(V5)+"."]};
  }
  var n=ri(3,12), sum=(n-2)*180;
  return {kind:"text", prompt:"What is the sum of the interior angles of a polygon with <b>"+n+"</b> sides?",
    unit:"degrees", placeholder:"degrees",
    check:function(v){ return nearly(parseNum(v),sum); }, answer:sum+"°",
    steps:["Any n-gon splits into n − 2 triangles, and each triangle carries 180°.",
           "("+n+" − 2) × 180 = "+(n-2)+" × 180.",
           "= "+sum+"°."]};
};

/* ---------- the 21-day path ---------- */
var PLAN=[
{t:"Points, lines, and how to write them", min:"8 min", goal:"Read and write the four basic pieces of every figure.",
 teach:[["Geometry starts with three undefined things","A <b>point</b> is a position with no size, a <b>line</b> is straight and goes forever both ways, and a <b>plane</b> is a flat surface that goes forever. Nobody defines them &mdash; everything else is built from them."],
 ["Segments and rays are pieces of a line","A <b>segment</b> has an endpoint at each end. A <b>ray</b> has one endpoint and goes forever the other way, like a beam from a flashlight."],
 ["The mark on top tells you which one","A bar over AB means the segment. A one-way arrow means the ray. A two-way arrow means the whole line. Plain AB with no mark means a number &mdash; the length."]],
 tip:"Order matters for rays only. Ray AB starts at A; ray BA starts at B. They are different rays.",
 drill:{topic:"basics", opt:{modes:["notation","vocab"]}, target:6}},

{t:"Measuring and classifying angles", min:"8 min", goal:"Put a name to any angle from its measure.",
 teach:[["An angle is two rays from one point","That shared point is the <b>vertex</b>, and the amount of turn between the rays is measured in degrees."],
 ["Four names cover everything","Under 90° is <b>acute</b>. Exactly 90° is <b>right</b>, marked with a little square. Between 90° and 180° is <b>obtuse</b>. Exactly 180° is <b>straight</b>."],
 ["Naming an angle","&ang;B names the angle at vertex B. When several angles share a vertex, use three letters with the vertex in the middle: &ang;ABC."]],
 tip:"Acute angles are small and sharp — think <i>a cute</i> little angle. Obtuse ones are the wide, blunt ones.",
 drill:{topic:"anglekinds", opt:{modes:["classify"]}, target:6}},

{t:"Complementary and supplementary", min:"8 min", goal:"Find a missing angle when two angles pair up.",
 teach:[["Complementary angles add to 90°","If one is 37°, the other has to be 53°, because together they make a right angle."],
 ["Supplementary angles add to 180°","If one is 112°, the other is 68°, because together they make a straight line."],
 ["Subtract to find the missing one","There is nothing more to it: 90 minus what you have, or 180 minus what you have. The only real trap is using the wrong total."]],
 tip:"C comes before S in the alphabet, and 90 comes before 180. Complementary is the smaller pair.",
 drill:{topic:"anglekinds", opt:{modes:["comp","supp"]}, target:6}},

{t:"Vertical angles and linear pairs", min:"8 min", goal:"Use two crossing lines to find every angle from just one.",
 teach:[["Crossing lines make four angles","Two of them face each other across the crossing point, and two sit side by side."],
 ["Vertical angles are congruent","The pair across from each other are always equal. This is true whether or not anything is parallel &mdash; it is the most reliable rule in the unit."],
 ["A linear pair is supplementary","Two angles side by side along a straight line add to 180°. Between these two rules, one angle tells you all four."]],
 tip:"Vertical here has nothing to do with up and down. It means the pair sharing only a vertex.",
 drill:{topic:"anglekinds", opt:{modes:["vertical","linear"]}, target:5}},

{t:"Parallel lines and a transversal", min:"10 min", goal:"Name the relationship between any two of the eight angles.",
 teach:[["One line crossing two makes eight angles","The crossing line is the <b>transversal</b>. If the two lines it crosses are parallel, something remarkable happens: only two different sizes exist among all eight."],
 ["Four names for the pairs","<b>Corresponding</b> angles sit in matching corners. <b>Alternate interior</b> are between the lines on opposite sides. <b>Alternate exterior</b> are outside on opposite sides. All three of those are congruent."],
 ["Same-side pairs are supplementary","Angles between the lines on the <i>same</i> side add to 180° instead. So does any linear pair."]],
 tip:"Shortcut for later: angles 1, 4, 5 and 8 are all equal, and so are 2, 3, 6 and 7. One from each group always adds to 180°.",
 drill:{topic:"angles", opt:{modes:["rel"]}, target:5}},

{t:"Finding angle measures", min:"9 min", goal:"Turn one known angle into any other angle in the figure.",
 teach:[["Two questions, in order","First: what is the relationship? Second: does that relationship mean congruent or supplementary?"],
 ["Congruent means copy the number","Corresponding, alternate interior, alternate exterior, and vertical pairs all just carry the measure straight across."],
 ["Supplementary means subtract from 180","Same-side pairs and linear pairs need 180 minus the angle you were given."]],
 tip:"Sanity check your answer against the picture. If the angle looks small and you wrote 130°, something is off.",
 drill:{topic:"angles", opt:{modes:["measure"]}, target:5}},

{t:"Solving for x", min:"10 min", goal:"Handle parallel-line problems written with algebra.",
 teach:[["Same rules, now with a variable","When an angle is written as an expression like (3x + 20)°, the relationship gives you an equation instead of an answer."],
 ["Congruent pairs give an equals sign","If the two angles are corresponding or alternate, set the expressions equal to each other."],
 ["Supplementary pairs sum to 180","Add the two expressions, set the total to 180, then solve normally."]],
 tip:"Solving for x is usually not the last step in class. Check whether the question wants x or the angle measure.",
 drill:{topic:"angles", opt:{modes:["algebra"]}, target:4}},

{t:"Triangles: the angle sum", min:"9 min", goal:"Find a missing angle, and classify a triangle two ways.",
 teach:[["Every triangle totals 180°","Always, no exceptions, whatever the shape. Two angles given means the third is forced."],
 ["Classify by angles","All three under 90° is <b>acute</b>. One right angle is a <b>right</b> triangle. One angle over 90° is <b>obtuse</b>. A triangle can only ever have one angle of 90° or more."],
 ["Classify by sides","No equal sides is <b>scalene</b>, two equal is <b>isosceles</b>, three equal is <b>equilateral</b>. Equal sides sit across from equal angles &mdash; that link comes up constantly."]],
 tip:"An equilateral triangle always has three 60° angles, because 180 ÷ 3 = 60.",
 drill:{topic:"trianglebasics", opt:{}, target:6}},

{t:"Congruent triangles: SSS and SAS", min:"10 min", goal:"Prove two triangles identical from three matching parts.",
 teach:[["Congruent means identical","Same size, same shape. A triangle has six parts &mdash; three sides and three angles &mdash; but you never have to check all six."],
 ["SSS: three pairs of sides","Fix all three side lengths and there is only one triangle you can build. Try it with three sticks: it will not flex."],
 ["SAS: two sides and the angle between them","The angle must be <b>included</b> — sandwiched between the two marked sides. That word is the whole difference between a valid proof and a wrong one."]],
 tip:"Tick marks on a figure show which parts match: one tick matches one tick, two match two.",
 drill:{topic:"congruence", opt:{subset:["SSS","SAS"]}, target:5}},

{t:"ASA, AAS, and HL", min:"10 min", goal:"Recognise the other three shortcuts.",
 teach:[["ASA: two angles and the side between them","The side is included, exactly like the angle in SAS."],
 ["AAS: two angles and a side outside them","Still valid, because two angles give you the third for free — so AAS is really ASA in disguise."],
 ["HL: right triangles only","Hypotenuse plus one leg. It works only when the figure shows a right angle, which is why it has its own name."]],
 tip:"Two triangles that share a side are congruent to themselves on that side — the Reflexive Property. It is very often the third fact you are missing.",
 drill:{topic:"congruence", opt:{subset:["ASA","AAS","HL"]}, target:5}},

{t:"What does not prove congruence", min:"9 min", goal:"Spot the two traps, and mix all five postulates together.",
 teach:[["SSA proves nothing","Two sides and an angle that is <i>not</i> between them can swing shut into two completely different triangles. There is no SSA postulate."],
 ["AAA proves nothing either","Three matching angles fix the shape but not the size. That is similarity, which you will meet on Day 15, not congruence."],
 ["Mixed practice is the real test","Questions rarely announce which postulate applies. Read the marks, note whether the marked angle is between the marked sides, and only then choose."]],
 tip:"Work around the triangle in order — side, angle, side — and read off what you actually see. Do not guess from the shape.",
 drill:{topic:"congruence", opt:{}, target:5}},

{t:"The Pythagorean theorem", min:"9 min", goal:"Find the hypotenuse of a right triangle.",
 teach:[["It only works on right triangles","The rule is a² + b² = c², where a and b are the two legs and c is the hypotenuse."],
 ["c is always across from the right angle","The hypotenuse is the longest side, and it never touches the right angle. Mislabelling it is the most common mistake in this unit."],
 ["Square, add, square-root","3² + 4² = 9 + 16 = 25, and √25 = 5."]],
 tip:"Learn these by heart: 3-4-5, 5-12-13, 8-15-17, 7-24-25. Multiples count too, so 6-8-10 is really 3-4-5 doubled.",
 drill:{topic:"right", opt:{modes:["hyp"]}, target:5}},

{t:"Finding a missing leg", min:"9 min", goal:"Work backwards when the hypotenuse is the side you know.",
 teach:[["Same formula, rearranged","If you know c and one leg, then a² = c² − b². Subtraction, not addition."],
 ["Check which side is the hypotenuse first","It is the one given as the longest, or the one across from the right angle. Everything depends on getting that right."],
 ["An answer bigger than the hypotenuse is wrong","The hypotenuse is always the longest side, so if your leg came out longer, you added when you should have subtracted."]],
 tip:"13² − 5² = 169 − 25 = 144, and √144 = 12. That is the 5-12-13 triangle again.",
 drill:{topic:"right", opt:{modes:["leg"]}, target:5}},

{t:"Special right triangles", min:"10 min", goal:"Get exact answers without the Pythagorean theorem.",
 teach:[["45-45-90 is x, x, x√2","Both legs are equal, and the hypotenuse is a leg times √2. It is half of a square, cut corner to corner."],
 ["30-60-90 is x, x√3, 2x","The short leg sits across from the 30° angle. The hypotenuse is exactly double it, and the longer leg is the short leg times √3."],
 ["Match sides to angles","Biggest angle, longest side. That check tells you instantly whether you assigned the sides correctly."]],
 tip:"You can type answers as 5sqrt2 or as 7.07 — both are accepted here.",
 drill:{topic:"right", opt:{modes:["sp45","sp30"]}, target:5}},

{t:"Similar figures and scale factor", min:"9 min", goal:"Find a missing side in a scaled copy.",
 teach:[["Similar means same shape, different size","All matching angles are equal, and every side is multiplied by the same number."],
 ["That number is the scale factor, k","k = new length ÷ old length. Find it from a pair of sides you know, then apply it to the side you want."],
 ["AA is enough to prove it","Two pairs of equal angles proves two triangles similar. You never need to check a side."]],
 tip:"Read the similarity statement in order: △ABC ~ △DEF means A pairs with D, so side AB pairs with side DE.",
 drill:{topic:"similar", opt:{modes:["side"]}, target:5}},

{t:"Perimeter and area ratios", min:"9 min", goal:"Scale up a perimeter, an area, and a volume correctly.",
 teach:[["Perimeter scales by k","It is a length, so it grows at the same rate as the sides."],
 ["Area scales by k²","Double every side and the area quadruples — area covers two dimensions, so the factor gets squared."],
 ["Volume scales by k³","Same reasoning, one dimension further. Doubling the sides makes eight times the volume."]],
 tip:"Given an area ratio and asked for the side ratio, square-root it. The two directions come up equally often.",
 drill:{topic:"similar", opt:{modes:["area","perim"]}, target:5}},

{t:"Distance on the coordinate plane", min:"9 min", goal:"Measure between two points using their coordinates.",
 teach:[["It is the Pythagorean theorem again","The horizontal gap and the vertical gap are the legs of a right triangle, and the distance is the hypotenuse."],
 ["The formula","d = √((x₂ − x₁)² + (y₂ − y₁)²). Subtract, square, add, square-root."],
 ["Negatives take care of themselves","Squaring makes everything positive, so the order you subtract in does not change the answer."]],
 tip:"Sketch the two points before calculating. The picture catches sign errors that the formula hides.",
 drill:{topic:"coords", opt:{modes:["dist"]}, target:5}},

{t:"Midpoint and slope", min:"10 min", goal:"Find the centre of a segment, and how steep it is.",
 teach:[["Midpoint is an average","((x₁+x₂)/2, (y₁+y₂)/2). Average the x's, average the y's. The answer is a point, so write it in parentheses."],
 ["Slope is rise over run","(y₂ − y₁)/(x₂ − x₁). Keep both subtractions in the same order or the sign flips."],
 ["Slopes reveal shapes","Parallel lines have equal slopes. Perpendicular slopes are opposite reciprocals — 2/3 and −3/2 — and multiply to −1."]],
 tip:"Horizontal lines have slope 0. Vertical lines have undefined slope, because the run is zero and you cannot divide by it.",
 drill:{topic:"coords", opt:{modes:["mid","slope"]}, target:5}},

{t:"Circles: central and inscribed angles", min:"9 min", goal:"Connect any angle in a circle to its arc.",
 teach:[["Every circle rule is about the arc","An arc is measured in degrees, and the whole way around is 360°."],
 ["A central angle equals its arc","Vertex at the centre. A 70° central angle cuts a 70° arc — the same number."],
 ["An inscribed angle is half its arc","Vertex on the circle instead. The same arc gives every inscribed angle on it the same measure, and an angle inscribed in a semicircle is always 90°."]],
 tip:"Where is the vertex? At the centre, the angle equals the arc. On the circle, halve it.",
 drill:{topic:"circles", opt:{modes:["inscribed","arc2ang"]}, target:5}},

{t:"Arc length and sector area", min:"9 min", goal:"Take a fraction of a circle.",
 teach:[["Start with the whole circle","Circumference is 2πr and area is πr². Every arc and sector question begins with one of those two."],
 ["Then take your slice","A θ° angle covers θ/360 of the circle. Arc length = (θ/360) × 2πr, and sector area = (θ/360) × πr²."],
 ["Degrees stay out of the answer","Arc length comes out in units, sector area in square units. A leftover degree sign means the fraction was not applied."]],
 tip:"90° is a quarter, 180° is a half, 120° is a third. Recognising the common fractions saves real time.",
 drill:{topic:"circles", opt:{modes:["arclen","sector"]}, target:5}},

{t:"Area and volume", min:"10 min", goal:"Use the formula sheet from memory.",
 teach:[["Area formulas share one idea","A rectangle is bh. A triangle is half of that. A trapezoid averages its two parallel sides first, then behaves like a rectangle."],
 ["Height means perpendicular height","Not the slanted side. In a trapezoid or parallelogram, the height is the straight-up distance between the parallel sides."],
 ["Volume is base area times height","Prisms and cylinders are V = Bh. Pyramids and cones are exactly one third of that, and a sphere is ⁴⁄₃πr³."]],
 tip:"Area is squared units, volume is cubed. Getting the units right often earns a mark on its own.",
 drill:{topic:"solids", opt:{}, target:6}}
];

export const GEO = {
  id: "geometry",
  name: "Compass and Proof",
  storeKey: "compassproof",
  generators: G,
  plan: PLAN,
  bodyClass: "pad",
  labelClass: "label",
  finale: "Twenty-one days, first semester covered. Now go build a two-column proof in the library below — it is the one thing on the final that is not a calculation.",
  firstVisit: "Start at Day 1 — it assumes you have never taken geometry."
};
export { G, PLAN, transversalSVG, trianglePairSVG, similarSVG, circleSVG, rightSVG, gridSVG, r2 };
