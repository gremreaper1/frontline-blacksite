'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer, WebSocket } = require('ws');
const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 3000;
const MAX_MESSAGE = 8192;
const MAPS = new Set(['sunset','dustyard','harbor','openworld']);
const GAME_MODES = new Set(['ffa','tdm','killconfirmed']);
const MAX_PLAYERS = 20;
const WEAPONS = {
  smg:{damage:19,range:64,interval:95}, ar:{damage:29,range:100,interval:125}, pistol:{damage:35,range:55,interval:250},
  shotgun:{damage:24,range:30,interval:620}, dmr:{damage:64,range:140,interval:460}, sniper:{damage:100,range:220,interval:1000}
};
const WEAPON_UNLOCKS = {smg:2,ar:1,pistol:1,shotgun:3,dmr:5,sniper:8};
const SKIN_COUNT = 7;
const SPAWNS = {sunset:[[-23,0],[-22,5],[23,0],[22,5],[-20,19],[20,-19]],dustyard:[[-15,0],[-17,8],[15,0],[17,8],[-10,23],[10,-23]],harbor:[[-23,0],[-22,7],[23,0],[22,-7],[-18,20],[18,-20]],openworld:[[-96,-96],[-84,-96],[96,96],[84,96],[-96,84],[96,-84]]};
const CHESTS = {sunset:[[-12,1],[12,-1],[0,12],[0,-12],[0,26],[0,-26]],dustyard:[[0,26],[0,-26],[-17,17],[17,-17],[-26,15],[26,-15]],harbor:[[0,-27],[0,27],[-20,-1],[20,1],[-19,18],[19,-18]],openworld:[[0,0],[0,90],[0,-90],[90,0],[-90,0],[150,150],[-150,-150]]};
const AMMO_PICKUPS = {smg:48,ar:45,pistol:24,shotgun:12,dmr:18,sniper:8};
const rooms = new Map();
const matchmakingQueue = [];
const types = {'html':'text/html; charset=utf-8','js':'text/javascript; charset=utf-8','css':'text/css; charset=utf-8','json':'application/json; charset=utf-8','md':'text/markdown; charset=utf-8','png':'image/png','svg':'image/svg+xml'};
const server = http.createServer((req,res)=>{
  const pathname = new URL(req.url,'http://localhost').pathname;
  if(pathname==='/health'){res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({ok:true,rooms:rooms.size,players:[...rooms.values()].reduce((n,r)=>n+r.players.size,0)}));return;}
  let file = pathname==='/' ? 'index.html' : decodeURIComponent(pathname.slice(1));
  const full = path.resolve(ROOT,file);
  if(!full.startsWith(ROOT+path.sep) && full!==path.join(ROOT,'index.html')){res.writeHead(403);res.end('Forbidden');return;}
  fs.readFile(full,(err,data)=>{if(err){res.writeHead(404,{'content-type':'text/plain; charset=utf-8'});res.end('Not found');return;}res.writeHead(200,{'content-type':types[path.extname(full).slice(1)]||'application/octet-stream','cache-control':'no-cache','x-content-type-options':'nosniff'});res.end(data);});
});
const wss = new WebSocketServer({server,path:'/ws',maxPayload:MAX_MESSAGE});
function clamp(v,min,max){return Math.max(min,Math.min(max,v));}
function num(v,fallback=0){const n=Number(v);return Number.isFinite(n)?n:fallback;}
function text(v,max=16){return String(v??'').replace(/[<>\u0000-\u001f]/g,'').trim().slice(0,max);}
function safeRoom(v){const r=text(v,16).toUpperCase().replace(/[^A-Z0-9_-]/g,'');return r||'BLACKSITE';}
function safeLoadout(value,level=1){const requested=Array.isArray(value)?value:[],available=id=>Boolean(WEAPONS[id])&&(WEAPON_UNLOCKS[id]||1)<=level,primary=available(requested[0])?requested[0]:'ar',secondary=available(requested[1])&&requested[1]!==primary?requested[1]:['pistol','smg','ar','shotgun','dmr','sniper'].find(id=>id!==primary&&available(id));return[primary,secondary||'pistol'];}
function publicPlayer(p){return {id:p.id,name:p.name,skin:p.skin,team:p.team,mapId:p.mapId,x:p.x,y:p.y,z:p.z,yaw:p.yaw,pitch:p.pitch,weapon:p.weapon,health:p.health,kills:p.kills};}
function send(ws,obj){if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(obj));}
function broadcast(room,obj,except=null){const str=JSON.stringify(obj);for(const p of room.players.values())if(p.ws!==except&&p.ws.readyState===WebSocket.OPEN)p.ws.send(str);}
function chooseSpawn(mapId){const arr=SPAWNS[mapId]||SPAWNS.sunset;return arr[Math.floor(Math.random()*arr.length)];}
function join(ws,msg){
  if(ws.player) return; const roomId=safeRoom(msg.room);let room=rooms.get(roomId);const isNew=!room;
  if(!room){room={id:roomId,mapId:MAPS.has(msg.mapId)?msg.mapId:'sunset',mode:GAME_MODES.has(msg.mode)?msg.mode:'ffa',maxPlayers:MAX_PLAYERS,players:new Map(),openedChests:new Set(),scores:{red:0,blue:0},tags:new Map(),quickplay:false};rooms.set(roomId,room);}room.openedChests||=new Set();room.scores||={red:0,blue:0};room.tags||=new Map();
  if(room.players.size>=(room.maxPlayers||MAX_PLAYERS)){send(ws,{type:'error',message:`Room is full (maximum ${room.maxPlayers||MAX_PLAYERS} players).`});return;}
  const id=crypto.randomUUID(),spawn=chooseSpawn(room.mapId),level=clamp(Math.floor(num(msg.level,1)),1,100),loadout=safeLoadout(msg.loadout,level),redCount=[...room.players.values()].filter(player=>player.team==='RED').length,blueCount=[...room.players.values()].filter(player=>player.team==='BLUE').length,team=room.mode==='tdm'||room.mode==='killconfirmed'?(redCount<=blueCount?'RED':'BLUE'):null;const p={id,ws,room,name:text(msg.name,16)||'Operator',skin:clamp(Math.floor(num(msg.skin)),0,SKIN_COUNT-1),level,team,mapId:room.mapId,x:spawn[0],y:0,z:spawn[1],yaw:0,pitch:0,weapon:loadout[0],loadout,health:100,kills:0,lastState:0,lastFire:0,respawnTimer:null};ws.player=p;room.players.set(id,p);
  send(ws,{type:'welcome',id,room:room.id,mapId:room.mapId,mode:room.mode||'ffa',quickplay:room.quickplay||false,team,scores:room.scores,tags:[...room.tags.values()],players:[...room.players.values()].filter(v=>v.id!==id).map(publicPlayer),count:room.players.size});broadcast(room,{type:'player_join',player:publicPlayer(p),count:room.players.size},ws);
  if(!isNew)send(ws,{type:'room_map',mapId:room.mapId,players:[...room.players.values()].filter(v=>v.id!==id).map(publicPlayer)});
  for(const chestId of room.openedChests){const [mapId,index]=chestId.split(':');if(mapId===room.mapId)send(ws,{type:'chest_opened',chestId:index});}
  console.log(`[join] ${p.name} -> ${room.id} (${room.players.size} players)`);
}
function removeFromMatchmaking(ws,notify=false){const index=matchmakingQueue.indexOf(ws);if(index!==-1)matchmakingQueue.splice(index,1);const wasQueued=ws.matchmaking;ws.matchmaking=false;ws.matchData=null;if(notify&&wasQueued)send(ws,{type:'matchmaking',status:'cancelled'});}
function matchmake(ws,msg){
  if(ws.player||ws.matchmaking)return;ws.matchmaking=true;const level=clamp(Math.floor(num(msg.level,1)),1,100);ws.matchData={name:text(msg.name,16)||'Operator',skin:clamp(Math.floor(num(msg.skin)),0,SKIN_COUNT-1),level,mapId:MAPS.has(msg.mapId)?msg.mapId:'sunset',loadout:safeLoadout(msg.loadout,level)};
  let opponent=null;while(matchmakingQueue.length&&!opponent){const candidate=matchmakingQueue.shift();if(candidate.readyState===WebSocket.OPEN&&candidate.matchmaking&&!candidate.player)opponent=candidate;}
  if(!opponent){matchmakingQueue.push(ws);send(ws,{type:'matchmaking',status:'searching'});return;}
  opponent.matchmaking=false;ws.matchmaking=false;const roomId=`DUEL-${crypto.randomUUID().slice(0,8).toUpperCase()}`,mapId=opponent.matchData.mapId;
  rooms.set(roomId,{id:roomId,mapId,maxPlayers:2,mode:'1v1',players:new Map()});
  for(const player of [opponent,ws]){const data=player.matchData;player.matchData=null;join(player,{room:roomId,name:data.name,skin:data.skin,level:data.level,mapId,loadout:data.loadout});}
}
function quickPlay(ws,msg){if(ws.player)return;const level=clamp(Math.floor(num(msg.level,1)),1,100),mode=GAME_MODES.has(msg.mode)?msg.mode:'ffa',mapId=MAPS.has(msg.mapId)?msg.mapId:'sunset';let room=[...rooms.values()].find(candidate=>candidate.quickplay&&candidate.mode===mode&&candidate.mapId===mapId&&candidate.players.size<MAX_PLAYERS);if(!room){const id=`MATCH-${crypto.randomUUID().slice(0,8).toUpperCase()}`;room={id,mapId,maxPlayers:MAX_PLAYERS,mode,quickplay:true,players:new Map(),openedChests:new Set(),scores:{red:0,blue:0},tags:new Map()};rooms.set(id,room);}join(ws,{room:room.id,name:text(msg.name,16)||'Operator',skin:clamp(Math.floor(num(msg.skin)),0,SKIN_COUNT-1),level,mapId:room.mapId,loadout:safeLoadout(msg.loadout,level)});}
function leave(ws){removeFromMatchmaking(ws);const p=ws.player;if(!p)return;const room=p.room;ws.player=null;if(!room)return;if(p.respawnTimer)clearTimeout(p.respawnTimer);room.players.delete(p.id);broadcast(room,{type:'player_left',id:p.id,count:room.players.size});if(!room.players.size)rooms.delete(room.id);console.log(`[leave] ${p.name} <- ${room.id}`);}
function updateState(ws,msg){const p=ws.player;if(!p||!p.room)return;const now=Date.now();if(now-p.lastState<25)return;p.lastState=now;const bounds=p.mapId==='openworld'?219.5:29.5;
  p.x=clamp(num(msg.x,p.x),-bounds,bounds);p.z=clamp(num(msg.z,p.z),-bounds,bounds);p.y=clamp(num(msg.y,p.y),0,5);p.yaw=clamp(num(msg.yaw,p.yaw),-1000,1000);p.pitch=clamp(num(msg.pitch,p.pitch),-1.55,1.55);p.level=clamp(Math.floor(num(msg.level,p.level)),1,100);p.skin=clamp(Math.floor(num(msg.skin,p.skin)),0,SKIN_COUNT-1);if(typeof msg.weapon==='string'&&p.loadout.includes(msg.weapon)&&(WEAPON_UNLOCKS[msg.weapon]||1)<=p.level)p.weapon=msg.weapon;
  const room=p.room;if(room)broadcast(room,{type:'player_state',player:publicPlayer(p)},ws);
}
function openChest(ws,msg){const p=ws.player;if(!p||p.health<=0)return;const room=p.room;if(!room)return;const chestIndex=Number(msg.chestId),positions=CHESTS[p.mapId];if(!Number.isInteger(chestIndex)||!positions||!positions[chestIndex])return;const [x,z]=positions[chestIndex],chestId=`${p.mapId}:${chestIndex}`;if(Math.hypot(p.x-x,p.z-z)>3.2){send(ws,{type:'loot_result',chestId:String(chestIndex),message:'MOVE CLOSER TO THE CHEST'});return;}room.openedChests||=new Set();if(room.openedChests.has(chestId)){send(ws,{type:'loot_result',chestId:String(chestIndex),message:'CHEST ALREADY OPENED'});return;}room.openedChests.add(chestId);if(Math.random()<.58){const ammo=AMMO_PICKUPS[p.weapon]||30;send(ws,{type:'loot_result',chestId:String(chestIndex),reward:'ammo',ammo});}else{p.health=Math.min(100,p.health+35);send(ws,{type:'loot_result',chestId:String(chestIndex),reward:'health',health:p.health});}broadcast(room,{type:'chest_opened',chestId:String(chestIndex)});}
function fire(ws,msg){const p=ws.player;if(!p||p.health<=0)return;const room=p.room;if(!room)return;const weapon=WEAPONS[msg.weapon];if(!weapon||!p.loadout.includes(msg.weapon))return;const now=Date.now();if(now-p.lastFire<weapon.interval*.78)return;p.lastFire=now;
  const target=room.players.get(text(msg.targetId,64));if(!target||target.id===p.id||target.health<=0){send(ws,{type:'shot_result',hit:false});return;}if((room.mode==='tdm'||room.mode==='killconfirmed')&&p.team===target.team){send(ws,{type:'shot_result',hit:false,friendlyFire:true});return;}
  const o=msg.origin||{},d=msg.direction||{};let ox=num(o.x,p.x),oy=num(o.y,p.y+1.6),oz=num(o.z,p.z),dx=num(d.x),dy=num(d.y),dz=num(d.z);const length=Math.hypot(dx,dy,dz);if(length<.5||length>1.5){send(ws,{type:'shot_result',hit:false});return;}dx/=length;dy/=length;dz/=length;
  // Bound the reported muzzle to the shooter's vicinity and validate a line-of-fire cone server-side.
  if(Math.hypot(ox-p.x,oz-p.z)>2.5||oy<p.y-.1||oy>p.y+3){send(ws,{type:'shot_result',hit:false});return;}
  const tx=target.x,ty=target.y+1.0,tz=target.z,vx=tx-ox,vy=ty-oy,vz=tz-oz,along=vx*dx+vy*dy+vz*dz;
  if(along<0||along>weapon.range){send(ws,{type:'shot_result',hit:false});return;}
  const ex=vx-dx*along,ey=vy-dy*along,ez=vz-dz*along;const perpendicular=Math.hypot(ex,ey,ez);const threshold=msg.weapon==='shotgun'?.95:.78;
  if(perpendicular>threshold){send(ws,{type:'shot_result',hit:false});return;}
  const hx=target.x-ox,hy=target.y+1.66-oy,hz=target.z-oz,headAlong=hx*dx+hy*dy+hz*dz,headX=hx-dx*headAlong,headY=hy-dy*headAlong,headZ=hz-dz*headAlong,headshot=headAlong>=0&&headAlong<=weapon.range&&Math.hypot(headX,headY,headZ)<=.4;
  // Small server-authoritative damage/score check. Full anti-cheat and world occlusion are production follow-ups.
  const damage=Math.min(Math.round(weapon.damage*(headshot?2:1)),target.health);target.health=Math.max(0,target.health-damage);const killed=target.health<=0;send(ws,{type:'shot_result',hit:true,targetId:target.id,damage,killed,headshot});send(target.ws,{type:'damaged',damage,health:target.health,fromName:p.name,fromId:p.id,headshot});
  if(killed&&room.mode==='tdm'){room.scores[p.team.toLowerCase()]++;broadcast(room,{type:'team_score',scores:room.scores});}
  if(killed&&room.mode==='killconfirmed'){const tag={id:crypto.randomUUID(),x:target.x,y:target.y,z:target.z,team:target.team};room.tags.set(tag.id,tag);broadcast(room,{type:'tag_spawn',tag});}
  if(killed){p.kills++;broadcast(room,{type:'player_eliminated',id:target.id,killerId:p.id,killerName:p.name});if(target.respawnTimer)clearTimeout(target.respawnTimer);target.respawnTimer=setTimeout(()=>{if(!rooms.get(room.id)||!room.players.has(target.id))return;const s=chooseSpawn(room.mapId);target.x=s[0];target.y=0;target.z=s[1];target.health=100;target.respawnTimer=null;send(target.ws,{type:'respawn',x:target.x,y:0,z:target.z});broadcast(room,{type:'player_state',player:publicPlayer(target)});},2800);}
}
function collectTag(ws,msg){const p=ws.player;if(!p||p.health<=0)return;const room=p.room;if(!room||room.mode!=='killconfirmed')return;const tag=room.tags.get(text(msg.tagId,64));if(!tag)return;if(Math.hypot(p.x-tag.x,p.z-tag.z)>2.5)return;const outcome=p.team===tag.team?'denied':'confirmed';if(outcome==='confirmed')room.scores[p.team.toLowerCase()]++;room.tags.delete(tag.id);const result={type:'tag_result',tagId:tag.id,outcome,scores:room.scores};broadcast(room,{type:'tag_removed',tagId:tag.id,outcome,scores:room.scores});send(ws,result);}
wss.on('connection',ws=>{
  ws.isAlive=true;ws.on('pong',()=>ws.isAlive=true);
  ws.on('message',(buffer)=>{if(buffer.length>MAX_MESSAGE){ws.close(1009,'message too large');return;}let msg;try{msg=JSON.parse(buffer.toString());}catch{return;}if(!msg||typeof msg.type!=='string')return;if(msg.type==='join')join(ws,msg);else if(msg.type==='quickplay')quickPlay(ws,msg);else if(msg.type==='matchmake')matchmake(ws,msg);else if(msg.type==='cancel_matchmaking')removeFromMatchmaking(ws,true);else if(msg.type==='state')updateState(ws,msg);else if(msg.type==='loot_chest')openChest(ws,msg);else if(msg.type==='collect_tag')collectTag(ws,msg);else if(msg.type==='fire')fire(ws,msg);});
  ws.on('close',()=>leave(ws));ws.on('error',()=>leave(ws));
});
const heartbeat=setInterval(()=>{for(const ws of wss.clients){if(ws.isAlive===false){ws.terminate();continue;}ws.isAlive=false;ws.ping();}},30000);wss.on('close',()=>clearInterval(heartbeat));
server.listen(PORT,'0.0.0.0',()=>console.log(`FRONTLINE BLACKSITE listening on http://localhost:${PORT}`));
