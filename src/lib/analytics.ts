import {aliases,missingLabels} from './normalization';
export const fields = ['company','industry','city','role','source'] as const;
export type Field = typeof fields[number];
export type Values = Record<Field,string>;
export type Row = Values & {id:number; raw:Values; group:string};
export type Filters = Partial<Record<Field|'group',string[]>>;
export type Overrides = Partial<Record<Field,Record<string,string>>>;
export const labels:Record<Field,string> = {company:'Компания',industry:'Отрасль',city:'Город',role:'Должность',source:'Источник'};
export const headers:Record<Field,string> = {company:'Коммерческое наименование',industry:'Отрасль',city:'Город',role:'Должность гостя',source:'Источник'};
export const MISSING='Не указано';
export const groups=['Высшее руководство','Руководители подразделений ИБ','Руководители ИТ','Специалисты ИБ','Специалисты ИТ','Другие специалисты','Не определено'];
export type Rule={pattern:string;group:string};
const word=(term:string)=>`(?<![\\p{L}\\p{N}])(?:${term})(?![\\p{L}\\p{N}])`;
const security=`${word('ИБ|SOC')}|информационной безопасности|кибербезопасност|защит[а-яё]* персональных данных|devsecops`;
const it=`${word('ИТ|IT|CIO|CTO')}|информационных технологий`;
export const defaultRules:Rule[]=[
 {pattern:`заместител[а-яё]*.*(?:${security})`,group:groups[1]},
 {pattern:`генеральный директор|${word('CEO|CISO')}|директор по информационной безопасности`,group:groups[0]},
 {pattern:`(?:начальник|руководитель|заведующий|head).*(?:${security})`,group:groups[1]},
 {pattern:`(?:${it})-?директор|директор.*(?:${it})|(?:начальник|руководитель).*(?:${it})|${word('CIO|CTO')}`,group:groups[2]},
 {pattern:security,group:groups[3]},
 {pattern:`системный администратор|программист|разработчик|(?:специалист|инженер).*(?:${it})`,group:groups[4]},
 {pattern:'юрист|маркетолог|бухгалтер|менеджер|специалист по комплаенсу',group:groups[5]},
];
export function clean(v:unknown){return String(v??'').normalize('NFKC').replace(/[«»„“”]/g,'"').replace(/\s+/g,' ').trim();}
export function key(v:unknown){return clean(v).toLocaleLowerCase('ru');}
export function isMissing(value:unknown){return missingLabels.has(key(value));}
export function normalize(field:Field,v:unknown){
 const s=clean(v); if(isMissing(s))return MISSING;
 // The city prefix is a formatting variation, never stripped from company names.
 const k=key(field==='city'?s.replace(/^г(?:\.\s*|\s+)/iu,''):s);
 return aliases[field]?.[k]??(field==='city'?s.replace(/^г(?:\.\s*|\s+)/iu,''):s);
}
export function classify(role:string,rules:Rule[]=defaultRules){for(const r of rules){try {if(new RegExp(r.pattern,'iu').test(role))return r.group;}catch{ /* invalid rules are validated in editor */ }}return groups[6];}
export function prepare(raw:Values[],overrides:Overrides={},rules=defaultRules):Row[]{
 const canonical=Object.fromEntries(fields.map(f=>[f,new Map<string,string>()])) as Record<Field,Map<string,string>>;
 return raw.filter(r=>fields.some(f=>clean(r[f]))).map((r,id)=>{const vals={} as Values;for(const f of fields){let s=overrides[f]?.[r[f]]??normalize(f,r[f]);s=clean(s)||MISSING;const k=key(s);if(!canonical[f].has(k))canonical[f].set(k,s);vals[f]=canonical[f].get(k)!;}return {...vals,id,raw:r,group:classify(vals.role,rules)};});
}
export function filterRows(rows:Row[],filters:Filters){return rows.filter(r=>Object.entries(filters).every(([f,vs])=>!vs?.length||vs.includes(r[f as Field|'group'])));}
export function distribution(rows:Row[],field:Field|'group'){const m=new Map<string,number>();for(const r of rows)m.set(r[field],(m.get(r[field])??0)+1);return [...m].map(([name,value])=>({name,value,percent:rows.length?value/rows.length*100:0})).sort((a,b)=>b.value-a.value||a.name.localeCompare(b.name,'ru'));}
export function isDeveloper(role:string){return !/developer relations|business developer|бизнес-разработ|\bqa\b|tester|тестировщик/iu.test(role)&&/разработчик|программист|software (?:engineer|developer)|front[ -]?end|back[ -]?end|full[ -]?stack|(?<![\p{L}])developer(?![\p{L}])/iu.test(role);}
export function isProductProjectManagement(role:string){return /(?:менеджер|руководитель|директор|управляющий).*(?:проект|продукт|программ)|(?:проджект|продакт)(?:[ -]|$)|(?:project|product|program|programme|portfolio).*(?:manager|owner|lead|head)|(?:head|chief).*(?:product|project)|scrum[ -]?master|скрам[ -]?мастер|(?<![\p{L}])cpo(?![\p{L}])/iu.test(role);}
export function metrics(rows:Row[]){const companies=distribution(rows.filter(r=>r.company!==MISSING),'company');return {registrations:rows.length,companies:companies.length,industries:distribution(rows.filter(r=>r.industry!==MISSING),'industry').length,cities:distribution(rows.filter(r=>r.city!==MISSING),'city').length,sources:distribution(rows.filter(r=>r.source!==MISSING),'source').length,multiple:companies.filter(c=>c.value>1).length,leaders:rows.filter(r=>groups.slice(0,3).includes(r.group)).length,security:rows.filter(r=>[groups[1],groups[3]].includes(r.group)||new RegExp(security,'iu').test(r.role)).length,developers:rows.filter(r=>isDeveloper(r.role)).length,management:rows.filter(r=>isProductProjectManagement(r.role)).length,unknown:rows.filter(r=>r.role===MISSING).length};}
export function matrix(rows:Row[],a:Field|'group',b:Field|'group',limit=8){const ys=distribution(rows,a).slice(0,limit),xs=distribution(rows,b).slice(0,limit);const counts=new Map<string,number>();for(const r of rows){const k=JSON.stringify([r[a],r[b]]);counts.set(k,(counts.get(k)??0)+1);}return {ys,xs,cells:ys.map(y=>xs.map(x=>counts.get(JSON.stringify([y.name,x.name]))??0))};}
export function summary(rows:Row[]){if(!rows.length)return ['В текущей выборке нет регистраций. Измените или сбросьте фильтры.'];const m=metrics(rows);const top=(f:Field)=>distribution(rows,f)[0];return [`В выборке ${m.registrations} регистраций из ${m.companies} известных компаний.`,...(['industry','source','city'] as Field[]).map((f,i)=>`${['Ведущая отрасль','Основной источник','Больше всего регистраций из города'][i]} — ${top(f).name}: ${top(f).value} (${top(f).percent.toFixed(1)}% выборки).`),`Регистраций от руководителей — ${m.leaders}; от ИБ-аудитории — ${m.security}. Эти показатели могут пересекаться.`,`От ${m.multiple} компаний поступило две и более регистрации.`];}
export function companyRows(rows:Row[]){const m=new Map<string,Row[]>();for(const r of rows){if(r.company===MISSING)continue;const bucket=m.get(r.company);if(bucket)bucket.push(r);else m.set(r.company,[r]);}return [...m].map(([name,records])=>({name,count:records.length,records,industry:[...new Set(records.map(r=>r.industry))].join(', '),city:[...new Set(records.map(r=>r.city))].join(', '),role:[...new Set(records.map(r=>r.role))].join(', '),source:[...new Set(records.map(r=>r.source))].join(', ')}));}
