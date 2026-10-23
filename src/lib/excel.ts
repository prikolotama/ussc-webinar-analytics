import * as XLSX from 'xlsx';
import {fields,headers,key,clean,type Values,type Field} from './analytics';
export type Sheet={name:string;data:unknown[][]};
export type Mapping=Record<Field,number>;
export async function readExcel(file:File):Promise<Sheet[]>{if(!/\.xlsx?$/i.test(file.name))throw new Error('Выберите Excel-файл в формате .xlsx или .xls.');if(file.size>30*1024*1024)throw new Error('Размер файла превышает 30 МБ.');const book=XLSX.read(await file.arrayBuffer(),{type:'array'});const sheets=book.SheetNames.map(name=>({name,data:XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[name],{header:1,defval:'',blankrows:false})}));if(!sheets.some(s=>s.data.length))throw new Error('В книге нет данных.');return sheets;}
export function detectHeader(data:unknown[][]){let best=0,score=-1;data.slice(0,30).forEach((r,i)=>{const n=fields.filter(f=>r.some(v=>aliases[f].includes(key(v)))).length;if(n>score){score=n;best=i;}});return best;}
const aliases:Record<Field,string[]>={company:[key(headers.company),'компания','наименование компании','организация'],industry:['отрасль','сфера деятельности'],city:['город','география'],role:['должность гостя','должность','позиция'],source:['источник','канал','источник привлечения']};
export function detectMapping(row:unknown[]):Mapping{return Object.fromEntries(fields.map(f=>[f,row.findIndex(v=>aliases[f].includes(key(v)))])) as Mapping;}
export function extractRows(sheet:Sheet,header:number,mapping:Mapping):Values[]{return sheet.data.slice(header+1).filter(r=>fields.some(f=>clean(r[mapping[f]]))).map(r=>Object.fromEntries(fields.map(f=>[f,String(r[mapping[f]]??'')])) as Values);}

export function assessMapping(sheet:Sheet,header:number,mapping:Mapping){
 const missing=fields.filter(f=>mapping[f]<0);
 const used=Object.values(mapping).filter(v=>v>=0);
 const duplicate=new Set(used).size!==used.length;
 const empty=extractRows(sheet,header,mapping).length===0;
 return {missing,duplicate,empty,needsAttention:missing.length>0||duplicate||empty};
}
export function suggestSheet(sheets:Sheet[]){
 const scores=sheets.map(s=>{const h=detectHeader(s.data);const m=detectMapping(s.data[h]??[]);return fields.filter(f=>m[f]>=0).length;});
 const best=Math.max(...scores);const matches=scores.flatMap((n,i)=>n===best?[i]:[]);
 return {index:matches[0]??0,ambiguous:matches.length>1};
}
