import { NextRequest } from 'next/server'
import { handleNovaPlanRequest } from '@/lib/nova-ai/server/plan-handler'
export const runtime='nodejs'
export const preferredRegion='dub1'
export const maxDuration=60
export async function POST(request:NextRequest){
  const perfStartedAt=performance.now()
  let safeAssistantAt:number|null=null
  console.log('[realtalk][perf] request_start')
  const enc=new TextEncoder(), ts=new TransformStream(), w=ts.writable.getWriter()
  const send=(event:string,data:unknown)=>w.write(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
  void (async()=>{
    try{
      const response=await handleNovaPlanRequest(request,{onSafeAssistantMessage:(message)=>{
        safeAssistantAt=performance.now()
        console.log('[realtalk][perf]',{
          safe_assistant_ready_ms:Math.round(safeAssistantAt-perfStartedAt),
        })
        return send('assistant',{message})
      }})
      const payload=await response.json()
      const finalAt=performance.now()
      console.log('[realtalk][perf]',{
        safe_assistant_ready_ms:safeAssistantAt===null?null:Math.round(safeAssistantAt-perfStartedAt),
        plan_complete_ms:Math.round(finalAt-perfStartedAt),
      })
      await send('final',{ok:response.ok,status:response.status,payload})
    }catch(error){await send('error',{message:error instanceof Error?error.message:'Erreur RealTalk.'})}
    finally{await w.close()}
  })()
  return new Response(ts.readable,{headers:{'content-type':'text/event-stream; charset=utf-8','cache-control':'no-cache, no-transform'}})
}
