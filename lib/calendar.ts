import ICAL from 'ical.js';
import type {Session,Schedule} from './pools';
const calendarId='c_k2gb7b3uuha709sueckmdaaujg@group.calendar.google.com';
const url=`https://calendar.google.com/calendar/ical/${encodeURIComponent(calendarId)}/public/basic.ics`;
const source='https://charlesriveraquatics.com/lap-swim-schedule/';
let feed:{text:string;at:number}|undefined;let pending:Promise<string>|undefined;
async function calendarText(){if(feed&&Date.now()-feed.at<300000)return feed.text;if(pending)return pending;pending=(async()=>{const r=await fetch(url,{signal:AbortSignal.timeout(10000)});if(!r.ok)throw new Error('Calendar unavailable');const text=await r.text();if(text.length>2000000||!text.startsWith('BEGIN:VCALENDAR'))throw new Error('Invalid calendar');feed={text,at:Date.now()};return text;})();try{return await pending;}finally{pending=undefined;}}
export function expandCalendar(text:string,date:string):Session[]{
 const root=new ICAL.Component(ICAL.parse(text));for(const z of root.getAllSubcomponents('vtimezone'))ICAL.TimezoneService.register(new ICAL.Timezone(z));
 const eastern=ICAL.TimezoneService.get('America/New_York');if(!eastern)throw new Error('Calendar timezone missing');
 const endBoundary=new Date(date+'T23:59:59Z').getTime()+86400000;const startBoundary=new Date(date+'T00:00:00Z').getTime()-86400000;
 const result:Session[]=[];const seen=new Set<string>();
 function append(item:ICAL.Event,start:ICAL.Time,end:ICAL.Time){if(item.component.getFirstPropertyValue('status')==='CANCELLED'||!(/lap/i.test(item.summary||''))||/cancel|closed|no lap/i.test(item.summary))return;
 const a=start.convertToZone(eastern),b=end.convertToZone(eastern);if(a.toString().slice(0,10)!==date)return;const key=`${item.uid}:${a.toString()}`;if(seen.has(key))return;seen.add(key);
 const price=/premium|elite/i.test(item.summary)?20:/community/i.test(item.summary)?8:null;
 result.push({start:a.hour*60+a.minute,end:b.toString().slice(0,10)===date?b.hour*60+b.minute:1440,title:item.summary,lanes:item.location||'Lane allocation not published',price});}
 for(const c of root.getAllSubcomponents('vevent')){if(!c.hasProperty('dtstart'))continue;const event=new ICAL.Event(c);
 if(!event.isRecurring()){if(event.startDate.toJSDate().getTime()>=startBoundary&&event.startDate.toJSDate().getTime()<endBoundary)append(event,event.startDate,event.endDate);continue;}
 const rules=c.getAllProperties('rrule').map(r=>r.getFirstValue() as ICAL.Recur);if(rules.length&&rules.every(r=>r.until&&r.until.toJSDate().getTime()<startBoundary)&&!c.hasProperty('rdate'))continue;
 const it=event.iterator();for(let i=0;i<20000;i++){const next=it.next();if(!next)break;if(next.toJSDate().getTime()>endBoundary)break;if(i===19999)throw new Error('Calendar expansion limit');const detail=event.getOccurrenceDetails(next);if(detail.startDate.toJSDate().getTime()>=startBoundary)append(detail.item,detail.startDate,detail.endDate);}}
 return result.sort((a,b)=>a.start-b.start);
}
export async function craSchedule(date:string):Promise<Schedule>{
 // NO COMP POOL LAP weekday/date combinations identify the 2026–27 season.
 // September 26 is also confirmed by a separately dated 2026 meet announcement.
 const closures=['2026-09-26','2026-10-10','2026-10-11','2026-10-24','2026-11-14','2026-11-15','2026-11-26','2026-12-05','2026-12-06','2026-12-11','2026-12-12','2026-12-13','2027-01-09','2027-01-10','2027-02-06','2027-02-07','2027-03-13','2027-03-14','2027-04-03','2027-04-04','2027-05-31'];
 if(closures.includes(date)||(date>='2026-12-24'&&date<='2027-01-01'))return {status:'closed',sessions:[],note:'No competition-pool lap swimming on the published blackout calendar. Confirm changes with CRA.',source:'https://charlesriveraquatics.com/new-calendar/',checkedAt:'2026-09-04T22:40:00Z'};
 try{const text=await calendarText();const sessions=expandCalendar(text,date);return {status:sessions.length?'published':'unlisted',sessions,note:sessions.length?'Official calendar sessions; booking capacity is not provided. Reserve with CRA before arrival.':'No lap sessions are listed for this date in the calendar feed. This does not establish that the pool is closed; call CRA to confirm.',source,checkedAt:new Date(feed!.at).toISOString(),live:true};}catch{return {status:'unknown',sessions:[],note:'The official calendar could not be loaded. Open its schedule or call CRA; no availability has been assumed.',source,checkedAt:'2026-09-04T22:40:00Z'};}
}
