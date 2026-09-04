import {pools,baseSchedule,validDate} from '@/lib/pools';
import {craSchedule} from '@/lib/calendar';
export async function GET(request:Request){const date=new URL(request.url).searchParams.get('date')||'';if(!validDate(date)||date<'2026-01-01'||date>'2028-12-31')return Response.json({error:'Choose a valid date between 2026 and 2028.'},{status:400});const schedules=Object.fromEntries(pools.map(p=>[p.id,baseSchedule(p,date)]));schedules.cra=await craSchedule(date);return Response.json({date,schedules},{headers:{'Cache-Control':'public, max-age=300'}});}
