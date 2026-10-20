// A small MQTT 3.1.1 client for persistent fallback delivery. No HTTP game polling.
// https://test.mosquitto.org/ and https://www.hivemq.com/mqtt/public-mqtt-broker/
export const SOCKET_RELAYS=['wss://test.mosquitto.org:8081/mqtt','wss://broker.hivemq.com:8884/mqtt'];
const encoder=new TextEncoder(),decoder=new TextDecoder();
const text=value=>{const bytes=encoder.encode(value);return [bytes.length>>8,bytes.length&255,...bytes];};
export function mqttPacket(type,body=[]){let length=body.length,encoded=[];do{let byte=length%128;length=Math.floor(length/128);if(length)byte|=128;encoded.push(byte);}while(length);return new Uint8Array([type,...encoded,...body]);}
export class SocketBus {
  constructor({topic,onMessage,onReady,onOffline,WebSocket:Socket=globalThis.WebSocket,urls=SOCKET_RELAYS}){Object.assign(this,{topic,onMessage,onReady,onOffline,Socket,urls});this.links=new Set();this.closed=false;this.counter=1;}
  start(){for(const url of this.urls)this.open(url);}
  get ready(){return [...this.links].some(link=>link.ready);}
  open(url){
    if(this.closed)return;const link={url,ready:false,buffer:new Uint8Array()};this.links.add(link);
    const socket=link.socket=new this.Socket(url,'mqtt');socket.binaryType='arraybuffer';
    link.timeout=setTimeout(()=>socket.close(),5000);
    socket.onopen=()=>socket.send(mqttPacket(0x10,[...text('MQTT'),4,2,0,20,...text('uno-'+crypto.randomUUID())]));
    socket.onmessage=event=>{try{this.receive(link,new Uint8Array(event.data));}catch{socket.close();}};
    socket.onerror=()=>socket.close();
    socket.onclose=()=>{clearTimeout(link.timeout);clearInterval(link.ping);this.links.delete(link);if(!this.ready)this.onOffline?.();if(!this.closed){link.retry=setTimeout(()=>{this.links.delete(link);this.open(url);},1000);this.links.add(link);}};
  }
  receive(link,bytes){
    link.lastPacket=Date.now();
    const buffer=new Uint8Array(link.buffer.length+bytes.length);buffer.set(link.buffer);buffer.set(bytes,link.buffer.length);let offset=0;
    while(offset<buffer.length){
      let at=offset+1,length=0,multiplier=1,byte;
      do{if(at>=buffer.length){link.buffer=buffer.slice(offset);return;}byte=buffer[at++];length+=(byte&127)*multiplier;multiplier*=128;if(multiplier>268435456)throw Error('MQTT length');}while(byte&128);
      if(length>1048576)throw Error('MQTT packet too large');if(at+length>buffer.length){link.buffer=buffer.slice(offset);return;}
      const type=buffer[offset]>>4,body=buffer.subarray(at,at+length);
      if(type===2){if(body[1]!==0)throw Error('MQTT connection rejected');link.socket.send(mqttPacket(0x82,[0,1,...text(this.topic),0]));}
      if(type===9){if(body[2]===128)throw Error('MQTT subscription rejected');clearTimeout(link.timeout);link.ready=true;link.ping=setInterval(()=>{if(Date.now()-link.lastPacket>12000){link.socket.close();return;}if(link.socket.readyState===1)link.socket.send(mqttPacket(0xc0));},5000);this.onReady?.();}
      if(type===3){const size=body[0]*256+body[1],qos=(buffer[offset]>>1)&3,start=2+size+(qos?2:0);if(qos===1)link.socket.send(mqttPacket(0x40,body.subarray(2+size,4+size)));if(decoder.decode(body.subarray(2,2+size))===this.topic)this.onMessage?.(JSON.parse(decoder.decode(body.subarray(start))));}
      offset=at+length;
    }
    link.buffer=buffer.slice(offset);
  }
  send(message){
    const packet=mqttPacket(0x30,[...text(this.topic),...encoder.encode(JSON.stringify(message))]);let sent=false;
    for(const link of this.links)if(link.ready&&link.socket.readyState===1){try{link.socket.send(packet);sent=true;}catch{}}
    return sent;
  }
  close(){this.closed=true;for(const link of this.links){clearTimeout(link.retry);clearTimeout(link.timeout);clearInterval(link.ping);link.socket?.close();}this.links.clear();}
}
