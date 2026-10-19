import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname, resolve, sep} from 'node:path';
import {networkInterfaces} from 'node:os';
const root=resolve('web');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.wav':'audio/wav','.mp3':'audio/mpeg','.txt':'text/plain; charset=utf-8'};
const server=createServer(async(req,res)=>{
 try {
  const url=new URL(req.url,'http://localhost');
  let path=decodeURIComponent(url.pathname).replace(/^\/uno(?=\/|$)/,'')||'/';
  const filename=resolve(root,'.'+(path.endsWith('/')?path+'index.html':path));
  if(!filename.startsWith(root+sep)){res.writeHead(403);res.end();return;}
  const data=await readFile(filename);res.writeHead(200,{'Content-Type':types[extname(filename)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);
 }catch{res.writeHead(404);res.end('404');}
});
const port=Number(process.env.PORT)||4175;
server.listen(port,'0.0.0.0',()=>{console.log(`UNO: http://localhost:${port}/uno/`);for(const entries of Object.values(networkInterfaces()))for(const n of entries??[])if(n.family==='IPv4'&&!n.internal)console.log(`http://${n.address}:${port}/uno/`);});
