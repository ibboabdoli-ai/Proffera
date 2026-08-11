module.exports=[708174,a=>{"use strict";a.s(["default",()=>b]);let b=(0,a.i(211857).registerClientReference)(function(){throw Error("Attempted to call the default export of [project]/node_modules/lucide-react/dist/esm/Icon.mjs <module evaluation> from the server, but it's on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.")},"[project]/node_modules/lucide-react/dist/esm/Icon.mjs <module evaluation>","default")},990697,a=>{"use strict";a.s(["default",()=>b]);let b=(0,a.i(211857).registerClientReference)(function(){throw Error("Attempted to call the default export of [project]/node_modules/lucide-react/dist/esm/Icon.mjs from the server, but it's on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.")},"[project]/node_modules/lucide-react/dist/esm/Icon.mjs","default")},653808,a=>{"use strict";a.i(708174);var b=a.i(990697);a.n(b)},892277,a=>{"use strict";var b=a.i(800717);let c=a=>{let b=a.replace(/^([A-Z])|[\s-_]+(\w)/g,(a,b,c)=>c?c.toUpperCase():b.toLowerCase());return b.charAt(0).toUpperCase()+b.slice(1)};var d=a.i(653808);a.s(["default",0,(a,e)=>{let f=(0,b.forwardRef)(({className:f,...g},h)=>(0,b.createElement)(d.default,{ref:h,iconNode:e,className:((...a)=>a.filter((a,b,c)=>!!a&&""!==a.trim()&&c.indexOf(a)===b).join(" ").trim())(`lucide-${c(a).replace(/([a-z0-9])([A-Z])/g,"$1-$2").toLowerCase()}`,`lucide-${a}`,f),...g}));return f.displayName=c(a),f}],892277)},920916,(a,b,c)=>{"use strict";Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"ReadonlyURLSearchParams",{enumerable:!0,get:function(){return e}});class d extends Error{constructor(){super("Method unavailable on `ReadonlyURLSearchParams`. Read more: https://nextjs.org/docs/app/api-reference/functions/use-search-params#updating-searchparams")}}class e extends URLSearchParams{append(){throw new d}delete(){throw new d}set(){throw new d}sort(){throw new d}}("function"==typeof c.default||"object"==typeof c.default&&null!==c.default)&&void 0===c.default.__esModule&&(Object.defineProperty(c.default,"__esModule",{value:!0}),Object.assign(c.default,c),b.exports=c.default)},21170,(a,b,c)=>{"use strict";Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"RedirectStatusCode",{enumerable:!0,get:function(){return e}});var d,e=((d={})[d.SeeOther=303]="SeeOther",d[d.TemporaryRedirect=307]="TemporaryRedirect",d[d.PermanentRedirect=308]="PermanentRedirect",d);("function"==typeof c.default||"object"==typeof c.default&&null!==c.default)&&void 0===c.default.__esModule&&(Object.defineProperty(c.default,"__esModule",{value:!0}),Object.assign(c.default,c),b.exports=c.default)},328859,(a,b,c)=>{"use strict";Object.defineProperty(c,"__esModule",{value:!0});var d={REDIRECT_ERROR_CODE:function(){return g},isRedirectError:function(){return h}};for(var e in d)Object.defineProperty(c,e,{enumerable:!0,get:d[e]});let f=a.r(21170),g="NEXT_REDIRECT";function h(a){if("object"!=typeof a||null===a||!("digest"in a)||"string"!=typeof a.digest)return!1;let b=a.digest.split(";"),[c,d]=b,e=b.slice(2,-2).join(";"),h=Number(b.at(-2));return c===g&&("replace"===d||"push"===d)&&"string"==typeof e&&!isNaN(h)&&h in f.RedirectStatusCode}("function"==typeof c.default||"object"==typeof c.default&&null!==c.default)&&void 0===c.default.__esModule&&(Object.defineProperty(c.default,"__esModule",{value:!0}),Object.assign(c.default,c),b.exports=c.default)},844868,(a,b,c)=>{"use strict";Object.defineProperty(c,"__esModule",{value:!0});var d={getRedirectError:function(){return i},getRedirectStatusCodeFromError:function(){return n},getRedirectTypeFromError:function(){return m},getURLFromRedirectError:function(){return l},permanentRedirect:function(){return k},redirect:function(){return j}};for(var e in d)Object.defineProperty(c,e,{enumerable:!0,get:d[e]});let f=a.r(21170),g=a.r(328859),h=a.r(120635).actionAsyncStorage;function i(a,b,c=f.RedirectStatusCode.TemporaryRedirect){let d=Object.defineProperty(Error(g.REDIRECT_ERROR_CODE),"__NEXT_ERROR_CODE",{value:"E394",enumerable:!1,configurable:!0});return d.digest=`${g.REDIRECT_ERROR_CODE};${b};${a};${c};`,d}function j(a,b){throw i(a,b??=h?.getStore()?.isAction?"push":"replace",f.RedirectStatusCode.TemporaryRedirect)}function k(a,b="replace"){throw i(a,b,f.RedirectStatusCode.PermanentRedirect)}function l(a){return(0,g.isRedirectError)(a)?a.digest.split(";").slice(2,-2).join(";"):null}function m(a){if(!(0,g.isRedirectError)(a))throw Object.defineProperty(Error("Not a redirect error"),"__NEXT_ERROR_CODE",{value:"E260",enumerable:!1,configurable:!0});return a.digest.split(";",2)[1]}function n(a){if(!(0,g.isRedirectError)(a))throw Object.defineProperty(Error("Not a redirect error"),"__NEXT_ERROR_CODE",{value:"E260",enumerable:!1,configurable:!0});return Number(a.digest.split(";").at(-2))}("function"==typeof c.default||"object"==typeof c.default&&null!==c.default)&&void 0===c.default.__esModule&&(Object.defineProperty(c.default,"__esModule",{value:!0}),Object.assign(c.default,c),b.exports=c.default)},789798,(a,b,c)=>{"use strict";Object.defineProperty(c,"__esModule",{value:!0});var d={HTTPAccessErrorStatus:function(){return f},HTTP_ERROR_FALLBACK_ERROR_CODE:function(){return h},getAccessFallbackErrorTypeByStatus:function(){return k},getAccessFallbackHTTPStatus:function(){return j},isHTTPAccessFallbackError:function(){return i}};for(var e in d)Object.defineProperty(c,e,{enumerable:!0,get:d[e]});let f={NOT_FOUND:404,FORBIDDEN:403,UNAUTHORIZED:401},g=new Set(Object.values(f)),h="NEXT_HTTP_ERROR_FALLBACK";function i(a){if("object"!=typeof a||null===a||!("digest"in a)||"string"!=typeof a.digest)return!1;let[b,c]=a.digest.split(";");return b===h&&g.has(Number(c))}function j(a){return Number(a.digest.split(";")[1])}function k(a){switch(a){case 401:return"unauthorized";case 403:return"forbidden";case 404:return"not-found";default:return}}("function"==typeof c.default||"object"==typeof c.default&&null!==c.default)&&void 0===c.default.__esModule&&(Object.defineProperty(c.default,"__esModule",{value:!0}),Object.assign(c.default,c),b.exports=c.default)},416155,(a,b,c)=>{"use strict";Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"notFound",{enumerable:!0,get:function(){return f}});let d=a.r(789798),e=`${d.HTTP_ERROR_FALLBACK_ERROR_CODE};404`;function f(){let a=Object.defineProperty(Error(e),"__NEXT_ERROR_CODE",{value:"E1041",enumerable:!1,configurable:!0});throw a.digest=e,a}("function"==typeof c.default||"object"==typeof c.default&&null!==c.default)&&void 0===c.default.__esModule&&(Object.defineProperty(c.default,"__esModule",{value:!0}),Object.assign(c.default,c),b.exports=c.default)},934557,(a,b,c)=>{"use strict";function d(){throw Object.defineProperty(Error("`forbidden()` is experimental and only allowed to be enabled when `experimental.authInterrupts` is enabled."),"__NEXT_ERROR_CODE",{value:"E488",enumerable:!1,configurable:!0})}Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"forbidden",{enumerable:!0,get:function(){return d}}),a.r(789798).HTTP_ERROR_FALLBACK_ERROR_CODE,("function"==typeof c.default||"object"==typeof c.default&&null!==c.default)&&void 0===c.default.__esModule&&(Object.defineProperty(c.default,"__esModule",{value:!0}),Object.assign(c.default,c),b.exports=c.default)},493845,(a,b,c)=>{"use strict";function d(){throw Object.defineProperty(Error("`unauthorized()` is experimental and only allowed to be used when `experimental.authInterrupts` is enabled."),"__NEXT_ERROR_CODE",{value:"E411",enumerable:!1,configurable:!0})}Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"unauthorized",{enumerable:!0,get:function(){return d}}),a.r(789798).HTTP_ERROR_FALLBACK_ERROR_CODE,("function"==typeof c.default||"object"==typeof c.default&&null!==c.default)&&void 0===c.default.__esModule&&(Object.defineProperty(c.default,"__esModule",{value:!0}),Object.assign(c.default,c),b.exports=c.default)},473808,(a,b,c)=>{"use strict";Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"isPostpone",{enumerable:!0,get:function(){return e}});let d=Symbol.for("react.postpone");function e(a){return"object"==typeof a&&null!==a&&a.$$typeof===d}},401567,(a,b,c)=>{"use strict";Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"isNextRouterError",{enumerable:!0,get:function(){return f}});let d=a.r(789798),e=a.r(328859);function f(a){return(0,e.isRedirectError)(a)||(0,d.isHTTPAccessFallbackError)(a)}("function"==typeof c.default||"object"==typeof c.default&&null!==c.default)&&void 0===c.default.__esModule&&(Object.defineProperty(c.default,"__esModule",{value:!0}),Object.assign(c.default,c),b.exports=c.default)},894783,(a,b,c)=>{"use strict";Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"unstable_rethrow",{enumerable:!0,get:function(){return function a(b){if((0,g.isNextRouterError)(b)||(0,f.isBailoutToCSRError)(b)||(0,i.isDynamicServerError)(b)||(0,h.isDynamicPostpone)(b)||(0,e.isPostpone)(b)||(0,d.isHangingPromiseRejectionError)(b)||(0,h.isPrerenderInterruptedError)(b))throw b;b instanceof Error&&"cause"in b&&a(b.cause)}}});let d=a.r(13091),e=a.r(473808),f=a.r(149640),g=a.r(401567),h=a.r(660384),i=a.r(696556);("function"==typeof c.default||"object"==typeof c.default&&null!==c.default)&&void 0===c.default.__esModule&&(Object.defineProperty(c.default,"__esModule",{value:!0}),Object.assign(c.default,c),b.exports=c.default)},260968,(a,b,c)=>{"use strict";Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"unstable_rethrow",{enumerable:!0,get:function(){return d}});let d=a.r(894783).unstable_rethrow;("function"==typeof c.default||"object"==typeof c.default&&null!==c.default)&&void 0===c.default.__esModule&&(Object.defineProperty(c.default,"__esModule",{value:!0}),Object.assign(c.default,c),b.exports=c.default)},673727,(a,b,c)=>{"use strict";Object.defineProperty(c,"__esModule",{value:!0});var d={ReadonlyURLSearchParams:function(){return f.ReadonlyURLSearchParams},RedirectType:function(){return m},forbidden:function(){return i.forbidden},notFound:function(){return h.notFound},permanentRedirect:function(){return g.permanentRedirect},redirect:function(){return g.redirect},unauthorized:function(){return j.unauthorized},unstable_isUnrecognizedActionError:function(){return l},unstable_rethrow:function(){return k.unstable_rethrow}};for(var e in d)Object.defineProperty(c,e,{enumerable:!0,get:d[e]});let f=a.r(920916),g=a.r(844868),h=a.r(416155),i=a.r(934557),j=a.r(493845),k=a.r(260968);function l(){throw Object.defineProperty(Error("`unstable_isUnrecognizedActionError` can only be used on the client."),"__NEXT_ERROR_CODE",{value:"E776",enumerable:!1,configurable:!0})}let m={push:"push",replace:"replace"};("function"==typeof c.default||"object"==typeof c.default&&null!==c.default)&&void 0===c.default.__esModule&&(Object.defineProperty(c.default,"__esModule",{value:!0}),Object.assign(c.default,c),b.exports=c.default)},570396,a=>{"use strict";a.i(673727),a.s([])},137936,(a,b,c)=>{"use strict";Object.defineProperty(c,"__esModule",{value:!0}),Object.defineProperty(c,"registerServerReference",{enumerable:!0,get:function(){return d.registerServerReference}});let d=a.r(211857)},881005,a=>{"use strict";let b=(0,a.i(892277).default)("map-pin",[["path",{d:"M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0",key:"1r0f0z"}],["circle",{cx:"12",cy:"10",r:"3",key:"ilqhr7"}]]);a.s(["MapPin",0,b],881005)},15210,a=>{"use strict";var b=a.i(666680),c=a.i(856778);function d(a){return a.replace(/[&<>'"]/g,a=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[a]??a)}async function e(a){let b=process.env.BREVO_API_KEY,c=process.env.LEAD_FROM_EMAIL;if(!b||!c)return{ok:!1,message:"Email provider is not configured."};let e=a.expiresMinutes??10,f="en"===a.language,g=f?`${a.code} is your verification code for ${a.companyName}`:`${a.code} \xe4r din verifieringskod f\xf6r ${a.companyName}`,h=f?`${a.code} is your verification code.

Use this code to verify your booking with ${a.companyName}.
The code is valid for ${e} minutes.

Hi ${a.customerName},
Your booking is created only after the code is verified.
If you did not make this booking, you can ignore this email.`:`${a.code} \xe4r din verifieringskod.

Anv\xe4nd koden f\xf6r att verifiera din bokning hos ${a.companyName}.
Koden g\xe4ller i ${e} minuter.

Hej ${a.customerName},
Bokningen skapas f\xf6rst n\xe4r koden har verifierats.
Om du inte gjorde bokningen kan du ignorera mejlet.`,i=f?`
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#17201a;max-width:620px;margin:0 auto">
      <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${d(a.code)} is your verification code for ${d(a.companyName)}.</div>
      <p style="font-size:14px;color:#667168;margin:0 0 8px">Verification code</p>
      <p style="font-size:40px;font-weight:800;letter-spacing:10px;margin:0 0 24px;color:#17452f">${d(a.code)}</p>
      <p>Hi ${d(a.customerName)},</p>
      <p>Use the code above to verify your booking with <strong>${d(a.companyName)}</strong>.</p>
      <p>The code is valid for ${e} minutes. Your booking is created only after the code is verified.</p>
      <p style="font-size:13px;color:#667168">If you did not make this booking, you can ignore this email.</p>
    </div>
  `:`
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#17201a;max-width:620px;margin:0 auto">
      <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${d(a.code)} \xe4r din verifieringskod f\xf6r ${d(a.companyName)}.</div>
      <p style="font-size:14px;color:#667168;margin:0 0 8px">Verifieringskod</p>
      <p style="font-size:40px;font-weight:800;letter-spacing:10px;margin:0 0 24px;color:#17452f">${d(a.code)}</p>
      <p>Hej ${d(a.customerName)},</p>
      <p>Anv\xe4nd koden ovan f\xf6r att verifiera din bokning hos <strong>${d(a.companyName)}</strong>.</p>
      <p>Koden g\xe4ller i ${e} minuter. Bokningen skapas f\xf6rst n\xe4r koden har verifierats.</p>
      <p style="font-size:13px;color:#667168">Om du inte gjorde bokningen kan du ignorera mejlet.</p>
    </div>
  `;try{let d,e=await fetch("https://api.brevo.com/v3/smtp/email",{method:"POST",headers:{"api-key":b,"Content-Type":"application/json"},body:JSON.stringify({sender:(d=c.match(/^\s*(.*?)\s*<([^>]+)>\s*$/))?{name:d[1]||"Proffera",email:d[2]}:{name:"Proffera",email:c.trim()},to:[{email:a.customerEmail,name:a.customerName}],subject:g,textContent:h,htmlContent:i})}),f=await e.json().catch(()=>({}));return e.ok?{ok:!0,providerId:f.messageId??null}:{ok:!1,message:f.message??f.code??"Email delivery failed."}}catch{return{ok:!1,message:"Email delivery failed."}}}function f(a){return a.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}function g(a,b="Europe/Stockholm"){let c=new Date(a);return Number.isNaN(c.getTime())?a:new Intl.DateTimeFormat("sv-SE",{timeZone:b,dateStyle:"full",timeStyle:"short"}).format(c)}async function h(a){let b,c,d,e,h=process.env.BREVO_API_KEY,i=process.env.LEAD_FROM_EMAIL;if(!h||!i)return{ok:!1,message:"Brevo är inte konfigurerat."};let j=(b=i.match(/^(.+?)\s*<([^>]+)>$/))?{name:b[1].trim(),email:b[2].trim()}:{name:"Proffera",email:i.trim()},k=(c=g(a.startsAt,a.timeZone),d=g(a.endsAt,a.timeZone),e=`Bokningsf\xf6rfr\xe5gan mottagen – ${a.companyName}`,{subject:e,text:[`Hej ${a.customerName},`,"",`Vi har tagit emot din bokningsf\xf6rfr\xe5gan hos ${a.companyName}.`,"",`Tj\xe4nst: ${a.service}`,`Start: ${c}`,`Slut: ${d}`,a.city?`Ort: ${a.city}`:"","","Företaget bekräftar tiden separat.","Du kan se, boka om eller avboka bokningen via din privata bokningssida:",a.portalUrl,"","Boka om direkt:",a.rescheduleUrl,"","Länkarna är personliga. Dela dem inte med andra.","","Med vänliga hälsningar",a.companyName,"Powered by Proffera"].filter(Boolean).join("\n"),html:`
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#17201a;max-width:640px;margin:0 auto;">
      <div style="border:1px solid #dfe6df;border-radius:20px;overflow:hidden;background:#ffffff;">
        <div style="background:#173e2b;color:#ffffff;padding:24px 28px;">
          <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#dce9df;">Bokningsf\xf6rfr\xe5gan</p>
          <h1 style="margin:8px 0 0;font-size:25px;line-height:1.25;">${f(a.companyName)}</h1>
        </div>
        <div style="padding:26px 28px;">
          <p>Hej ${f(a.customerName)},</p>
          <p>Vi har tagit emot din bokningsf\xf6rfr\xe5gan. F\xf6retaget bekr\xe4ftar tiden separat.</p>
          <table role="presentation" style="width:100%;border-collapse:collapse;margin:22px 0;background:#f4f7f3;border-radius:14px;">
            <tr><td style="padding:14px 16px 6px;font-weight:700;width:110px;">Tj\xe4nst</td><td style="padding:14px 16px 6px;">${f(a.service)}</td></tr>
            <tr><td style="padding:6px 16px;font-weight:700;">Start</td><td style="padding:6px 16px;">${f(c)}</td></tr>
            <tr><td style="padding:6px 16px;font-weight:700;">Slut</td><td style="padding:6px 16px;">${f(d)}</td></tr>
            ${a.city?`<tr><td style="padding:6px 16px 14px;font-weight:700;">Ort</td><td style="padding:6px 16px 14px;">${f(a.city)}</td></tr>`:""}
          </table>
          <h2 style="font-size:19px;margin:26px 0 8px;">Hantera din bokning</h2>
          <p style="margin-top:0;color:#526158;">Du kan se, boka om eller avboka bokningen utan att skapa ett konto.</p>
          <p style="margin:22px 0 12px;">
            <a href="${f(a.portalUrl)}" style="display:inline-block;background:#17452f;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 20px;border-radius:12px;">Hantera bokning</a>
          </p>
          <p style="margin:0 0 22px;">
            <a href="${f(a.rescheduleUrl)}" style="display:inline-block;border:1px solid #17452f;color:#17452f;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:12px;margin-right:8px;margin-bottom:8px;">Boka om</a>
            <a href="${f(a.portalUrl)}" style="display:inline-block;border:1px solid #d9aaa3;color:#9d3429;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:12px;margin-bottom:8px;">Avboka eller se villkor</a>
          </p>
          <p style="font-size:13px;color:#667168;">L\xe4nkarna \xe4r personliga och ska inte delas med andra.</p>
          <p style="margin-top:26px;">Med v\xe4nliga h\xe4lsningar<br /><strong>${f(a.companyName)}</strong></p>
        </div>
      </div>
      <p style="text-align:center;font-size:12px;color:#8a938d;margin-top:14px;">Powered by Proffera</p>
    </div>
  `});try{let b=await fetch("https://api.brevo.com/v3/smtp/email",{method:"POST",headers:{"api-key":h,"Content-Type":"application/json"},body:JSON.stringify({sender:j,to:[{email:a.customerEmail,name:a.customerName}],subject:k.subject,textContent:k.text,htmlContent:k.html})}),c=await b.json().catch(()=>({}));if(!b.ok)return{ok:!1,message:c.message??c.code??"Kunde inte skicka bokningsbekräftelse."};return{ok:!0,providerId:c.messageId??null}}catch{return{ok:!1,message:"Kunde inte kontakta Brevo."}}}var i=a.i(4132),j=a.i(732056),k=a.i(295946);function l(a,c){let d=process.env.BETTER_AUTH_SECRET??process.env.AUTH_SECRET??"proffera-booking-verification";return(0,b.createHash)("sha256").update(`${a}:${c}:${d}`).digest("hex")}function m(a){let b=a instanceof Date?a:new Date(String(a));if(Number.isNaN(b.getTime()))throw Error("Invalid booking verification timestamp");return b.toISOString()}async function n(a){let c=(0,k.getSql)();if(!c)return{ok:!1,error:"database"};if(!/^[0-9a-f-]{36}$/i.test(a.serviceId))return{ok:!1,error:"service"};let d=String((0,b.randomInt)(0,1e6)).padStart(6,"0"),f=new Date(Date.now()+6e5).toISOString();if(!(await c`
    select id, name
    from workspace_services
    where id = ${a.serviceId}::uuid
      and workspace_id = ${a.workspaceId}
      and is_active = true
    limit 1
  `)[0])return{ok:!1,error:"service"};let g=await c`
    insert into public_booking_verifications (
      workspace_id, public_booking_slug, customer_name, customer_email, customer_phone,
      service_id, service_name, staff_id, city, address, postcode, booking_details,
      starts_at, ends_at, code_hash, expires_at
    ) values (
      ${a.workspaceId}::uuid, ${a.slug}, ${a.customerName}, ${a.customerEmail.toLowerCase()},
      ${a.customerPhone||null}, ${a.serviceId}::uuid, ${a.serviceName}, ${a.staffId||null}::uuid, ${a.city||null},
      ${a.address||null}, ${a.postcode||null}, ${a.bookingDetails||null},
      ${a.startsAt}::timestamptz, ${a.endsAt}::timestamptz, '', ${f}::timestamptz
    ) returning id
  `,h=String(g[0]?.id??"");if(!h)return{ok:!1,error:"database"};await c`update public_booking_verifications set code_hash = ${l(h,d)} where id = ${h}::uuid`;let[j,m]=await Promise.all([e({customerName:a.customerName,customerEmail:a.customerEmail,companyName:a.companyName,code:d,expiresMinutes:10,language:a.language}),a.verificationSms&&a.customerPhone?(0,i.sendBookingVerificationSms)({customerPhone:a.customerPhone,companyName:a.companyName,code:d,expiresMinutes:10,language:a.language}):Promise.resolve({ok:!1,skipped:!0,message:"SMS verification not requested."})]);return j.ok||m.ok?{ok:!0,verificationId:h,delivery:j.ok&&m.ok?"email_sms":m.ok?"sms":"email"}:(await c`delete from public_booking_verifications where id = ${h}::uuid`,{ok:!1,error:"email"})}async function o(a,c="sv"){let d=(0,k.getSql)();if(!d||!/^[0-9a-f-]{36}$/i.test(a))return{ok:!1,error:"invalid"};let f=(await d`
    select v.*, coalesce(nullif(ws.company_name, ''), w.company_name, w.name) as company_name
    from public_booking_verifications v
    join workspaces w on w.id = v.workspace_id
    left join workspace_settings ws on ws.workspace_id = w.id::text
    where v.id = ${a}::uuid
    limit 1
  `)[0];if(!f||f.consumed_at||f.verified_at)return{ok:!1,error:"invalid"};let g=new Date(String(f.created_at)).getTime(),h=new Date(String(f.updated_at??f.created_at)).getTime();if(!Number.isFinite(g)||Date.now()-g>36e5)return{ok:!1,error:"expired"};if(Number.isFinite(h)&&Date.now()-h<3e4)return{ok:!1,error:"wait"};let j=String((0,b.randomInt)(0,1e6)).padStart(6,"0"),m=String(f.company_name),n=String(f.customer_name),p=String(f.customer_email),q=f.customer_phone?String(f.customer_phone):"",r="primeview"===String(f.public_booking_slug)&&!!q,[s,t]=await Promise.all([e({customerName:n,customerEmail:p,companyName:m,code:j,expiresMinutes:10,language:c}),r?(0,i.sendBookingVerificationSms)({customerPhone:q,companyName:m,code:j,expiresMinutes:10,language:c}):Promise.resolve({ok:!1,skipped:!0,message:"SMS verification not requested."})]);if(!s.ok&&!t.ok)return{ok:!1,error:"email"};let u=new Date(Date.now()+6e5).toISOString();return await d`
    update public_booking_verifications
    set code_hash = ${l(a,j)}, expires_at = ${u}::timestamptz, attempts = 0, updated_at = now()
    where id = ${a}::uuid and consumed_at is null and verified_at is null
  `,{ok:!0,delivery:s.ok&&t.ok?"email_sms":t.ok?"sms":"email"}}async function p(a,b){let d,e,f,g,n,o,p=(0,k.getSql)();if(!p||!/^[0-9a-f-]{36}$/i.test(a)||!/^\d{6}$/.test(b))return{ok:!1,error:"invalid"};let q=(await p`
    select v.*, coalesce(nullif(ws.company_name, ''), w.company_name, w.name) as company_name,
      nullif(ws.contact_email, '') as owner_email, nullif(ws.contact_phone, '') as owner_phone,
      coalesce(nullif(ws.time_zone, ''), 'Europe/Stockholm') as time_zone
    from public_booking_verifications v
    join workspaces w on w.id = v.workspace_id
    left join workspace_settings ws on ws.workspace_id = w.id::text
    where v.id = ${a}::uuid
    limit 1
  `)[0];if(!q||q.consumed_at||q.verified_at)return{ok:!1,error:"invalid"};if(new Date(String(q.expires_at))<=new Date)return{ok:!1,error:"expired"};if(Number(q.attempts)>=Number(q.max_attempts))return{ok:!1,error:"attempts"};if(l(a,b)!==String(q.code_hash))return await p`update public_booking_verifications set attempts = attempts + 1, updated_at = now() where id = ${a}::uuid`,{ok:!1,error:"code"};let r=q.service_id?String(q.service_id):"";if(!r||!(await p`
    select id
    from workspace_services
    where id = ${r}::uuid
      and workspace_id = ${String(q.workspace_id)}
      and is_active = true
    limit 1
  `)[0])return{ok:!1,error:"invalid"};let s=m(q.starts_at),t=m(q.ends_at),u=q.staff_id?String(q.staff_id):null,v=q.address?String(q.address):"",w=q.postcode?String(q.postcode):"",x=(e=(d=(q.booking_details?String(q.booking_details):"").split(/\r?\n/).map(a=>a.trim()).filter(Boolean)).some(a=>/^address\s*:/i.test(a)),f=d.some(a=>/^postcode\s*:/i.test(a)),[v&&!e?`Address: ${v}`:"",w&&!f?`Postcode: ${w}`:"",...d].filter(Boolean).join("\n"));if((await p`
    select id from bookings
    where workspace_id = ${String(q.workspace_id)}
      and status not in ('cancelled', 'no_show')
      and (${u}::uuid is null or staff_id = ${u}::uuid or staff_id is null)
      and starts_at < ${t}::timestamptz
      and ends_at > ${s}::timestamptz
    limit 1
  `)[0])return{ok:!1,error:"conflict"};let y=`${String(q.workspace_id)}:${String(q.customer_email).toLowerCase()}`,[,z]=await p.transaction([p`select pg_advisory_xact_lock(hashtextextended(${y}::text, 0))`,p`
      with existing_customer as (
        select id from customers
        where workspace_id = ${String(q.workspace_id)} and lower(email) = lower(${String(q.customer_email)})
        order by created_at asc nulls last, id asc limit 1
      ), inserted_customer as (
        insert into customers (workspace_id, name, email, phone, city, status, source, notes)
        select ${String(q.workspace_id)}, ${String(q.customer_name)}, ${String(q.customer_email)}, ${q.customer_phone?String(q.customer_phone):null}, ${q.city?String(q.city):null}, 'prospect', 'public_booking', ${x||null}
        where not exists (select 1 from existing_customer)
        returning id
      ), selected_customer as (
        select id from existing_customer union all select id from inserted_customer limit 1
      ), booking as (
        insert into bookings (workspace_id, customer_id, staff_id, service_id, title, service, city, status, starts_at, ends_at, source, notes)
        select ${String(q.workspace_id)}, id, ${u}::uuid, ${r}::uuid, ${String(q.service_name)}, ${String(q.service_name)}, ${q.city?String(q.city):null}, 'requested', ${s}::timestamptz, ${t}::timestamptz, 'public_booking', ${x||null}
        from selected_customer limit 1 returning id, customer_id
      ), created_event as (
        insert into customer_events (workspace_id, customer_id, booking_id, event_type, title, description, metadata)
        select
          ${String(q.workspace_id)},
          booking.customer_id,
          booking.id,
          'booking',
          'Booking created',
          'Booking request created after customer email verification.',
          jsonb_build_object('source', 'public_booking', 'service', ${String(q.service_name)})
        from booking
        returning id
      )
      update public_booking_verifications set verified_at = now(), consumed_at = now(), updated_at = now()
      where id = ${a}::uuid
      returning (select id from booking) as booking_id, (select customer_id from booking) as customer_id
    `]),A=String(z?.[0]?.booking_id??""),B=String(z?.[0]?.customer_id??"");if(!A||!B)return{ok:!1,error:"save"};let C=String(q.time_zone),D=(0,j.createCustomerCalendarToken)({workspaceId:String(q.workspace_id),customerId:B,expiresInSeconds:(g=new Date(t).getTime(),n=Date.now()+2592e6,o=Number.isFinite(g)?g+2592e6:n,Math.max(2592e3,Math.ceil((Math.min(Math.max(n,o),Date.now()+3456e7)-Date.now())/1e3)))}),E=(process.env.NEXT_PUBLIC_APP_URL??process.env.APP_URL??"https://www.proffera.se").replace(/\/$/,""),F=encodeURIComponent(D),G=encodeURIComponent(A),H=`${E}/mina-bokningar/${F}`,I=`${H}/${G}/boka-om`;return await Promise.allSettled([h({customerName:String(q.customer_name),customerEmail:String(q.customer_email),companyName:String(q.company_name),service:String(q.service_name),startsAt:s,endsAt:t,city:String(q.city??""),timeZone:C,portalUrl:H,rescheduleUrl:I}),q.owner_email?(0,c.sendBookingOwnerNotificationEmail)({ownerEmail:String(q.owner_email),companyName:String(q.company_name),customerName:String(q.customer_name),customerEmail:String(q.customer_email),customerPhone:String(q.customer_phone??""),service:String(q.service_name),startsAt:s,endsAt:t,city:String(q.city??""),timeZone:C}):Promise.resolve(),q.owner_phone?(0,i.sendBookingOwnerSms)({ownerPhone:String(q.owner_phone),companyName:String(q.company_name),customerName:String(q.customer_name),customerPhone:String(q.customer_phone??""),service:String(q.service_name),startsAt:s,timeZone:C}):Promise.resolve()]),{ok:!0,slug:String(q.public_booking_slug)}}a.s(["beginBookingEmailVerification",0,n,"resendPublicBookingCode",0,o,"verifyPublicBookingCode",0,p],15210)},310317,a=>{"use strict";var b=a.i(666680),c=a.i(295946);async function d(a){let d=function(a=process.env){let b=a.PUBLIC_FORM_RATE_LIMIT_SECRET?.trim();return b||(a.VERCEL_ENV||"production"===a.NODE_ENV?null:"proffera-public-form-rate-limit-v1")}(),e=(0,c.getSql)();if(!d||!e||a.maxAttempts<1||a.windowSeconds<1)return!1;try{let c=await e`
      insert into public_submission_rate_limits (
        scope,
        fingerprint,
        window_started_at,
        attempts,
        created_at,
        updated_at
      )
      values (
        ${a.scope},
        ${function({scope:a,requestHeaders:c,identity:d=""},e){let f=d.trim().toLowerCase();return(0,b.createHash)("sha256").update(`${e}:${a}:${c.get("x-forwarded-for")?.split(",")[0]?.trim()||c.get("x-real-ip")?.trim()||"unknown"}:${f}`).digest("hex")}(a,d)},
        now(),
        1,
        now(),
        now()
      )
      on conflict (scope, fingerprint)
      do update set
        attempts = case
          when public_submission_rate_limits.window_started_at <= now() - (${a.windowSeconds} * interval '1 second') then 1
          else public_submission_rate_limits.attempts + 1
        end,
        window_started_at = case
          when public_submission_rate_limits.window_started_at <= now() - (${a.windowSeconds} * interval '1 second') then now()
          else public_submission_rate_limits.window_started_at
        end,
        updated_at = now()
      returning attempts
    `;return Number(c[0]?.attempts??a.maxAttempts+1)<=a.maxAttempts}catch(a){return console.error("Failed to apply public form rate limit",a),!1}}a.s(["allowPublicSubmission",0,d],310317)},84371,a=>{"use strict";a.s(["JuliusBookingDemo",()=>b]);let b=(0,a.i(211857).registerClientReference)(function(){throw Error("Attempted to call JuliusBookingDemo() from the server but JuliusBookingDemo is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.")},"[project]/src/components/salon/julius-booking-demo.tsx <module evaluation>","JuliusBookingDemo")},520053,a=>{"use strict";a.s(["JuliusBookingDemo",()=>b]);let b=(0,a.i(211857).registerClientReference)(function(){throw Error("Attempted to call JuliusBookingDemo() from the server but JuliusBookingDemo is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.")},"[project]/src/components/salon/julius-booking-demo.tsx","JuliusBookingDemo")},915474,a=>{"use strict";a.i(84371);var b=a.i(520053);a.n(b)},924396,a=>a.a(async(b,c)=>{try{var d=a.i(801381),e=b([d]);[d]=e.then?(await e)():e,a.s([]),c()}catch(a){c(a)}},!1),40129,a=>a.a(async(b,c)=>{try{var d=a.i(924396),e=a.i(801381),f=b([d,e]);[d,e]=f.then?(await f)():f,a.s(["40535a9781e5509a760505d42877caceb749c8e08e",()=>e.$$RSC_SERVER_ACTION_0]),c()}catch(a){c(a)}},!1)];

//# sourceMappingURL=_09j46rt._.js.map