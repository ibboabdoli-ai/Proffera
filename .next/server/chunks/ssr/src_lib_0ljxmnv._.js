module.exports=[553207,a=>a.a(async(b,c)=>{try{var d=a.i(546767),e=a.i(612147),f=a.i(87921),g=b([f]);[f]=g.then?(await g)():g;let t=(0,e.resolveDatabaseUrl)();function h(){return t?(0,d.neon)(t):null}async function i(){let a=await (0,f.getUserWorkspaceAccess)();if(!a.ok)throw Error("A valid workspace membership is required for dashboard data");return a.workspaceId}function j(a,b=""){return null==a?b:String(a)}function k(a,b=0){let c=Number(a);return Number.isFinite(c)?c:b}function l(a){if(!a)return"Ej bokad";let b=a instanceof Date?a:new Date(String(a));return Number.isNaN(b.getTime())?"Ej bokad":new Intl.DateTimeFormat("sv-SE",{dateStyle:"medium",timeStyle:"short"}).format(b)}function m(a){let b=a.trim();return b.length>0?b:null}class u extends Error{constructor(){super("A booking already exists during the selected time."),this.name="BookingTimeConflictError"}}async function n(a={}){let b=h(),c=a.includeCustomers??!0,d=a.includeBookings??!0,e={customersCount:0,activeCustomersCount:0,bookingsCount:0,confirmedBookingsCount:0,customerEventsCount:0};if(!b||!c&&!d)return e;let f=await i();try{let a=(c&&d?await b`
      select
        (select count(*) from customers where workspace_id = ${f}) as customers_count,
        (select count(*) from customers where workspace_id = ${f} and status = 'active') as active_customers_count,
        (select count(*) from bookings where workspace_id = ${f}) as bookings_count,
        (select count(*) from bookings where workspace_id = ${f} and status = 'confirmed') as confirmed_bookings_count,
        (select count(*) from customer_events where workspace_id = ${f}) as customer_events_count
    `:c?await b`
      select
        (select count(*) from customers where workspace_id = ${f}) as customers_count,
        (select count(*) from customers where workspace_id = ${f} and status = 'active') as active_customers_count,
        0 as bookings_count,
        0 as confirmed_bookings_count,
        (select count(*) from customer_events where workspace_id = ${f} and booking_id is null) as customer_events_count
    `:await b`
      select
        0 as customers_count,
        0 as active_customers_count,
        (select count(*) from bookings where workspace_id = ${f}) as bookings_count,
        (select count(*) from bookings where workspace_id = ${f} and status = 'confirmed') as confirmed_bookings_count,
        0 as customer_events_count
    `)[0]??{};return{customersCount:k(a.customers_count),activeCustomersCount:k(a.active_customers_count),bookingsCount:k(a.bookings_count),confirmedBookingsCount:k(a.confirmed_bookings_count),customerEventsCount:k(a.customer_events_count)}}catch(a){return console.error("Failed to read dashboard stats",a),e}}async function o(){let a=h();if(!a)return[];let b=await i();try{return(await a`
      select
        id,
        name,
        customer_type,
        city,
        status,
        primary_service_slug,
        notes
      from customers
      where workspace_id = ${b}
      order by created_at desc
      limit 20
    `).map(a=>({id:j(a.id),name:j(a.name,"Namnlös kund"),type:"company"===j(a.customer_type)?"Företag":"Privatkund",city:j(a.city,"Okänd ort"),status:j(a.status,"prospect"),service:j(a.primary_service_slug,"Ej valt"),notes:j(a.notes,"Ingen notering")}))}catch(a){return console.error("Failed to read dashboard customers",a),[]}}async function p(){let a=h();if(!a)return[];let b=await i();try{return(await a`
      select
        id,
        name,
        city,
        status,
        primary_service_slug
      from customers
      where workspace_id = ${b}
      order by created_at desc
      limit 50
    `).map(a=>({id:j(a.id),name:j(a.name,"Namnlös kund"),city:j(a.city,"Okänd ort"),status:j(a.status,"prospect"),service:j(a.primary_service_slug,"Ej valt")}))}catch(a){return console.error("Failed to read dashboard customer options",a),[]}}async function q(a){let b=h();if(!b)throw Error("Missing database connection for dashboard customer creation");let c=await i(),d=await b`
    insert into customers (
      workspace_id,
      name,
      email,
      phone,
      company_name,
      customer_type,
      city,
      status,
      source,
      primary_service_category_slug,
      primary_service_slug,
      notes
    )
    values (
      ${c},
      ${a.name.trim()},
      ${m(a.email)},
      ${m(a.phone)},
      ${m(a.companyName)},
      ${a.customerType},
      ${m(a.city)},
      ${a.status},
      'dashboard_manual',
      ${m(a.serviceCategorySlug)},
      ${m(a.serviceSlug)},
      ${m(a.notes)}
    )
    returning id
  `,e=j(d[0]?.id);if(!e)throw Error("Customer creation did not return an id");return e}async function r(a){let b=h();if(!b)throw Error("Missing database connection for dashboard booking creation");let c=await i(),d=await b`
    select id
    from customers
    where workspace_id = ${c}
      and id = ${a.customerId}
    limit 1
  `,e=j(d[0]?.id);if(!e)throw Error("Selected customer does not exist");if((await b`
    select id
    from bookings
    where workspace_id = ${c}
      and status not in ('cancelled', 'no_show')
      and starts_at is not null
      and ends_at is not null
      and starts_at < ${a.endsAt}::timestamptz
      and ends_at > ${a.startsAt}::timestamptz
    limit 1
  `)[0])throw new u;let f=await b`
    insert into bookings (
      workspace_id,
      customer_id,
      title,
      service,
      service_category_slug,
      service_slug,
      city,
      status,
      starts_at,
      ends_at,
      source,
      notes
    )
    values (
      ${c},
      ${e},
      ${a.title.trim()},
      ${m(a.service)},
      ${m(a.serviceCategorySlug)},
      ${m(a.serviceSlug)},
      ${m(a.city)},
      ${a.status},
      ${a.startsAt}::timestamptz,
      ${a.endsAt}::timestamptz,
      'dashboard_manual',
      ${m(a.notes)}
    )
    returning id
  `,g=j(f[0]?.id);if(!g)throw Error("Booking creation did not return an id");return await b`
    update customers
    set status = 'active',
        updated_at = now()
    where id = ${e}
      and workspace_id = ${c}
      and status = 'prospect'
  `,await b`
    insert into customer_events (
      workspace_id,
      customer_id,
      booking_id,
      event_type,
      title,
      description
    )
    values (
      ${c},
      ${e},
      ${g},
      'booking_created',
      'Bokning skapad fran lead',
      'Lead konverterades till bokning och kunden markerades som aktiv.'
    )
  `,g}async function s(a){let b=h();if(!b)return null;let c=await i();try{let d=(await b`
      select
        id,
        name,
        email,
        phone,
        company_name,
        customer_type,
        city,
        status,
        source,
        primary_service_slug,
        notes,
        created_at
      from customers
      where workspace_id = ${c}
        and id = ${a}
      limit 1
    `)[0];if(!d)return null;let e=await b`
      select
        b.id,
        b.title,
        b.status,
        b.city,
        b.service,
        b.starts_at,
        c.name as customer_name
      from bookings b
      left join customers c
        on c.id = b.customer_id
       and c.workspace_id = b.workspace_id
      where b.workspace_id = ${c}
        and b.customer_id = ${a}
      order by b.starts_at asc nulls last, b.created_at desc
      limit 20
    `,f=await b`
      select
        id,
        event_type,
        title,
        description,
        created_at
      from customer_events
      where workspace_id = ${c}
        and customer_id = ${a}
      order by created_at desc
      limit 20
    `;return{customer:{id:j(d.id),name:j(d.name,"Namnlös kund"),type:"company"===j(d.customer_type)?"Företag":"Privatkund",city:j(d.city,"Okänd ort"),status:j(d.status,"prospect"),service:j(d.primary_service_slug,"Ej valt"),notes:j(d.notes,"Ingen notering"),email:j(d.email,"Ingen e-post"),phone:j(d.phone,"Inget telefonnummer"),companyName:j(d.company_name,"Ej företag"),source:j(d.source,"Okänd källa"),createdAt:l(d.created_at)},bookings:e.map(a=>({id:j(a.id),time:l(a.starts_at),title:j(a.title,"Namnlös bokning"),customer:j(a.customer_name,"Okänd kund"),status:j(a.status,"requested"),city:j(a.city,"Okänd ort"),service:j(a.service,"Ej vald tjänst")})),events:f.map(a=>({id:j(a.id),type:j(a.event_type,"note"),title:j(a.title,"Namnlös händelse"),description:j(a.description,"Ingen beskrivning"),createdAt:l(a.created_at)}))}}catch(a){return console.error("Failed to read dashboard customer detail",a),null}}a.s(["BookingTimeConflictError",0,u,"createDashboardBooking",0,r,"createDashboardCustomer",0,q,"getDashboardCustomerDetail",0,s,"getDashboardCustomerOptions",0,p,"getDashboardCustomers",0,o,"getDashboardStats",0,n]),c()}catch(a){c(a)}},!1),472700,a=>{"use strict";a.s(["serviceTaxonomy",0,[{name:"Städning & lokalvård",slug:"stadning-lokalvard",positioning:"Basmarknaden för Proffera: återkommande service, offertförfrågningar och bokningsflöden.",services:[{name:"Hemstädning",slug:"hemstadning",description:"Återkommande eller engångsstädning för privatkunder.",intentExamples:["boka hemstädning","pris hemstädning","städhjälp hemma"]},{name:"Kontorsstädning",slug:"kontorsstadning",description:"Lokalvård för kontor, butiker och små företag.",intentExamples:["kontorsstädning offert","städfirma företag","lokalvård kontor"]},{name:"Flyttstädning",slug:"flyttstadning",description:"Städning inför flytt med tydlig offert och tidsbokning.",intentExamples:["boka flyttstädning","flyttstädning pris","städning vid flytt"]},{name:"Fönsterputs",slug:"fonsterputs",description:"Fönsterputs för privatkunder, bostadsrättsföreningar och företag.",intentExamples:["fönsterputs södertälje","boka fönsterputs","pris fönsterputs"]}]},{name:"Flytt & hemservice",slug:"flytt-hemservice",positioning:"Närliggande tjänster där bokning, uppföljning och offertflöden är centrala.",services:[{name:"Flytthjälp",slug:"flytthjalp",description:"Hjälp med flytt, bärhjälp och enklare logistik.",intentExamples:["flytthjälp","bärhjälp","flyttfirma offert"]},{name:"Bortforsling",slug:"bortforsling",description:"Bortforsling av möbler, skräp och grovavfall.",intentExamples:["bortforsling möbler","hämta skräp","grovavfall hjälp"]},{name:"Handyman",slug:"handyman",description:"Små reparationer, montering och praktisk hjälp i hemmet.",intentExamples:["handyman","montering möbler","hjälp hemma"]},{name:"Trädgårdshjälp",slug:"tradgardshjalp",description:"Gräsklippning, enklare trädgårdsarbete och säsongsservice.",intentExamples:["trädgårdshjälp","gräsklippning","trädgårdsservice"]}]},{name:"Skönhet & hälsa",slug:"skonhet-halsa",positioning:"Tjänster som ofta behöver onlinebokning, kundregister, påminnelser och återbesök.",services:[{name:"Frisör",slug:"frisor",description:"Klippning, färgning och återkommande salongsbokningar.",intentExamples:["boka frisör","klippning","hårfärgning"]},{name:"Massage",slug:"massage",description:"Behandlingar med tidsbokning, journalnoteringar och uppföljning.",intentExamples:["boka massage","massage tid","friskvård massage"]},{name:"Naglar",slug:"naglar",description:"Nagelvård, återbesök och kundhistorik.",intentExamples:["boka naglar","manikyr","nagelsalong"]},{name:"Fransar & bryn",slug:"fransar-bryn",description:"Skönhetsbehandlingar med återkommande bokningar.",intentExamples:["fransar","bryn","boka fransförlängning"]},{name:"Hudvård",slug:"hudvard",description:"Behandlingar där kundhistorik och återbesök är viktiga.",intentExamples:["hudvård","ansiktsbehandling","boka hudterapeut"]}]},{name:"Träning & friskvård",slug:"traning-friskvard",positioning:"Bokningsintensiva tjänster med abonnemang, återbesök och kunddialog.",services:[{name:"Personlig tränare",slug:"personlig-tranare",description:"PT-pass, konsultationer och träningsuppföljning.",intentExamples:["personlig tränare","boka PT","träningshjälp"]},{name:"Yoga",slug:"yoga",description:"Klasser, grupper och återkommande bokningar.",intentExamples:["boka yoga","yogaklass","yoga studio"]},{name:"Naprapat",slug:"naprapat",description:"Behandlingar med journalbehov och återbesök.",intentExamples:["boka naprapat","ryggbehandling","smärta behandling"]},{name:"Fotvård",slug:"fotvard",description:"Behandlingar och regelbundna kundbesök.",intentExamples:["fotvård","boka fotvård","medicinsk fotvård"]}]},{name:"Företagstjänster",slug:"foretagstjanster",positioning:"B2B-tjänster där CRM, offertstatus och uppföljning skapar värde.",services:[{name:"Facility service",slug:"facility-service",description:"Återkommande service för lokaler och arbetsplatser.",intentExamples:["facility service","kontorsservice","serviceavtal"]},{name:"Bemanning",slug:"bemanning",description:"Förfrågningar, uppföljning och kunddialog för bemanningstjänster.",intentExamples:["bemanning","personal hjälp","bemanningsförfrågan"]},{name:"Eventservice",slug:"eventservice",description:"Service, personal och planering kring event.",intentExamples:["eventservice","eventpersonal","hjälp med event"]},{name:"Konsultation",slug:"konsultation",description:"Bokningsbara möten, rådgivning och uppföljning.",intentExamples:["boka konsultation","rådgivning","företagsmöte"]}]}]])}];

//# sourceMappingURL=src_lib_0ljxmnv._.js.map