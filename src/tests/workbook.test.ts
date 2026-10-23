import {readFileSync,existsSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {readExcel,detectHeader,detectMapping,extractRows} from '../lib/excel';
import {fields,prepare,metrics,distribution,filterRows,matrix,classify,normalize,key,groups,type Overrides} from '../lib/analytics';
import {companySuggestions,sourceGroupAliases} from '../lib/normalization';

const fixture=new URL('./fixtures/webinar-100.xlsx',import.meta.url);
const bytes=existsSync(fixture)?readFileSync(fixture):null;
const book=bytes?await readExcel({name:'webinar-100.xlsx',size:bytes.length,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)} as File):[];
const sheet=book.find(s=>s.name==='Регистрации')!;
const raw=sheet?extractRows(sheet,detectHeader(sheet.data),detectMapping(sheet.data[0])):[];
const rows=prepare(raw);
const company:Record<string,string>={};
for(const r of raw){const suggestion=companySuggestions.find(s=>s.variants.some(v=>key(v)===key(r.company)));if(suggestion)company[r.company]=suggestion.target;}
const source=Object.fromEntries(raw.filter(r=>sourceGroupAliases[normalize('source',r.source)]).map(r=>[r.source,sourceGroupAliases[normalize('source',r.source)]]));
const reviewed:Overrides={company,source};

describe.skipIf(!bytes)('Проверочный файл пользователя: 100 регистраций',()=>{
 it('импортирует только регистрационный лист и сохраняет 100 строк',()=>{expect(book.map(s=>s.name)).toEqual(['Регистрации','Проверка']);expect(raw).toHaveLength(100);expect(rows[91].raw.company).toBe(' Яндекс ');expect(fields.map(f=>new Set(raw.map(r=>r[f].trim())).size)).toEqual([82,32,43,50,22]);});
 it('сохраняет три точных повтора с известными номерами строк Excel',()=>{const duplicates=raw.flatMap((r,i)=>{const j=raw.findIndex(x=>JSON.stringify(x)===JSON.stringify(r));return j<i?[[i+2,j+2]]:[];});expect(duplicates).toEqual([[86,45],[94,17],[98,15]]);expect(new Set(raw.map(r=>JSON.stringify(r))).size).toBe(97);expect(metrics(rows).registrations).toBe(100);});
 it('без ручного объединения компаний не угадывает их идентичность',()=>{expect(metrics(rows)).toMatchObject({registrations:100,companies:81,cities:32,industries:22,sources:11,multiple:17,unknown:2});expect(rows.find(r=>r.raw.company==='Газпром')!.company).not.toBe(rows.find(r=>r.raw.company==='ПАО «Газпром»')!.company);});
 it('даёт 70 компаний, 24 повторных компании и 8 каналов после проверенных объединений',()=>{const result=prepare(raw,reviewed);expect(metrics(result)).toMatchObject({registrations:100,companies:70,multiple:24,cities:32,industries:22,sources:8,unknown:2});expect(distribution(result,'company').filter(d=>d.value===3)).toHaveLength(6);expect(distribution(result,'company').filter(d=>d.value===2)).toHaveLength(18);expect(distribution(result,'source').map(d=>[d.name,d.value])).toEqual([['Email',32],['Telegram',23],['Партнёры',14],['ВКонтакте',10],['Сайт',10],['Контекстная реклама',7],['Личное приглашение',3],['Органический поиск',1]]);});
 it('проверяет города независимо от исходных вариантов',()=>{expect(distribution(rows,'city').slice(0,4).map(d=>[d.name,d.value])).toEqual([['Москва',16],['Санкт-Петербург',11],['Новосибирск',8],['Екатеринбург',5]]);expect(rows.filter(r=>r.role==='Не указано')).toHaveLength(2);});
 it('распознаёт международные и русские варианты должностей, сохраняя неоднозначность',()=>{for(const role of ['Архитектор ИБ','Аудитор ИБ','Аналитик ИБ','SOC-аналитик','Аналитик SOC','DevSecOps-инженер'])expect(classify(normalize('role',role))).toBe(groups[3]);for(const role of ['CISO','Chief Information Security Officer','Директор по ИБ'])expect(classify(normalize('role',role))).toBe(groups[0]);for(const role of ['CIO','Chief Information Officer','Директор по ИТ','CTO'])expect(classify(normalize('role',role))).toBe(groups[2]);for(const role of ['Руководитель SOC','Заместитель директора по ИБ','Руководитель службы ИБ'])expect(classify(normalize('role',role))).toBe(groups[1]);for(const role of ['Начальник отдела','Инженер','Специалист','Руководитель проектов'])expect(classify(normalize('role',role))).toBe(groups[6]);expect(classify('Руководитель маркетинга')).toBe(groups[6]);});
 it('сверяет совместные фильтры, проценты и пересечения с исходными строками',()=>{const subset=filterRows(rows,{industry:['Нефть и газ'],source:['Email']});expect(subset.map(r=>r.id+2)).toEqual([2,29,38,83,99]);expect(metrics(subset).registrations).toBe(5);const mat=matrix(rows,'group','source',100);expect(mat.cells.flat().reduce((a,b)=>a+b,0)).toBe(100);for(const f of [...fields,'group'] as const){expect(distribution(rows,f).reduce((n,d)=>n+d.value,0)).toBe(100);expect(distribution(rows,f).reduce((n,d)=>n+d.percent,0)).toBeCloseTo(100);}});
});
