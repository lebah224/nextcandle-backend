# 🕯 NextCandle Server

Serveur de collecte de données 24/7 pour le bot de trading BTC/USDT.  
Se connecte au WebSocket Binance, détecte les setups, enregistre tout dans Supabase en temps réel.

## Architecture

```
Binance WebSocket  →  nextcandle_server.py  →  Supabase
                            (Render)            (PostgreSQL + Realtime)
                                                      ↓
                                               candleIndex.html
                                               (mise à jour auto)
```

## Fichiers

| Fichier | Rôle |
|---------|------|
| `nextcandle_server.py` | Serveur principal — WebSocket, analyse, écriture Supabase |
| `requirements_server.txt` | Dépendances Python |
| `render.yaml` | Configuration Render (détectée automatiquement) |

## Déploiement sur Render

### 1. Forker / Cloner ce repo sur ton compte GitHub

### 2. Créer le service sur Render
- [render.com](https://render.com) → **New → Web Service**
- Connecter ce repo GitHub
- Render détecte `render.yaml` automatiquement

### 3. Variables d'environnement (Render Dashboard → Environment)

| Variable | Valeur |
|----------|--------|
| `SUPABASE_URL` | `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_KEY` | `eyJ...` (service_role secret) |
| `BINANCE_SYMBOL` | `BTCUSDT` |
| `MIN_QUALITY` | `5.5` |

> ⚠️ **Ne jamais mettre les clés dans ce repo.** Les variables d'env sont gérées dans le Dashboard Render uniquement.

### 4. Vérifier le déploiement

```
GET https://[ton-service].onrender.com/
→ {"status": "ok", "symbol": "BTCUSDT", ...}
```

### 5. Surveiller les logs

Render Dashboard → Logs :
```
10:00:01  INFO  Supabase connecté → https://xxxx.supabase.co…
10:00:02  INFO  Buffer M5  chargé — 299 bougies
10:00:07  INFO  WebSocket Binance connecté
10:05:00  INFO  🎯 Setup M15 LONG @ 104500 Q6.8
10:05:01  INFO  📡 Setup M15 enregistré → Supabase
```

## Plan Render recommandé

**Starter ($7/mois)** — ne spin-down jamais.  
Le plan gratuit s'éteint après 15 min d'inactivité → données manquantes.

## Supabase — Schema

Le schéma SQL est dans le dossier `supabase/` du zip fourni séparément.  
À exécuter dans Supabase Dashboard → SQL Editor.

## Données collectées

- **`active_setups`** : setup courant par TF (M5, M15, H1)
- **`trading_journal`** : résultats des trades (TP1, TP2, SL)
- **`oracle_journal`** : snapshot Oracle 3-TF à chaque bougie fermée
