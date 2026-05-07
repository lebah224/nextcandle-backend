#!/usr/bin/env python3
"""
NextCandle Server — Collecte de données 24/7 pour Render + Supabase
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Ce serveur tourne sans navigateur ni MT5. Il :
  1. Se connecte au WebSocket Binance (klines M5/M15/H1/H4/D1)
  2. Détecte les setups à chaque bougie fermée
  3. Enregistre tout dans Supabase en temps réel :
       - active_setups  : setup courant par TF
       - trading_journal: résultats finaux (TP1/TP2/SL)
       - oracle_journal : snapshot Oracle à chaque bougie

Variables d'environnement requises (Render → Environment) :
  SUPABASE_URL         : https://xxxx.supabase.co
  SUPABASE_SERVICE_KEY : eyJ... (service_role key — JAMAIS la anon key)
  BINANCE_SYMBOL       : BTCUSDT (défaut)

Déploiement Render :
  Build Command : pip install -r requirements_server.txt
  Start Command : python nextcandle_server.py
  Plan          : Starter ($7/mois) pour éviter le spin-down
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

import asyncio
import json
import logging
import math
import os
import sys
import threading
import time
from collections import deque
from datetime import datetime, timezone

import numpy as np
import requests
import websockets
from flask import Flask, jsonify
from supabase import create_client, Client

# ═════════════════════════════════════════════════════════════════════
#  CONFIG — depuis les variables d'environnement Render
# ═════════════════════════════════════════════════════════════════════
SUPABASE_URL  = os.environ.get('SUPABASE_URL','')
SUPABASE_KEY  = os.environ.get('SUPABASE_SERVICE_KEY','')
SYMBOL        = os.environ.get('BINANCE_SYMBOL','BTCUSDT')
MIN_QUALITY   = float(os.environ.get('MIN_QUALITY','5.5'))
PORT          = int(os.environ.get('PORT', 10000))   # Render injecte PORT

if not SUPABASE_URL or not SUPABASE_KEY:
    print('❌  SUPABASE_URL et SUPABASE_SERVICE_KEY sont requis.')
    sys.exit(1)

# ═════════════════════════════════════════════════════════════════════
#  LOGGING
# ═════════════════════════════════════════════════════════════════════
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s  %(levelname)-8s  %(message)s',
    datefmt='%H:%M:%S',
    handlers=[logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger('NC-Server')

# ═════════════════════════════════════════════════════════════════════
#  SUPABASE CLIENT
# ═════════════════════════════════════════════════════════════════════
try:
    sb: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    log.info(f'Supabase connecté → {SUPABASE_URL[:40]}…')
except Exception as e:
    log.error(f'Supabase init failed: {e}')
    sys.exit(1)

# ═════════════════════════════════════════════════════════════════════
#  KLINE BUFFER
# ═════════════════════════════════════════════════════════════════════
class KlineBuffer:
    TF_MAP = {
        'm5' : '5m',  'm15': '15m',
        'h1' : '1h',  'h4' : '4h',  'd1' : '1d',
    }
    def __init__(self, mx=400):
        self._c  = {tf: deque(maxlen=mx) for tf in self.TF_MAP}
        self._f  = {tf: None            for tf in self.TF_MAP}
        self._lk = {tf: threading.Lock() for tf in self.TF_MAP}
        self._cb = []   # callbacks on close

    def load(self, tf, candles):
        with self._lk[tf]:
            self._c[tf].clear()
            for c in candles[:-1]:
                self._c[tf].append(c)
            if candles:
                self._f[tf] = candles[-1]
        log.info(f'Buffer {tf.upper():>3} chargé — {len(self._c[tf])} bougies')

    def on_kline(self, tf, k, closed):
        c = {'o':float(k['o']),'h':float(k['h']),'l':float(k['l']),
             'c':float(k['c']),'v':float(k['v']),'t':int(k['t'])}
        with self._lk[tf]:
            self._f[tf] = c
            if closed:
                self._c[tf].append(c)
        if closed:
            for cb in self._cb:
                threading.Thread(target=cb, args=(tf, c['c']), daemon=True).start()

    def closed(self, tf):
        with self._lk[tf]:
            return list(self._c[tf])

KB = KlineBuffer()

# ═════════════════════════════════════════════════════════════════════
#  INDICATEURS (portés depuis nextcandle_bot.py)
# ═════════════════════════════════════════════════════════════════════
def ema(s, p):
    if len(s) < p: return np.zeros(len(s))
    k = 2.0/(p+1); out = np.zeros(len(s))
    out[p-1] = s[:p].mean()
    for i in range(p, len(s)):
        out[i] = s[i]*k + out[i-1]*(1-k)
    return out

def rsi(s, p=14):
    if len(s) < p+1: return 50.0
    d = np.diff(s)
    g,l = np.maximum(d,0), np.maximum(-d,0)
    ag,al = g[:p].mean(), l[:p].mean()
    for i in range(p, len(d)):
        ag = (ag*(p-1)+g[i])/p
        al = (al*(p-1)+l[i])/p
    return 100.0 if al==0 else 100-100/(1+ag/al)

def atr(cd, p=14):
    if len(cd)<2: return 0.0
    tr = [max(cd[i]['h']-cd[i]['l'],abs(cd[i]['h']-cd[i-1]['c']),abs(cd[i]['l']-cd[i-1]['c']))
          for i in range(1,len(cd))]
    t = np.array(tr)
    return float(t[-p:].mean()) if len(t)>=p else float(t.mean())

def supertrend(cd, p=10, m=3.0):
    if len(cd) < p+5: return 0
    h,l,c = np.array([x['h'] for x in cd]),np.array([x['l'] for x in cd]),np.array([x['c'] for x in cd])
    hl2 = (h+l)/2
    tr  = np.array([max(h[i]-l[i],abs(h[i]-c[i-1]),abs(l[i]-c[i-1])) for i in range(1,len(cd))])
    av  = ema(tr,p)
    up  = hl2[1:]+m*av; dn = hl2[1:]-m*av
    tr2 = np.zeros(len(av)); tr2[0]=1
    for i in range(1,len(tr2)):
        pu,pl=up[i-1],dn[i-1]
        dn[i]=max(dn[i],pl) if c[i]>pl else dn[i]
        up[i]=min(up[i],pu) if c[i]<pu else up[i]
        if tr2[i-1]==-1: tr2[i]=1 if c[i]>up[i] else -1
        else:            tr2[i]=-1 if c[i]<dn[i] else 1
    return int(tr2[-1])

def detect_swings(cd, lb=3):
    n=len(cd); sh,sl=[],[]
    for i in range(lb,n-lb):
        if all(cd[i]['h']>cd[j]['h'] for j in range(i-lb,i+lb+1) if j!=i): sh.append({'i':i,'p':cd[i]['h']})
        if all(cd[i]['l']<cd[j]['l'] for j in range(i-lb,i+lb+1) if j!=i): sl.append({'i':i,'p':cd[i]['l']})
    return sh,sl

def vwap(cd):
    n=min(96,len(cd)); sl=cd[-n:]
    pv=sum((c['h']+c['l']+c['c'])/3*c['v'] for c in sl)
    v=sum(c['v'] for c in sl)
    return pv/v if v>0 else cd[-1]['c']

def detect_fvg(cd):
    if len(cd)<5: return {'near_bull':None,'near_bear':None,'dir':0}
    price=cd[-1]['c']; b,be=[],[]
    for i in range(2,min(50,len(cd)-2)):
        c1,c3=cd[-(1+i)],cd[-(3+i)]
        if c1['l']>c3['h'] and (c1['l']-c3['h'])/c3['h']*100>0.05:
            b.append({'mid':(c1['l']+c3['h'])/2,'filled':price<c3['h']})
        if c1['h']<c3['l'] and (c3['l']-c1['h'])/c3['l']*100>0.05:
            be.append({'mid':(c1['h']+c3['l'])/2,'filled':price>c1['h']})
    ab=[f for f in b if not f['filled']]; abe=[f for f in be if not f['filled']]
    nb=min(ab,key=lambda f:abs(f['mid']-price),default=None)
    nbe=min(abe,key=lambda f:abs(f['mid']-price),default=None)
    return{'near_bull':nb,'near_bear':nbe,'dir':1 if nb else (-1 if nbe else 0)}

# ═════════════════════════════════════════════════════════════════════
#  HTF BIAS
# ═════════════════════════════════════════════════════════════════════
def calc_htf_bias():
    scores=[]
    for tf in('h4','d1'):
        cd=KB.closed(tf)
        if len(cd)<55: continue
        cls=np.array([c['c'] for c in cd])
        e9=ema(cls,9)[-1]; e21=ema(cls,21)[-1]; e50=ema(cls,min(50,len(cls)))[-1]
        price=cls[-1]
        bull_ema=e9>e21>e50 and price>e50; bear_ema=e9<e21<e50 and price<e50
        ema_s=1.0 if bull_ema else(-1.0 if bear_ema else(0.5 if e9>e21 else -0.5))
        # Structure : HH/HL ou LH/LL sur les 20 dernières bougies
        sh_sw,sl_sw=detect_swings(cd,3)
        if len(sh_sw)>=2 and len(sl_sw)>=2:
            hhhl=(cd[sh_sw[-1]['i']]['h']>cd[sh_sw[-2]['i']]['h'] and
                  cd[sl_sw[-1]['i']]['l']>cd[sl_sw[-2]['i']]['l'])
            lhll=(cd[sh_sw[-1]['i']]['h']<cd[sh_sw[-2]['i']]['h'] and
                  cd[sl_sw[-1]['i']]['l']<cd[sl_sw[-2]['i']]['l'])
            struct_s=1.0 if hhhl else(-1.0 if lhll else 0.0)
        else:
            struct_s=0.0
        st_s=float(supertrend(cd))
        macd_line=ema(cls,12)[-1]-ema(cls,26)[-1]
        macd_s=1.0 if macd_line>0 else(-1.0 if macd_line<0 else 0.0)
        scores.append(ema_s*0.35+struct_s*0.25+st_s*0.25+macd_s*0.15)
    if not scores: return{'dir':0,'bias':0.0,'label':'Neutre'}
    ws=[0.6,0.4] if len(scores)==2 else[1.0]
    combined=max(-1.0,min(1.0,sum(s*w for s,w in zip(scores,ws))))
    dir_=1 if combined>0.2 else(-1 if combined<-0.2 else 0)
    return{'dir':dir_,'bias':combined,'label':'H4+D1 Haussier' if dir_>0 else('H4+D1 Baissier' if dir_<0 else'H4+D1 Neutre')}

# ═════════════════════════════════════════════════════════════════════
#  SESSION
# ═════════════════════════════════════════════════════════════════════
def get_session():
    h=datetime.now(timezone.utc).hour
    overlap=13<=h<17
    if overlap:   return{'nm':'Overlap','ov':True}
    if 7<=h<17:   return{'nm':'London','ov':False}
    if 13<=h<22:  return{'nm':'New York','ov':False}
    if 0<=h<9:    return{'nm':'Tokyo','ov':False}
    return{'nm':'Other','ov':False}

# ═════════════════════════════════════════════════════════════════════
#  MOTEUR DE SETUP (adapté de nextcandle_bot.py)
# ═════════════════════════════════════════════════════════════════════
_htf_cache={'dir':0,'bias':0.0,'label':'Neutre'}
_htf_last=0.0
HTF_REFRESH=300

_active_setups={'m5':None,'m15':None,'h1':None}
_setups_lock=threading.Lock()
_stats={'setups_created':0,'tp1':0,'tp2':0,'sl':0}

def _calc_sl(dir_,entry,cd_m15,cd_h1,entry_tf):
    ref=cd_h1 if entry_tf=='h1' else cd_m15
    atr_now=atr(ref); buf=atr_now*0.3
    fallback=entry-atr_now*1.5 if dir_>0 else entry+atr_now*1.5
    _,sl_sw=detect_swings(ref,3); sh_sw,_=detect_swings(ref,3)
    if dir_>0:
        c=[ref[s['i']]['l'] for s in sl_sw if ref[s['i']]['l']<entry]
        nr=[p for p in c if p>entry*0.97] or [p for p in c if p>entry*0.95]
        return max(nr)-buf if nr else fallback
    else:
        c=[ref[s['i']]['h'] for s in sh_sw if ref[s['i']]['h']>entry]
        nr=[p for p in c if p<entry*1.03] or [p for p in c if p<entry*1.05]
        return min(nr)+buf if nr else fallback

def _find_tp(dir_,entry,sl_dist,cd_m15,cd_h1):
    tp2_max=sl_dist*8
    sh_m15,sl_m15=detect_swings(cd_m15,3); sh_h1,sl_h1=detect_swings(cd_h1,3)
    if dir_>0:
        res_m15=sorted([cd_m15[s['i']]['h'] for s in sh_m15 if cd_m15[s['i']]['h']>entry])
        tp1=res_m15[0] if res_m15 else entry+sl_dist*2.0
        res_h1=sorted([cd_h1[s['i']]['h'] for s in sh_h1 if cd_h1[s['i']]['h']>tp1 and cd_h1[s['i']]['h']<=entry+tp2_max])
        tp2=res_h1[0] if res_h1 else entry+sl_dist*3.5
        if abs(tp1-entry)<sl_dist*1.5: tp1=entry+sl_dist*2.0
        if abs(tp2-entry)<sl_dist*3.0: tp2=entry+sl_dist*3.5
    else:
        sup_m15=sorted([cd_m15[s['i']]['l'] for s in sl_m15 if cd_m15[s['i']]['l']<entry],reverse=True)
        tp1=sup_m15[0] if sup_m15 else entry-sl_dist*2.0
        sup_h1=sorted([cd_h1[s['i']]['l'] for s in sl_h1 if cd_h1[s['i']]['l']<tp1 and cd_h1[s['i']]['l']>=entry-tp2_max],reverse=True)
        tp2=sup_h1[0] if sup_h1 else entry-sl_dist*3.5
        if abs(tp1-entry)<sl_dist*1.5: tp1=entry-sl_dist*2.0
        if abs(tp2-entry)<sl_dist*3.0: tp2=entry-sl_dist*3.5
    return tp1,tp2,abs(tp1-entry)/sl_dist,abs(tp2-entry)/sl_dist

def analyze(tf,htf):
    cd=KB.closed(tf); cd_m15=KB.closed('m15'); cd_h1=KB.closed('h1')
    if len(cd)<55 or len(cd_m15)<30 or len(cd_h1)<20: return None
    price=cd[-1]['c']
    cls=np.array([c['c'] for c in cd])
    e9=ema(cls,9)[-1]; e21=ema(cls,21)[-1]; e50=ema(cls,min(50,len(cls)))[-1]
    rsi_v=rsi(cls); st=supertrend(cd)
    o_score=(
        (1 if e9>e21 else -1)*0.25+(1 if e21>e50 else -1)*0.20+
        (1 if rsi_v>53 else(-1 if rsi_v<47 else 0))*0.20+
        float(st)*0.15
    )
    o_prob=round(50+o_score*50); o_dir=1 if o_score>0.12 else(-1 if o_score<-0.12 else 0)
    if o_dir==0 or o_prob<55: return None
    htf_dir=htf['dir']; htf_bias=abs(htf['bias'])
    if htf_dir!=0 and o_dir!=0 and htf_dir!=o_dir: return None
    setup_dir=o_dir if htf_dir==0 else htf_dir
    vw=vwap(cd); fvg=detect_fvg(cd)
    sh,sl_sw=detect_swings(cd,3)
    last_sh=cd[sh[-1]['i']]['h'] if sh else price*1.02
    last_sl=cd[sl_sw[-1]['i']]['l'] if sl_sw else price*0.98
    sw_rng=last_sh-last_sl
    fib62=last_sh-sw_rng*0.618; fib50=last_sh-sw_rng*0.500
    # Cluster simple
    levels=[l for l in [e21,e50,vw,fib62,fib50,last_sh if setup_dir<0 else last_sl,
                         (fvg['near_bull']['mid'] if fvg['near_bull'] else None) if setup_dir>0 else (fvg['near_bear']['mid'] if fvg['near_bear'] else None)]
            if l and math.isfinite(l) and abs(l-price)/price*100<3.0]
    if not levels: return None
    entry=sum(levels)/len(levels)
    sl_price=_calc_sl(setup_dir,entry,cd_m15,cd_h1,'m15')
    sl_dist=abs(entry-sl_price)
    if sl_dist<price*0.0015 or sl_dist>price*0.025: return None
    tp1,tp2,rr1,rr2=_find_tp(setup_dir,entry,sl_dist,cd_m15,cd_h1)
    if rr1<1.5: return None
    q=(len(levels)*0.4)+(1.5 if htf_dir==setup_dir else 0)+min(1.0,o_prob/100*1.5)
    q+=0.5 if rr1>=2.5 else 0; q+=0.5 if rr2>=3.5 else 0
    quality=min(10.0,max(0.0,q/3.0))
    if quality<MIN_QUALITY: return None
    lm=2.0 if quality>=9 else 1.5 if quality>=8 else 1.0 if quality>=7 else 0.5
    sess=get_session()
    sig_type='BUY LIMIT' if setup_dir>0 and entry<price else('SELL LIMIT' if setup_dir<0 and entry>price else('BUY NOW' if setup_dir>0 else'SELL NOW'))
    return{
        'tf':tf,'dir':setup_dir,'entry':round(entry,2),'sl':round(sl_price,2),
        'tp1':round(tp1,2),'tp2':round(tp2,2),'rr1':round(rr1,2),'rr2':round(rr2,2),
        'quality':round(quality,2),'lot_multiplier':lm,'oracle_prob':o_prob,
        'signal_type':sig_type,'regime':_regime_detect(cd),
        'session':sess['nm'],'overlap':sess['ov'],
        'htf_label':htf['label'],'htf_bias':round(htf['bias'],3),
        'sources':levels[:5],
    }

def _regime_detect(cd):
    if len(cd)<20: return'normal'
    cls=np.array([c['c'] for c in cd[-20:]])
    high=np.array([c['h'] for c in cd[-20:]]); low=np.array([c['l'] for c in cd[-20:]])
    atr_v=np.mean([max(high[i]-low[i],abs(high[i]-cls[i-1]),abs(low[i]-cls[i-1])) for i in range(1,len(cls))])
    rng=(high.max()-low.min()); ratio=rng/atr_v if atr_v>0 else 5
    return'trend' if ratio>6 else('breakout' if ratio>4 else'range')

# ═════════════════════════════════════════════════════════════════════
#  SUPABASE — Fonctions d'écriture
# ═════════════════════════════════════════════════════════════════════
def _sb_upsert(table, data):
    try:
        sb.table(table).upsert(data).execute()
    except Exception as e:
        log.warning(f'Supabase upsert {table}: {e}')

def record_setup(setup):
    """Enregistre un setup actif dans Supabase."""
    _sb_upsert('active_setups',{
        'tf':setup['tf'],'updated_at':datetime.now(timezone.utc).isoformat(),
        'state':'pending','dir':setup['dir'],
        'entry':setup['entry'],'sl':setup['sl'],'tp1':setup['tp1'],'tp2':setup['tp2'],
        'quality':setup['quality'],'oracle_prob':setup['oracle_prob'],
        'signal_type':setup['signal_type'],'regime':setup['regime'],
        'session':setup['session'],'overlap':setup['overlap'],
        'htf_label':setup['htf_label'],'htf_bias':setup['htf_bias'],
        'lot_multiplier':setup['lot_multiplier'],
        'rr1':setup.get('rr1',0),
        'rr2':setup.get('rr2',0),
        'sources':setup.get('sources',[]),    # list Python → JSONB auto via supabase-py
    })
    log.info(f'📡 Setup {setup["tf"].upper()} enregistré → Supabase')

def update_setup_state(tf, state):
    """Met à jour l'état d'un setup."""
    try:
        sb.table('active_setups').update({
            'state':state,'updated_at':datetime.now(timezone.utc).isoformat()
        }).eq('tf',tf).execute()
    except Exception as e:
        log.warning(f'update_setup_state: {e}')

def record_trade_result(tf, setup, result):
    """Enregistre le résultat final dans le journal de trading."""
    trade_id=f'{tf}_{round(setup["entry"])}_{int(setup["created_at"]//60000)}'
    _sb_upsert('trading_journal',{
        'id':trade_id,'t':setup['created_at'],'t_result':int(time.time()*1000),
        'tf':tf,'dir':setup['dir'],'entry':setup['entry'],
        'sl':setup['sl'],'tp1':setup['tp1'],'tp2':setup['tp2'],
        'result':result,'quality':setup['quality'],'lot_multiplier':setup['lot_multiplier'],
        'rr1':setup['rr1'],'rr2':setup['rr2'],
        'htf_bias':setup['htf_bias'],'session':setup['session'],
        'overlap':setup['overlap'],'hour':datetime.now(timezone.utc).hour,
        'oracle_prob':setup['oracle_prob'],'regime':setup['regime'],
    })
    log.info(f'📝 Journal trade {tf.upper()} → {result.upper()} enregistré')

def record_oracle_snapshot(closed_tf, close_price):
    """Enregistre un snapshot Oracle 3-TF dans le journal Oracle."""
    sess=get_session()
    tfs_data={}
    for tf in('m5','m15','h1'):
        cd=KB.closed(tf)
        if not cd: continue
        cp=cd[-1]['c']
        cls=np.array([c['c'] for c in cd])
        e9=ema(cls,9)[-1]; e21=ema(cls,21)[-1]
        rsi_v=rsi(cls); st=supertrend(cd)
        o_score=((1 if e9>e21 else -1)*0.4+(1 if rsi_v>53 else(-1 if rsi_v<47 else 0))*0.35+float(st)*0.25)
        o_dir=1 if o_score>0.10 else(-1 if o_score<-0.10 else 0)
        o_prob=round(50+o_score*50)
        if o_dir==0 or o_prob<55: continue
        tfs_data[tf]={'dir':o_dir,'prob':o_prob,'closePrice':round(cp,2),'outcome':None,'correct':None,'nextClose':None,'pctMove':None}
    if not tfs_data: return

    # Résoudre les anciennes prédictions pour ce TF
    try:
        rows=sb.table('oracle_journal').select('id,tfs').order('t',desc=True).limit(20).execute().data
        for row in rows:
            d=row.get('tfs',{})
            if closed_tf in d and d[closed_tf].get('outcome') is None and d[closed_tf].get('closePrice',0)>0:
                prev_close=d[closed_tf]['closePrice']
                price_up=close_price>prev_close
                correct=(d[closed_tf].get('dir',0)>0 and price_up) or (d[closed_tf].get('dir',0)<0 and not price_up)
                d[closed_tf]['outcome']=1 if price_up else -1
                d[closed_tf]['correct']=correct
                d[closed_tf]['nextClose']=round(close_price,2)
                d[closed_tf]['pctMove']=round((close_price-prev_close)/prev_close*100,3)
                sb.table('oracle_journal').update({'tfs':d}).eq('id',row['id']).execute()
                break
    except Exception as e:
        log.warning(f'Oracle resolve: {e}')

    now=int(time.time()*1000)
    _sb_upsert('oracle_journal',{
        'id':f'{now}_{closed_tf}','t':now,'trigger_tf':closed_tf,
        'session':sess['nm'],'overlap':sess['ov'],
        'hour':datetime.now(timezone.utc).hour,
        'dow':datetime.now(timezone.utc).weekday(),
        'regime':_regime_detect(KB.closed(closed_tf) or []),
        'htf_bias':round(_htf_cache.get('bias',0),3),
        'natr':0,'tfs':tfs_data,
    })

# ═════════════════════════════════════════════════════════════════════
#  BOUCLE PRINCIPALE — on_candle_close
# ═════════════════════════════════════════════════════════════════════
def on_candle_close(tf, close_price):
    global _htf_cache, _htf_last
    now=time.time()
    if tf in('h4','d1') or now-_htf_last>HTF_REFRESH:
        _htf_cache=calc_htf_bias(); _htf_last=now
        log.info(f'📐 HTF: {_htf_cache["label"]} ({_htf_cache["bias"]:+.2f})')

    # Oracle journal
    try: record_oracle_snapshot(tf, close_price)
    except Exception as e: log.warning(f'Oracle snapshot: {e}')

    if tf not in('m5','m15','h1'): return

    with _setups_lock:
        # Monitor les setups actifs
        s=_active_setups.get(tf)
        if s and s.get('state') in('active','tp1_hit','pending'):
            cur=close_price; state=s['state']
            if s['dir']>0:
                if state=='pending' and cur>=s['entry']:
                    s['state']='active'; update_setup_state(tf,'active')
                elif state in('active','tp1_hit') and cur<=s['sl']:
                    record_trade_result(tf,s,'sl'); _active_setups[tf]=None
                    update_setup_state(tf,'stopped'); _stats['sl']+=1
                elif state=='active' and cur>=s['tp1']:
                    s['state']='tp1_hit'; s['sl']=s['entry']
                    update_setup_state(tf,'tp1_hit'); _stats['tp1']+=1
                    record_trade_result(tf,s,'tp1')
                    log.info(f'✅ TP1 {tf.upper()}')
                elif state=='tp1_hit' and cur>=s['tp2']:
                    record_trade_result(tf,s,'tp2'); _active_setups[tf]=None
                    update_setup_state(tf,'tp2_hit'); _stats['tp2']+=1
                    log.info(f'🏆 TP2 {tf.upper()}')
            else:
                if state=='pending' and cur<=s['entry']:
                    s['state']='active'; update_setup_state(tf,'active')
                elif state in('active','tp1_hit') and cur>=s['sl']:
                    record_trade_result(tf,s,'sl'); _active_setups[tf]=None
                    update_setup_state(tf,'stopped'); _stats['sl']+=1
                elif state=='active' and cur<=s['tp1']:
                    s['state']='tp1_hit'; s['sl']=s['entry']
                    update_setup_state(tf,'tp1_hit'); _stats['tp1']+=1
                    record_trade_result(tf,s,'tp1')
                elif state=='tp1_hit' and cur<=s['tp2']:
                    record_trade_result(tf,s,'tp2'); _active_setups[tf]=None
                    update_setup_state(tf,'tp2_hit'); _stats['tp2']+=1
            return  # setup actif → pas de nouveau setup

        # Chercher un nouveau setup
        try:
            setup=analyze(tf,_htf_cache)
        except Exception as e:
            log.warning(f'analyze({tf}): {e}'); return
        if setup is None: return
        setup['created_at']=int(time.time()*1000)
        _active_setups[tf]=setup
        _stats['setups_created']+=1
        record_setup(setup)
        log.info(f'🎯 Setup {tf.upper()} {"LONG▲" if setup["dir"]>0 else "SHORT▼"} '
                 f'@{setup["entry"]} Q{setup["quality"]} Oracle{setup["oracle_prob"]}%')

KB._cb.append(on_candle_close)

# ═════════════════════════════════════════════════════════════════════
#  DONNÉES HISTORIQUES
# ═════════════════════════════════════════════════════════════════════
def fetch_historical():
    log.info('Chargement données historiques…')
    limits={'m5':300,'m15':200,'h1':150,'h4':200,'d1':150}
    tf_map={'m5':'5m','m15':'15m','h1':'1h','h4':'4h','d1':'1d'}
    for tf,bi in tf_map.items():
        for url in(f'https://fapi.binance.com/fapi/v1/klines',
                   f'https://api.binance.com/api/v3/klines'):
            try:
                r=requests.get(url,params={'symbol':SYMBOL,'interval':bi,'limit':limits[tf]},timeout=10)
                if r.status_code==200:
                    cs=[{'o':float(k[1]),'h':float(k[2]),'l':float(k[3]),'c':float(k[4]),'v':float(k[5]),'t':int(k[0])}
                        for k in r.json()]
                    KB.load(tf,cs); break
            except: pass

# ═════════════════════════════════════════════════════════════════════
#  WEBSOCKET BINANCE
# ═════════════════════════════════════════════════════════════════════
WS_URL=('wss://stream.binance.com/stream?streams='
        'btcusdt@kline_5m/btcusdt@kline_15m/btcusdt@kline_1h'
        '/btcusdt@kline_4h/btcusdt@kline_1d')
STREAM_TF={'btcusdt@kline_5m':'m5','btcusdt@kline_15m':'m15','btcusdt@kline_1h':'h1',
           'btcusdt@kline_4h':'h4','btcusdt@kline_1d':'d1'}

async def _ws_loop():
    retry=0
    while True:
        try:
            log.info(f'WebSocket → connexion (tentative {retry+1})')
            async with websockets.connect(WS_URL,ping_interval=20,ping_timeout=30) as ws:
                retry=0; log.info('✅ WebSocket Binance connecté')
                async for raw in ws:
                    msg=json.loads(raw)
                    if not msg.get('stream') or not msg.get('data'): continue
                    tf=STREAM_TF.get(msg['stream'])
                    if not tf: continue
                    k=msg['data']['k']
                    KB.on_kline(tf,{'o':k['o'],'h':k['h'],'l':k['l'],'c':k['c'],'v':k['v'],'t':k['t']},k['x'])
        except Exception as e:
            log.warning(f'WebSocket: {e}')
        wait=min(60,5*2**min(retry,4)); log.info(f'Reconnexion dans {wait}s…'); await asyncio.sleep(wait); retry+=1

# ═════════════════════════════════════════════════════════════════════
#  FLASK — endpoint santé (Render health check)
# ═════════════════════════════════════════════════════════════════════
app=Flask(__name__)

@app.route('/')
def health():
    return jsonify({'status':'ok','symbol':SYMBOL,'stats':_stats,'htf':_htf_cache.get('label')})

@app.route('/stats')
def stats():
    return jsonify({'stats':_stats,'setups':{k:(v['state'] if v else None) for k,v in _active_setups.items()}})

def _run_flask():
    app.run(host='0.0.0.0',port=PORT,debug=False,use_reloader=False)

# ═════════════════════════════════════════════════════════════════════
#  ENTRY POINT
# ═════════════════════════════════════════════════════════════════════
if __name__=='__main__':
    log.info('━'*55)
    log.info('  NextCandle Server — démarrage')
    log.info(f'  Symbole : {SYMBOL}')
    log.info(f'  Supabase: {SUPABASE_URL[:40]}…')
    log.info(f'  Qualité min : {MIN_QUALITY}')
    log.info('━'*55)

    fetch_historical()
    _htf_cache=calc_htf_bias()
    log.info(f'HTF initial: {_htf_cache["label"]} ({_htf_cache["bias"]:+.2f})')

    # Flask dans un thread séparé (Render health checks)
    t=threading.Thread(target=_run_flask,daemon=True,name='flask'); t.start()

    # WebSocket dans la boucle asyncio principale
    log.info('WebSocket Binance…')
    asyncio.run(_ws_loop())
