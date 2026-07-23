# Bot Discord Shop & Modération

Bot Discord complet en Node.js / discord.js :

- Tickets privés avec menu : compte, échange crypto, remplacement, partenariat
- Catégorie distincte configurable pour chaque type
- Ping staff, claim, fermeture, activation/désactivation autoclose
- Autoclose après 24 h d'inactivité uniquement après claim
- Transcript HTML complet envoyé dans un salon configurable
- Panel produits avec réponse éphémère privée, prix, description et bouton d'achat
- Produits administrables par commandes
- Giveaways interactifs
- Modération : ban, kick, timeout, warn, historique et clear
- Logs : membres, messages supprimés/modifiés, salons, sanctions et tickets
- Rôle `Bot Admin` créé automatiquement
- Base SQLite persistante

## Installation

1. Installe Node.js 20 ou plus récent.
2. Dans le dossier du bot :

```bash
npm install
```

3. Copie `.env.example` en `.env` puis ajoute :

```env
DISCORD_TOKEN=token_du_bot
CLIENT_ID=id_application
GUILD_ID=id_serveur
```

4. Dans le portail développeur Discord, active les intents :
   - Server Members Intent
   - Message Content Intent

5. Invite le bot avec les scopes `bot` et `applications.commands`, avec les permissions nécessaires : gérer salons, rôles, messages, bannir, expulser et modérer.

6. Lance :

```bash
npm start
```

## Configuration dans Discord

Le rôle **Bot Admin** est créé automatiquement. Attribue-le uniquement aux personnes autorisées.

Commandes principales :

```text
/setup channel type:Logs serveur salon:#logs
/setup channel type:Transcripts tickets salon:#transcripts
/setup channel type:Giveaways salon:#giveaways
/setup staff role:@Support
/setup category type:Compte categorie:Achat compte
/setup category type:Échange categorie:Échanges
/setup category type:Remplacement categorie:SAV
/setup category type:Partenariat categorie:Partenariats
/setup autoclose heures:24
/panel type:Tickets
/panel type:Produits
/product add ...
/product remove ...
/product list
/giveaway duree:1h prix:Nitro gagnants:1
```

## Emojis animés

Discord n'accepte un emoji animé dans les composants que si le bot a accès à cet emoji personnalisé. Remplace dans `config.json` un emoji Unicode par la syntaxe ou l'identifiant de ton emoji personnalisé disponible sur le serveur. Les emojis Unicode fournis fonctionnent immédiatement.

## Personnalisation

Édite `config.json` pour modifier : couleurs, nom du shop, textes d'accueil, emojis, catégories, rôle staff, délai autoclose et produits.

## Sécurité

Ne publie jamais le token. Pour les échanges crypto, le bot rappelle de ne jamais communiquer de seed phrase ni de clé privée.
