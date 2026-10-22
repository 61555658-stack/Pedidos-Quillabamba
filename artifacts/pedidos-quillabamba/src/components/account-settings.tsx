import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { api } from '@/lib/operations-api';
import { readSession, updateSessionName } from '@/pages/role-access';
import { Panel, TextInput, btnPrimary, Banner } from './ops/ui';

export function AccountSettings() {
  const [draft,setDraft]=useState({name:'',phone:'',address:''});
  const [loaded,setLoaded]=useState(false);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState<{kind:'ok'|'error';text:string}|null>(null);
  useEffect(()=>{void api<typeof draft>('/api/account').then(d=>{setDraft(d);setLoaded(true);}).catch(e=>setMessage({kind:'error',text:e.message}));},[]);
  const save=async()=>{
    setBusy(true);setMessage(null);
    try{await api('/api/account','PATCH',draft);updateSessionName(draft.name);setMessage({kind:'ok',text:'Perfil guardado en tu cuenta.'});}
    catch(e){setMessage({kind:'error',text:e instanceof Error?e.message:'No se pudo guardar.'});}
    finally{setBusy(false);}
  };
  return <main className="mx-auto max-w-2xl space-y-5 p-5">
    <Link href="/" className="text-sm font-bold">Volver a los negocios</Link>
    <Banner message={message}/>
    <Panel title="Tu perfil" kicker={readSession()?.email}>
      <div className="space-y-4"><TextInput label="Nombre" value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/>
      <TextInput label="Teléfono" value={draft.phone} onChange={e=>setDraft({...draft,phone:e.target.value})}/>
      <TextInput label="Dirección de entrega habitual" value={draft.address} onChange={e=>setDraft({...draft,address:e.target.value})}/>
      <button className={btnPrimary} disabled={!loaded||busy} onClick={()=>void save()}>{busy?'Guardando…':'Guardar perfil'}</button></div>
    </Panel>
  </main>;
}
