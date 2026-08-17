export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  const {prompt}=req.body||{};
  if(!prompt) return res.status(400).json({error:'Missing prompt'});
  const key=process.env.GROQ_API_KEY;
  if(!key) return res.status(503).json({error:'GROQ_API_KEY is not configured'});

  const system=`You are MIRRORREALM AI's world-command planner. Convert the user's natural-language request into a SMALL JSON plan for an AR sandbox. Return JSON only, no markdown. Schema: {"title":string,"actions":[{"type":"paint","element":"LAV|SU|BUZ|ÇİMEN|KUM|BULUT|UZAY|VOID|KRİSTAL|ATEŞ|DONMUŞ|MANTAR|ORMAN|AY|TOKSİK|GÖKKUŞAĞI|ELEKTRİK|TAŞ|CYBERPUNK|GLITCH"}]}. Use at most 4 actions. Never claim unsupported real-world geometry manipulation. Prefer existing game tools.`;

  try{
    const r=await fetch('https://api.groq.com/openai/v1/chat/completions',{
      method:'POST',
      headers:{'authorization':`Bearer ${key}`,'content-type':'application/json'},
      body:JSON.stringify({model:'llama-3.3-70b-versatile',temperature:.25,response_format:{type:'json_object'},messages:[{role:'system',content:system},{role:'user',content:String(prompt).slice(0,700)}]})
    });
    if(!r.ok){
      const text=await r.text();
      return res.status(r.status).json({error:'Groq request failed',detail:text.slice(0,500)});
    }
    const data=await r.json();
    const raw=data.choices?.[0]?.message?.content||'{}';
    let plan;
    try{plan=JSON.parse(raw)}catch{plan={title:'AI World',actions:[]}}
    return res.status(200).json({plan});
  }catch(err){
    return res.status(500).json({error:'AI backend error',detail:String(err?.message||err)});
  }
}