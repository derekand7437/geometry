import { $, $$ } from "./util.js";
import { bump } from "./store.js";
import { transversalSVG, trianglePairSVG, similarSVG, circleSVG, rightSVG, r2 } from "./geo-content.js";

export function mountExtras(){
  /* ---------- static figures ---------- */
  $("#fig-transversal").innerHTML=transversalSVG([])+'<figcaption>Lines l and m are parallel; t is the transversal.</figcaption>';
  $("#fig-congruence").innerHTML=trianglePairSVG({AB:1,BC:2,AC:3})+'<figcaption>Matching tick marks mean matching parts — here, SSS.</figcaption>';
  $("#fig-similar").innerHTML=similarSVG()+'<figcaption>Same angles, every side multiplied by the same number.</figcaption>';
  $("#fig-circle").innerHTML=circleSVG()+'<figcaption>Both angles open onto arc AB; the inscribed one is half the central one.</figcaption>';
  
  /* ---------- live right-triangle solver ---------- */
  var la=$("#leg-a"), lb=$("#leg-b");
  function drawSolver(){
    var a=parseFloat(la.value), b=parseFloat(lb.value);
    if(!isFinite(a)||a<=0) a=3; if(!isFinite(b)||b<=0) b=4;
    var c=Math.sqrt(a*a+b*b);
    $("#fig-right").innerHTML=rightSVG(a,b)+'<figcaption>The figure redraws to scale as you type.</figcaption>';
    $("#out-c").textContent=r2(c);
    $("#out-area").textContent=r2(a*b/2);
    $("#out-p").textContent=r2(a+b+c);
  }
  la.addEventListener("input",drawSolver); lb.addEventListener("input",drawSolver); drawSolver();
  
  /* ---------- two-column proofs ---------- */
  var BANK=["Given","Definition of a linear pair","Linear Pair Postulate","Vertical Angles Theorem",
  "Substitution Property","Subtraction Property of Equality","Reflexive Property","Definition of an angle bisector",
  "Corresponding Angles Postulate","Transitive Property","SSS","SAS","ASA","Definition of a midpoint"];
  var PROOFS=[
  {name:"Vertical angles",
   given:"Lines AB and CD intersect at point E.", prove:"&ang;1 &cong; &ang;2",
   rows:[
    ["&ang;1 and &ang;3 are a linear pair; &ang;2 and &ang;3 are a linear pair","Definition of a linear pair"],
    ["m&ang;1 + m&ang;3 = 180&deg;","Linear Pair Postulate"],
    ["m&ang;2 + m&ang;3 = 180&deg;","Linear Pair Postulate"],
    ["m&ang;1 + m&ang;3 = m&ang;2 + m&ang;3","Substitution Property"],
    ["m&ang;1 = m&ang;2, so &ang;1 &cong; &ang;2","Subtraction Property of Equality"]
   ]},
  {name:"Angle bisector",
   given:"BD bisects &ang;ABC, and AB &cong; CB.", prove:"&#9651;ABD &cong; &#9651;CBD",
   rows:[
    ["AB &cong; CB","Given"],
    ["BD bisects &ang;ABC","Given"],
    ["&ang;ABD &cong; &ang;CBD","Definition of an angle bisector"],
    ["BD &cong; BD","Reflexive Property"],
    ["&#9651;ABD &cong; &#9651;CBD","SAS"]
   ]},
  {name:"Alternate exterior angles",
   given:"Line l &#8741; line m, cut by transversal t.", prove:"&ang;1 &cong; &ang;8",
   rows:[
    ["l &#8741; m","Given"],
    ["&ang;1 &cong; &ang;5","Corresponding Angles Postulate"],
    ["&ang;5 &cong; &ang;8","Vertical Angles Theorem"],
    ["&ang;1 &cong; &ang;8","Transitive Property"]
   ]}
  ];
  var pIdx=0;
  function renderProof(){
    var p=PROOFS[pIdx];
    var h='<div class="gp"><div><span class="label">Given</span><p>'+p.given+'</p></div><div><span class="label">Prove</span><p>'+p.prove+'</p></div></div>';
    if(pIdx===2) h+='<figure style="margin-bottom:20px">'+transversalSVG([1,8])+'</figure>';
    h+='<table class="proof"><thead><tr><th></th><th>Statement</th><th>Reason</th></tr></thead><tbody>';
    p.rows.forEach(function(r,i){
      h+='<tr><td>'+(i+1)+'.</td><td>'+r[0]+'</td><td><select class="in mono" data-i="'+i+'" aria-label="Reason for statement '+(i+1)+'"><option value="">choose a reason…</option>'+
        BANK.map(function(b){return '<option>'+b+'</option>'}).join("")+'</select></td></tr>';
    });
    h+='</tbody></table><div class="btns"><button class="btn primary" id="p-check">Check the proof</button><button class="btn" id="p-show">Show the reasons</button></div><div class="fb" id="p-fb" role="status" aria-live="polite"></div>';
    $("#proof-host").innerHTML=h;
    $("#p-check").addEventListener("click",function(){
      var right=0, total=p.rows.length, blank=false;
      $$("#proof-host select").forEach(function(s,i){
        s.classList.remove("right","wrong");
        if(!s.value){ blank=true; return; }
        if(s.value===p.rows[i][1]){ s.classList.add("right"); right++; } else s.classList.add("wrong");
      });
      var fb=$("#p-fb"); fb.className="fb show "+(right===total?"good":"bad");
      fb.textContent = blank? "Fill in every reason before checking."
        : right===total? "Every reason is correct — that is a complete proof."
        : right+" of "+total+" reasons are right. The red rows are the ones to rethink.";
      if(!blank) bump("proofs", right===total);
    });
    $("#p-show").addEventListener("click",function(){
      $$("#proof-host select").forEach(function(s,i){ s.value=p.rows[i][1]; s.classList.remove("wrong"); s.classList.add("right"); });
      var fb=$("#p-fb"); fb.className="fb show good"; fb.textContent="These are the reasons. Read down the column — each line has to be legal before the next one is.";
    });
  }
  $("#proof-pick").innerHTML=PROOFS.map(function(p,i){return '<button class="btn'+(i===0?" primary":"")+'" data-p="'+i+'">'+p.name+'</button>'}).join("");
  $$("#proof-pick .btn").forEach(function(b){
    b.addEventListener("click",function(){
      pIdx=+b.dataset.p;
      $$("#proof-pick .btn").forEach(function(x){x.classList.remove("primary")});
      b.classList.add("primary");
      renderProof();
    });
  });
  renderProof();
}
