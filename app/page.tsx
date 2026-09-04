'use client';
import {useState,useEffect,useRef,useCallback} from 'react';
import {flushSync} from 'react-dom';
import {Waves,MapPin,Phone,ArrowUpRight,Clock3,Search,CalendarDays,Info,AlertTriangle,Timer,ChevronRight} from 'lucide-react';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@/components/ui/select';
import {Sheet,SheetContent,SheetHeader,SheetTitle,SheetDescription} from '@/components/ui/sheet';
import {Table,TableHeader,TableBody,TableRow,TableHead,TableCell} from '@/components/ui/table';
import {Empty,EmptyHeader,EmptyTitle,EmptyDescription} from '@/components/ui/empty';
import {pools,baseSchedule,defaults,validDate,clock,visitPrice,matchingSessions,poolMatches,closestSwim,type Filters,type Pool,type Schedule} from '@/lib/pools';

const options={
 area:[['all','Both areas'],['ma','Wellesley, MA area'],['va','McLean, VA area']],
 length:[['any','Any length'],['25y','25 yards'],['25m','25 meters'],['50m','50 meters']],
 budget:[['any','Any price'],['10','$10 or less'],['15','$15 or less'],['20','$20 or less'],['35','$35 or less']],
 duration:[['15','15 minutes'],['30','30 minutes'],['45','45 minutes'],['60','1 hour'],['90','1½ hours']],
};
function Picker({id,label,value,items,onChange}:{id:string;label:string;value:string;items:string[][];onChange:(v:string)=>void}){return <div className="field"><label htmlFor={id}>{label}</label><Select value={value} onValueChange={v=>onChange(v??items[0][0])}><SelectTrigger id={id}><SelectValue>{items.find(x=>x[0]===value)?.[1]}</SelectValue></SelectTrigger><SelectContent>{items.map(([v,l])=><SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select></div>}
function validateFilters(input:unknown):Filters{
 if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Filters must be an object.');
 const f={...defaults(),...input} as Filters;
 for(const key of Object.keys(f))if(!Object.keys(defaults()).includes(key)||typeof f[key as keyof Filters]!=='string')throw new Error('Invalid filter.');
 for(const key of Object.keys(options) as (keyof typeof options)[])if(!options[key].some(x=>x[0]===f[key]))throw new Error('Invalid '+key);
 if(!validDate(f.date)||f.date<'2026-01-01'||f.date>'2028-12-31')throw new Error('Choose a valid date between 2026 and 2028.');
 if(f.time&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(f.time))throw new Error('Choose a valid time.');
 if(f.query.length>120)throw new Error('Keep the search under 120 characters.');return f;
}
function initialSchedules(date:string){return Object.fromEntries(pools.map(p=>[p.id,baseSchedule(p,date)]));}
function dateLabel(date:string){return new Intl.DateTimeFormat('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'));}
function stateLabel(s:Schedule,match:boolean){return s.status==='closed'?'Closed / no lap swim':s.status==='unknown'?'Needs confirmation':s.status==='unlisted'?'No sessions listed':match?'Schedule matches':'Not available at this time';}
export default function Home(){
 const [draft,setDraft]=useState<Filters>(defaults);const [applied,setApplied]=useState<Filters>(defaults);
 const [schedules,setSchedules]=useState<Record<string,Schedule>>(()=>initialSchedules(defaults().date));
 const [loading,setLoading]=useState(true);const [error,setError]=useState('');const [selected,setSelected]=useState<Pool|null>(null);
 const controller=useRef<AbortController|null>(null);const generation=useRef(0);
 const runSearch=useCallback(async(input:Filters)=>{
  const f=validateFilters(input);const current=++generation.current;controller.current?.abort();controller.current=new AbortController();
  setApplied(f);setDraft(f);setLoading(true);setError('');const fallback=initialSchedules(f.date);setSchedules(fallback);
  let next=fallback;
  try{const r=await fetch('/api/schedules?date='+encodeURIComponent(f.date),{signal:controller.current.signal});if(!r.ok)throw new Error('Schedule lookup failed');const data=await r.json() as {date:string;schedules:Record<string,Schedule>};if(data.date!==f.date||!data.schedules)throw new Error('Unexpected schedule response');next=data.schedules;
  }catch(e){if((e as Error).name==='AbortError')return null;next={...fallback,cra:{...fallback.cra,note:'The calendar could not be loaded. Open the official schedule or call CRA.'}};if(current===generation.current)setError('The online calendar did not respond. The checked PDF schedules are still shown.');}
  if(current!==generation.current)return null;setSchedules(next);setLoading(false);return {filters:f,schedules:next};
 },[]);
 useEffect(()=>{void runSearch(defaults());return ()=>controller.current?.abort();},[runSearch]);
 useEffect(()=>{
  const ctx=(document as Document&{modelContext?:{registerTool:(tool:unknown,opts:{signal:AbortSignal})=>void|Promise<void>}}).modelContext;if(!ctx?.registerTool)return;
  const lifecycle=new AbortController();
  const tool={name:'apply_swim_filters',title:'Find lap swimming',description:'Apply area, date, approximate start time (within one hour), duration, pool length and price filters. Return published matches separately from unconfirmed schedules. Does not book a swim.',inputSchema:{type:'object',additionalProperties:false,properties:Object.fromEntries(Object.entries(defaults()).map(([k])=>[k,{type:'string',...(k in options?{enum:options[k as keyof typeof options].map(x=>x[0])}:{})}]))},annotations:{readOnlyHint:false,untrustedContentHint:true},execute:async(input:unknown)=>{const f=validateFilters(input);const result=await runSearch(f);if(!result)throw new Error('Search was superseded');flushSync(()=>setSchedules(result.schedules));return {date:f.date,results:pools.filter(p=>poolMatches(p,f)).map(p=>({name:p.name,phone:p.phone,status:result.schedules[p.id].status,sessions:matchingSessions(result.schedules[p.id],f,p),source:result.schedules[p.id].source}))};}};
  try{void Promise.resolve(ctx.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}return ()=>lifecycle.abort();
 },[runSearch]);
 const change=(key:keyof Filters,value:string)=>setDraft(x=>({...x,[key]:value}));
 const dirty=JSON.stringify(draft)!==JSON.stringify(applied);
 const candidates=pools.filter(p=>poolMatches(p,applied));
 const matches=candidates.filter(p=>schedules[p.id]?.status==='published'&&matchingSessions(schedules[p.id],applied,p).length>0);
 const others=candidates.filter(p=>!matches.includes(p));
 const submit=(e:React.FormEvent)=>{e.preventDefault();try{void runSearch(validateFilters(draft));}catch(e){setError((e as Error).message)}};
 const selectedSchedule=selected?schedules[selected.id]:null;
 function card(p:Pool,matched:boolean){
  const s=schedules[p.id];const alternative=!matched?closestSwim(p,applied,s):null;const sessions=matched?matchingSessions(s,applied,p):s.sessions;
  const price=matched&&p.id==='cra'&&sessions.length&&sessions.every(x=>x.price!==null)?Math.min(...sessions.map(x=>x.price!)):visitPrice(p,false);
  return <article className={'pool-card '+(!matched?'muted-card':'')} key={p.id}>
   <div className="card-top"><a className="location-tag" href={"https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(p.name+" "+p.address)} target="_blank" rel="noreferrer" aria-label={"View "+p.name+" on map"}><MapPin size={14}/>{p.town} ↗</a><span className={'status '+(matched?'green':s.status==='closed'?'red':'amber')}>{stateLabel(s,matched)}</span></div>
   <h3>{p.name}</h3><p>{p.subtitle}</p>
   <div className="facts"><div><small>POOL LENGTH / SIZE</small><strong>{p.length}</strong></div><div><small>VISITOR PRICE</small><strong>$&#8203;{price}<span> {p.id==='cra'&&matched?'/ session':p.priceLabel}</span></strong></div></div>
   <div className={'schedule-note '+(s.status==='closed'?'closure':'')}><Clock3 size={17}/><div>{sessions.length>0&&matched?<><strong>{sessions.slice(0,2).map(x=>clock(x.start)+'–'+clock(x.end)).join(' · ')}</strong>{sessions.length>2&&<span> +{sessions.length-2} more</span>}<span className="subnote">{sessions[0].lanes}</span></>:<span>{s.status==='published'?'Not available for your requested time, swim duration, and budget. See the nearest scheduled option below, if one is available.':s.note}</span>}</div></div>
   {matched&&(applied.date==='2026-09-07'||(p.id==='providence'&&['2026-09-05','2026-09-06'].includes(applied.date)))&&<p className="holiday-note"><AlertTriangle size={14}/>Holiday hours applied</p>}
   {alternative&&<div className="alternative"><div><strong><Clock3 size={15}/>Closest scheduled swim</strong><span>{dateLabel(alternative.date)} · {clock(alternative.start)}–{clock(alternative.end)}</span><small>{applied.duration} minutes · ${alternative.price} · {alternative.date===applied.date?"same day":"another date"}</small></div><button onClick={()=>{const time=String(Math.floor(alternative.start/60)).padStart(2,"0")+":"+String(alternative.start%60).padStart(2,"0");void runSearch({...applied,date:alternative.date,time});}}>Use this time</button></div>}<div className="card-actions"><button className="primary-link" onClick={()=>setSelected(p)}>Schedule & details <ChevronRight size={16}/></button><a href={'tel:+1'+p.phone.replaceAll('-','')}><Phone size={15}/>{p.phone}</a></div>
   <div className="card-foot"><span>{p.access}</span><a href={s.source} target="_blank" rel="noreferrer">Official source <ArrowUpRight size={12}/></a></div>
  </article>
 }
 return <><header className="masthead"><div className="masthead-inner"><a href="/" className="brand"><span className="brand-icon"><Waves size={31}/></span>Lane<span>Finder</span></a><div className="header-right">Your local lap-swim guide<br/><small>Wellesley, Massachusetts & McLean, Virginia</small></div></div></header>
 <div className="nav-strip"><div><span className="active-nav"><Search size={15}/>Find a pool</span><span className="coverage">{pools.length} pools · 2 areas · First edition</span></div></div>
 <main><div className="intro"><div><h1>Where will you swim next?</h1><p>Find a pool, check the schedule, and get your laps in.</p></div><span className="intro-icon"><CalendarDays size={37}/></span></div>
 <form className="filter-panel" onSubmit={submit}><div className="filter-title"><Search size={18}/>Find lap swimming <span>All times are local Eastern time</span></div><div className="filter-body"><div className="filter-grid">
  <Picker id="area" label="Where to swim" value={draft.area} items={options.area} onChange={v=>change('area',v)}/>
  <div className="field"><label htmlFor="query">Pool, town, or ZIP code</label><input id="query" type="search" value={draft.query} maxLength={120} placeholder="e.g. Spring Hill or 02482" onChange={e=>change('query',e.target.value)}/></div>
  <div className="field"><label htmlFor="date">Date</label><input id="date" type="date" required min="2026-01-01" max="2028-12-31" value={draft.date} onChange={e=>change('date',e.target.value)}/></div>
  <div className="field"><label htmlFor="time">Start around <small>(±1 hour)</small></label><input id="time" type="time" value={draft.time} onChange={e=>change('time',e.target.value)}/></div>
  <Picker id="duration" label="How long will you swim?" value={draft.duration} items={options.duration} onChange={v=>change('duration',v)}/>
  <Picker id="length" label="Pool length" value={draft.length} items={options.length} onChange={v=>change('length',v)}/>
  <Picker id="budget" label="Max visitor price / session" value={draft.budget} items={options.budget} onChange={v=>change('budget',v)}/>
 </div><div className="apply-row"><span>{dirty?'You have unapplied changes.':'Leave the time blank to search the whole day.'}</span><button type="button" className="reset-button" onClick={()=>setDraft(defaults())}>Reset filters</button><button type="submit" className="apply-button"><Search size={17}/>{loading?'Apply filters / search again':'Apply filters'}</button></div></div></form>
 <div className="notice"><Info size={18}/><p><strong>Schedules, not live occupancy.</strong> CRA sessions come from its public calendar. Fairfax schedules cover September 2026; Arlington schedules cover the 2026–2027 school year. Holiday exceptions are included. Other dates or unverified details are flagged. Pool configurations can vary.</p></div>
 {error&&<div role="alert" className="error-box">{error}<button onClick={()=>void runSearch(applied)}>Try again</button></div>}
 <section aria-labelledby="results-title" aria-busy={loading}><div className="results-heading"><h2 id="results-title">{loading?'Checking schedules…':matches.length+' pool'+(matches.length===1?'':'s')+' with matching sessions'}</h2><span>{dateLabel(applied.date)}{applied.time?' · around '+clock(Number(applied.time.slice(0,2))*60+Number(applied.time.slice(3))):' · any time'} · {applied.duration} min</span></div>
 <p className="results-help" aria-live="polite">{loading?'Loading the official calendar; verified PDF hours appear below.':dirty?'Results still use your last applied filters.':'A match means a published session fits. It does not guarantee an empty lane or remaining reservation.'}</p>
 {matches.length>0?<div className="pool-grid">{matches.map(p=>card(p,true))}</div>:!loading&&<Empty className="empty-state"><EmptyHeader><Search size={28}/><EmptyTitle className="text-lg">No published swim available for these filters</EmptyTitle><EmptyDescription>The closest scheduled alternatives appear below, where verified. They keep your swim duration and budget. Pools with unknown schedules need a call.</EmptyDescription></EmptyHeader><button className="reset-button" onClick={()=>{const f=defaults();setDraft(f);void runSearch(f)}}>Clear filters & search</button></Empty>}
 {others.length>0&&<><div className="results-heading secondary-heading"><h2>Other pools to check</h2><span>Closed, outside your time, or awaiting confirmation</span></div><div className="pool-grid">{others.map(p=>card(p,false))}</div></>}
 {candidates.length===0&&<p className="disclaimer">This first edition covers eight pools in the Wellesley and McLean areas. Pool lengths describe the facility; check the lane configuration before visiting.</p>}
 </section><footer><span><Waves size={18}/> LaneFinder</span><p>Independent guide · Details checked September 4, 2026<br/>Prices can change. Confirm access and lane configuration with the pool before traveling.</p></footer></main>
 <Sheet open={!!selected} onOpenChange={open=>{if(!open)setSelected(null)}}><SheetContent className="pool-sheet">{selected&&selectedSchedule&&<><SheetHeader><SheetTitle className="sheet-title">{selected.name}</SheetTitle><SheetDescription>{selected.address}</SheetDescription></SheetHeader><div className="sheet-body"><div className="sheet-contact"><a href={'tel:+1'+selected.phone.replaceAll('-','')}><Phone size={16}/>{selected.phone}</a><a href={selected.website} target="_blank" rel="noreferrer">Pool website <ArrowUpRight size={15}/></a></div><h3><CalendarDays size={19}/>{dateLabel(applied.date)}</h3><div className={'schedule-note '+(selectedSchedule.status==='closed'?'closure':'')}><Info size={18}/><span>{selectedSchedule.note}</span></div>
 {selectedSchedule.sessions.length>0&&<Table className="session-table"><TableHeader><TableRow><TableHead>Scheduled session</TableHead><TableHead>Lane allocation</TableHead><TableHead>Price</TableHead></TableRow></TableHeader><TableBody>{selectedSchedule.sessions.map((x,i)=><TableRow key={i}><TableCell><strong>{clock(x.start)}–{clock(x.end)}</strong><span>{x.title}</span></TableCell><TableCell>{x.lanes}</TableCell><TableCell>{x.price!==null?'$'+x.price:selected.id==='cra'?'Confirm':'$'+visitPrice(selected,false)}</TableCell></TableRow>)}</TableBody></Table>}
 <p className="detail-tip"><Timer size={16}/>The search looks for a start within one hour of your chosen time, with enough room for your full swim inside one published session.</p>
 <a className="primary-link wide-link" href={selectedSchedule.source} target="_blank" rel="noreferrer">Open official schedule <ArrowUpRight size={16}/></a>
 <a className="map-link" href={"https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(selected.name+" "+selected.address)} target="_blank" rel="noreferrer"><MapPin size={17}/>View on map <ArrowUpRight size={15}/></a><h3>Pool length & lanes</h3><p><strong>{selected.length}</strong> · {selected.lengthNote}</p><h3>Day pass & access</h3><p>{selected.priceNote}</p><p>{selected.notes}</p>
 {selected.laneUrl&&<a className="map-link" href={selected.laneUrl} target="_blank" rel="noreferrer"><CalendarDays size={17}/>View lane-by-lane chart <ArrowUpRight size={15}/></a>}<h3>Sources & updates</h3><ul className="source-list"><li><a href={selected.priceUrl} target="_blank" rel="noreferrer">Admission prices & rules ↗</a></li><li><a href={selected.lengthUrl} target="_blank" rel="noreferrer">Pool details ↗</a></li>{selected.id==='cra'&&<li><a href="https://charlesriveraquatics.com/new-calendar/" target="_blank" rel="noreferrer">CRA blackout dates ↗</a></li>}</ul><p className="disclaimer">{selectedSchedule.live?'Calendar loaded '+new Intl.DateTimeFormat('en-US',{dateStyle:'medium',timeStyle:'short',timeZone:'America/New_York'}).format(new Date(selectedSchedule.checkedAt))+' ET. Cached for up to five minutes.':'Schedule information checked September 4, 2026.'} Prices and facility details checked September 4, 2026. PDF schedules require a new review after their date range ends.</p></div></>}</SheetContent></Sheet>
 </>;
}



