import express from 'express';
import session from 'express-session';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const PORT = process.env.PORT || 3000;
const CLIENT_ID = process.env.DERIV_CLIENT_ID || '';
const CLIENT_SECRET = process.env.DERIV_CLIENT_SECRET || '';
const REDIRECT_URI = process.env.DERIV_REDIRECT_URI || `http://localhost:${PORT}/oauth/callback`;
const APP_ID = process.env.DERIV_APP_ID || '';
const API = 'https://api.derivws.com';

app.use(express.json());
app.use(session({secret: process.env.SESSION_SECRET || 'change-this-secret',resave:false,saveUninitialized:false,cookie:{httpOnly:true,sameSite:'lax',secure:false,maxAge:3600000}}));
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, 'public')));

function b64url(buf){return Buffer.from(buf).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
function random(){return b64url(crypto.randomBytes(32));}
async function challenge(verifier){return b64url(crypto.createHash('sha256').update(verifier).digest());}

app.get('/auth/login', async (req,res)=>{
  if(!CLIENT_ID) return res.status(500).send('DERIV_CLIENT_ID is not configured. See README.md');
  const verifier=random(), state=random(), cc=await challenge(verifier);
  req.session.pkce=verifier; req.session.state=state;
  const u=new URL('https://auth.deriv.com/oauth2/auth');
  u.searchParams.set('response_type','code'); u.searchParams.set('client_id',CLIENT_ID);
  u.searchParams.set('redirect_uri',REDIRECT_URI); u.searchParams.set('scope','trade');
  u.searchParams.set('state',state); u.searchParams.set('code_challenge',cc); u.searchParams.set('code_challenge_method','S256');
  res.redirect(u.toString());
});

app.get('/oauth/callback', async (req,res)=>{
  try{
    if(!req.query.code || req.query.state !== req.session.state) return res.status(400).send('Invalid OAuth callback/state.');
    const body=new URLSearchParams({grant_type:'authorization_code',client_id:CLIENT_ID,code:req.query.code,code_verifier:req.session.pkce,redirect_uri:REDIRECT_URI});
    const r=await fetch('https://auth.deriv.com/oauth2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});
    const j=await r.json(); if(!r.ok) return res.status(r.status).json(j);
    req.session.token=j.access_token; delete req.session.pkce; delete req.session.state;
    res.redirect('/?connected=1');
  }catch(e){res.status(500).send('OAuth error: '+e.message)}
});

async function api(path, opts={}){
  if(!opts.headers) opts.headers={};
  opts.headers.Authorization=`Bearer ${opts.token}`;
  if(APP_ID) opts.headers['Deriv-App-ID']=APP_ID;
  return fetch(API+path,opts);
}

app.get('/api/status',(req,res)=>res.json({connected:!!req.session.token, partnerConnected:!!req.session.token}));
app.get('/api/partner/overview', async (req,res)=>{
  if(!req.session.token) return res.status(401).json({error:'Not connected'});
  const start=req.query.start || new Date(Date.now()-30*86400000).toISOString().slice(0,10);
  const end=req.query.end || new Date().toISOString().slice(0,10);
  const r=await api(`/partners/analytics/v1/overview?start_date=${encodeURIComponent(start)}&end_date=${encodeURIComponent(end)}`,{token:req.session.token});
  const j=await r.json(); if(!r.ok) return res.status(r.status).json(j); res.json(j);
});
app.get('/api/partner/markup', async (req,res)=>{
  if(!req.session.token) return res.status(401).json({error:'Not connected'});
  const from=req.query.from || new Date(Date.now()-30*86400000).toISOString().slice(0,10);
  const to=req.query.to || new Date().toISOString().slice(0,10);
  const r=await api(`/applications/v1/markup-statistics?date_from=${encodeURIComponent(from)}&date_to=${encodeURIComponent(to)}`,{token:req.session.token});
  const j=await r.json(); if(!r.ok) return res.status(r.status).json(j); res.json(j);
});
app.post('/api/partner/client-tags', async (req,res)=>{
  if(!req.session.token) return res.status(401).json({error:'Not connected'});
  const ids=Array.isArray(req.body.client_ids)?req.body.client_ids.slice(0,100):[];
  const r=await api('/partners/client-tags/check',{method:'POST',token:req.session.token,headers:{'Content-Type':'application/json'},body:JSON.stringify({client_ids:ids})});
  const j=await r.json(); if(!r.ok) return res.status(r.status).json(j); res.json(j);
});
app.get('/api/accounts', async (req,res)=>{
  if(!req.session.token) return res.status(401).json({error:'Not connected'});
  const r=await api('/trading/v1/options/accounts',{token:req.session.token}); const j=await r.json();
  if(!r.ok) return res.status(r.status).json(j); res.json(j);
});
app.post('/api/ws-url', async (req,res)=>{
  if(!req.session.token) return res.status(401).json({error:'Not connected'});
  const accountId=String(req.body.accountId||'');
  if(!accountId) return res.status(400).json({error:'accountId required'});
  const r=await api(`/trading/v1/options/accounts/${encodeURIComponent(accountId)}/otp`,{method:'POST',token:req.session.token});
  const j=await r.json(); if(!r.ok) return res.status(r.status).json(j); res.json(j);
});
app.post('/auth/logout',(req,res)=>req.session.destroy(()=>res.json({ok:true})));
export default app;
if (process.env.VERCEL !== '1') app.listen(PORT,()=>console.log(`TradePilot running on http://localhost:${PORT}`));
