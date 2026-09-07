/** Today's date where L.J. plays — PT days roll over on his clock, not UTC's. */
export function todayInChicago(now=new Date()): string {
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Chicago",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(now);
  const part=(key:string)=>parts.find(p=>p.type===key)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/** Calendar time, independent of how many days have been entered in the log. */
export function periodCalendar(startsOn:string, endsOn:string, now=new Date()) {
  const today=todayInChicago(now);
  const start=Date.parse(`${startsOn}T00:00:00Z`), end=Date.parse(`${endsOn}T00:00:00Z`);
  const totalDays=Math.max(0,Math.round((end-start)/86400000)+1);
  const elapsed=Math.max(0,Math.min(totalDays,Math.round((Date.parse(`${today}T00:00:00Z`)-start)/86400000)+1));
  const dates=Array.from({length:elapsed},(_,i)=>new Date(start+i*86400000).toISOString().slice(0,10));
  return {today,totalDays,elapsed,remaining:totalDays-elapsed,dates};
}
