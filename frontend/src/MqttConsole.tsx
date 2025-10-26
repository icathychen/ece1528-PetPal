import React, { useEffect, useRef, useState } from 'react';
// npm i mqtt
import mqtt from 'mqtt';

type Props = { onBack?: () => void };

export default function MqttConsole({ onBack }: Props) {
  // Default MQTT WebSocket URL - can be overridden via environment variable
  const defaultUrl = 
    (typeof process !== 'undefined' && process.env?.REACT_APP_MQTT_WS_URL) ||
    'ws://localhost:9001';

  const [url, setUrl] = useState<string>(defaultUrl);
  const [status, setStatus] = useState<'disconnected' | 'reconnecting' | 'connected'>('disconnected');
  const [subTopic, setSubTopic] = useState<string>('petpal/#');
  const [pubTopic, setPubTopic] = useState<string>('petpal/test');
  const [pubPayload, setPubPayload] = useState<string>('{"hello":"world"}');

  const logRef = useRef<HTMLPreElement | null>(null);
  const clientRef = useRef<any>(null); // 若你装了 mqtt 的类型，可改成 MqttClient

  const log = (msg: string) => {
    const el = logRef.current;
    if (!el) return;
    el.textContent += msg + '\n';
    el.scrollTop = el.scrollHeight;
  };

  const connect = () => {
    if (clientRef.current) clientRef.current.end(true);
    log(`connecting to ${url} ...`);

    const client = mqtt.connect(url, { reconnectPeriod: 2000 });
    client.on('connect', () => { setStatus('connected'); log('connected'); });
    client.on('reconnect', () => { setStatus('reconnecting'); log('reconnecting...'); });
    client.on('close', () => { setStatus('disconnected'); log('disconnected'); });
    client.on('error', (e: any) => log('error: ' + (e?.message ?? String(e))));
    client.on('message', (t: string, p: Uint8Array) => log(`← ${t} :: ${p.toString()}`));

    clientRef.current = client;
  };

  const doSub = () => {
    const c = clientRef.current;
    if (!c || c.disconnected) return log('not connected');
    c.subscribe(subTopic, (err: any) =>
      log(err ? 'subscribe error: ' + err.message : 'subscribed ' + subTopic)
    );
  };

  const doPub = () => {
    const c = clientRef.current;
    if (!c || c.disconnected) return log('not connected');
    c.publish(pubTopic, pubPayload);
    log(`→ ${pubTopic} :: ${pubPayload}`);
  };

  // 可选：组件挂载后自动连接一次（也可删掉，完全手动点 Connect）
  useEffect(() => {
    connect();
    return () => {
      try { clientRef.current?.end(true); } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <h2>MQTT Web Console</h2>
        <div style={{ display:'flex', gap:8 }}>
          <span>Status: <b>{status}</b></span>
          {onBack && <button onClick={onBack}>Back</button>}
        </div>
      </div>

      {/* 连接行 */}
      <div style={{ marginTop:8, display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
        <label>WebSocket URL:</label>
        <input value={url} onChange={e=>setUrl(e.target.value)} size={36}/>
        <button onClick={connect}>Connect</button>
      </div>

      {/* 订阅行 */}
      <div style={{marginTop:8}}>
        <label>Subscribe topic:&nbsp;</label>
        <input value={subTopic} onChange={e=>setSubTopic(e.target.value)} size={30}/>
        <button onClick={doSub}>Subscribe</button>
      </div>

      {/* 发布行 */}
      <div style={{marginTop:8}}>
        <label>Publish topic:&nbsp;</label>
        <input value={pubTopic} onChange={e=>setPubTopic(e.target.value)} size={24}/>
        <label style={{marginLeft:8}}>Payload:&nbsp;</label>
        <input value={pubPayload} onChange={e=>setPubPayload(e.target.value)} size={30}/>
        <button onClick={doPub}>Publish</button>
      </div>

      <pre ref={logRef} style={{marginTop:12, height:260, overflow:'auto', border:'1px solid #ddd', padding:8, background:'#fafafa'}}/>
    </div>
  );
}
