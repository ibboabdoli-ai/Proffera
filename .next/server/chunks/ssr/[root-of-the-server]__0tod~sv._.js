module.exports=[193695,(a,b,c)=>{b.exports=a.x("next/dist/shared/lib/no-fallback-error.external.js",()=>require("next/dist/shared/lib/no-fallback-error.external.js"))},971306,(a,b,c)=>{b.exports=a.r(918622)},179847,a=>{a.n(a.i(403343))},9185,a=>{a.n(a.i(729432))},872842,a=>{a.n(a.i(275164))},454897,a=>{a.n(a.i(330106))},856157,a=>{a.n(a.i(118970))},594331,a=>{a.n(a.i(860644))},715988,a=>{a.n(a.i(856952))},625766,a=>{a.n(a.i(777341))},529725,a=>{a.n(a.i(994290))},605785,a=>{a.n(a.i(790588))},874793,a=>{a.n(a.i(633169))},285826,a=>{a.n(a.i(437111))},721565,a=>{a.n(a.i(741763))},465911,a=>{a.n(a.i(708950))},225128,a=>{a.n(a.i(891562))},740781,a=>{a.n(a.i(449670))},69411,a=>{a.n(a.i(675700))},263081,a=>{a.n(a.i(200276))},862837,a=>{a.n(a.i(640795))},134607,a=>{a.n(a.i(611614))},296338,a=>{a.n(a.i(521751))},550642,a=>{a.n(a.i(512213))},232242,a=>{a.n(a.i(22693))},988530,a=>{a.n(a.i(10531))},508583,a=>{a.n(a.i(901082))},38534,a=>{a.n(a.i(698175))},670408,a=>{a.n(a.i(409095))},722922,a=>{a.n(a.i(496772))},578294,a=>{a.n(a.i(971717))},216625,a=>{a.n(a.i(585034))},488648,a=>{a.n(a.i(368113))},451914,a=>{a.n(a.i(466482))},725466,a=>{a.n(a.i(91505))},689257,a=>{"use strict";var b=a.i(295946);function c(a,b){return a.toLowerCase().includes(b.toLowerCase())}async function d(){let a=(0,b.getSql)();if(!a)return{ok:!1,message:"Databasen är inte konfigurerad.",matches:[]};try{let b=await a`
      select id, reference_id, category, service_type, city, postal_code, description, status, created_at
      from quote_requests
      order by created_at desc
      limit 50
    `,d=await a`
      select id, reference_id, company_name, organization_number, contact_person, email, phone, city,
        service_areas, services, description, status, created_at
      from company_registrations
      order by created_at desc
      limit 200
    `,e=b.map(a=>{let b=d.map(b=>{let d,e,f=(d=0,e=[],(c(b.city,a.city)||c(b.service_areas,a.city))&&(d+=50,e.push("område")),c(b.services,a.category)&&(d+=35,e.push("kategori")),c(b.services,a.service_type)&&(d+=20,e.push("tjänst")),"approved"===b.status&&(d+=10,e.push("godkänt företag")),{score:d,reasons:e});return{...b,score:f.score,reasons:f.reasons}}).filter(a=>a.score>=50).sort((a,b)=>b.score-a.score).slice(0,10);return{lead:a,companies:b}});return{ok:!0,matches:e}}catch{return{ok:!1,message:"Kunde inte läsa matchningar.",matches:[]}}}a.s(["getLeadMatches",0,d])},248286,a=>{"use strict";var b=a.i(907997),c=a.i(689257);async function d(){let a=await (0,c.getLeadMatches)();return(0,b.jsxs)("main",{style:{padding:24,maxWidth:1100,margin:"0 auto"},children:[(0,b.jsx)("h1",{children:"Skicka lead"}),(0,b.jsx)("p",{children:(0,b.jsx)("a",{href:"/admin/matchning",children:"Till matchning"})}),a.ok?null:(0,b.jsx)("p",{children:a.message}),a.matches.map(a=>(0,b.jsxs)("section",{style:{border:"1px solid #ddd",borderRadius:12,padding:16,marginBottom:18},children:[(0,b.jsx)("h2",{children:a.lead.reference_id}),(0,b.jsxs)("p",{children:[a.lead.category," / ",a.lead.service_type," / ",a.lead.city]}),0===a.companies.length?(0,b.jsx)("p",{children:"Inga matchade företag."}):null,a.companies.map(c=>{var d,e,f,g;let h,i;return(0,b.jsxs)("article",{style:{background:"#f7f7f4",borderRadius:10,padding:12,marginTop:10},children:[(0,b.jsx)("strong",{children:c.company_name}),(0,b.jsx)("p",{children:c.email}),(0,b.jsxs)("p",{children:["Score: ",c.score]}),(0,b.jsx)("a",{href:(d=c.email,e=a.lead.reference_id,f=a.lead.category,g=a.lead.city,h=`Ny f\xf6rfr\xe5gan fr\xe5n Proffera: ${f} i ${g}`,i=`Hej,

Ni har en matchad f\xf6rfr\xe5gan i Proffera.

Referens: ${e}
Kategori: ${f}
Ort: ${g}

Med v\xe4nliga h\xe4lsningar
Proffera`,`mailto:${encodeURIComponent(d)}?subject=${encodeURIComponent(h)}&body=${encodeURIComponent(i)}`),style:{display:"inline-block",marginTop:8},children:"Öppna mejl till företag"})]},c.id)})]},a.lead.id))]})}a.s(["default",0,d,"dynamic",0,"force-dynamic"])},148802,a=>{a.n(a.i(248286))}];

//# sourceMappingURL=%5Broot-of-the-server%5D__0tod~sv._.js.map