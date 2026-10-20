import test from 'node:test';
import assert from 'node:assert/strict';
import {TableMotion} from '../public/table-motion.js';

test('canceling a delayed card flight creates no ghost later and releases the waiting presentation',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const old=Object.getOwnPropertyDescriptor(globalThis,'document');let created=0;
  Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement(){created++;throw new Error('A canceled flight must not render');}}});
  t.after(()=>old?Object.defineProperty(globalThis,'document',old):Reflect.deleteProperty(globalThis,'document'));
  const motion=new TableMotion({hand:{replaceChildren(){}},opponent:{replaceChildren(){}},discard:{replaceChildren(){}}});
  const geometry={box:{left:0,top:0,width:80,height:120},width:80,height:120,angle:0};
  const job=motion.fly(geometry,geometry,{delay:250,flat:true,c:{color:'red',value:'3'}});
  assert.equal(created,0);assert.equal(motion.flights.size,1);motion.reset();await job;t.mock.timers.tick(1000);
  assert.equal(created,0);assert.equal(motion.flights.size,0);
});
