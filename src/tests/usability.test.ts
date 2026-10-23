import {describe,it,expect} from 'vitest';
import {assessMapping,suggestSheet,detectMapping,type Sheet} from '../lib/excel';
import {isDeveloper,isProductProjectManagement,prepare,filterRows,metrics,headers,type Values} from '../lib/analytics';
const data=[Object.values(headers),['А','ИТ','Москва','Разработчик','Email']];
const valid:Sheet={name:'Регистрации',data};
describe('Автоматическое распознавание импорта',()=>{
 it('не требует ручных настроек при полном однозначном сопоставлении',()=>expect(assessMapping(valid,0,detectMapping(data[0])).needsAttention).toBe(false));
 it('открывает настройки для пропущенных, повторных полей и пустого листа',()=>{const m=detectMapping(data[0]);expect(assessMapping(valid,0,{...m,city:-1}).needsAttention).toBe(true);expect(assessMapping(valid,0,{...m,city:m.company}).duplicate).toBe(true);expect(assessMapping({...valid,data:[data[0]]},0,m).empty).toBe(true);});
 it('выбирает регистрационный лист вместо служебного и выявляет равные кандидаты',()=>{expect(suggestSheet([{name:'Проверка',data:[['Описание','Значение']]},valid])).toEqual({index:1,ambiguous:false});expect(suggestSheet([valid,{...valid,name:'Второй'}]).ambiguous).toBe(true);});
});
describe('Тематические показатели должностей',()=>{
 it.each(['Разработчик','Ведущий программист','Java Developer','Senior Software Engineer','Frontend-разработчик','Backend developer','Full-stack engineer'])('распознаёт разработчика: %s',role=>expect(isDeveloper(role)).toBe(true));
 it.each(['Инженер','DevSecOps-инженер','Business Developer','Developer Relations Manager','Frontend QA Engineer'])('не приписывает разработку неоднозначной или другой роли: %s',role=>expect(isDeveloper(role)).toBe(false));
 it.each(['Руководитель проектов','Менеджер продукта','Продакт-менеджер','Проджект менеджер','Project manager','Product Owner','Head of Product','CPO','Scrum master'])('распознаёт управление проектами и продуктами: %s',role=>expect(isProductProjectManagement(role)).toBe(true));
 it.each(['Менеджер','Менеджер по продажам','Product designer','Специалист','PM'])('не угадывает специализацию менеджмента: %s',role=>expect(isProductProjectManagement(role)).toBe(false));
 it('пересчитывает новые показатели от одной фильтрованной выборки',()=>{const base:Values={company:'А',industry:'ИТ',city:'Москва',role:'',source:'Email'};const rows=prepare([{...base,role:'Разработчик'},{...base,role:'Product manager'},{...base,role:'Руководитель проектов',source:'Telegram'},{...base,role:'Не указано'}]);expect(metrics(rows)).toMatchObject({developers:1,management:2,unknown:1});expect(metrics(filterRows(rows,{source:['Email']}))).toMatchObject({developers:1,management:1,unknown:1});expect(metrics([])).toMatchObject({developers:0,management:0});});
});
