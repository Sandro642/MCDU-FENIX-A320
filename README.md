# MCDU App Fenix A320

Application de bureau Windows pour utiliser le **Web MCDU natif du Fenix A320**
(système de base Fenix, serveur EFB sur le port **8083**) dans MSFS 2020/2024.

## Fonctionnement

1. **Page 1 — Connexion.** L'app attend que MSFS + l'A320 Fenix soient lancés.
   Elle teste en continu `http://<ip>:8083`. Quand le serveur Fenix répond, le
   voyant passe au vert. Tu peux saisir `localhost` (sim sur le même PC) ou
   l'adresse IP du PC qui exécute le sim (PC distinct sur le réseau local).
   Les adresses locales détectées sont proposées en un clic.

2. **Page 2 — Choix du MCDU.** Bouton **MCDU Gauche (CPT)** ou **MCDU Droite (F/O)**,
   ou « Ouvrir les deux côtés ».

3. **Page 3 — MCDU.** Le MCDU s'affiche (page Web Fenix embarquée). La barre du
   haut permet de basculer **MCDU 1 / MCDU 2 / Les deux** (vue double sur la
   même page). Bouton ⟳ pour recharger.

> Côté Fenix : assure-toi d'avoir « pop-out » le MCDU dans le cockpit et que la
> luminosité de l'écran est à 100 % au premier scan. La sélection CPT/F/O
> définitive se fait dans l'interface MCDU Fenix elle-même.

## Lancer en développement

```bash
npm install
npm start
```

## Logo Fenix

Le logo Fenix (oiseau blanc sur dégradé orange→rose) est intégré :

- `src/assets/logo.png` — affiché sur la page d'accueil (à la place de l'ancien « A320 »).
- `src/assets/icon.png` — version 1024×1024 utilisée comme icône d'application
  (barre des tâches Windows / Dock macOS / installeur).

Le fichier d'origine fourni faisait 225×225 px ; il a été agrandi en 1024×1024
pour satisfaire l'exigence d'icône d'electron-builder (source carrée ≥ 512). Pour
remplacer le logo plus tard, écrase ces deux fichiers en conservant leurs noms.

## Générer les binaires

> ⚠️ Le `.exe` se compile **sur Windows**, le `.dmg`/`.app` **sur un Mac**.

### Vérifier que le build sort bien un dossier `dist/`

Si `npm run dist` semble « packager » sans créer de `dist/`, lance d'abord :

```bash
npm run clean   # supprime un éventuel dist/ verrouillé
npm run pack    # build "répertoire seul", SANS installeur → dist/<platform>-unpacked/
```

`npm run pack` produit toujours un dossier `dist/…-unpacked/` contenant l'app
exécutable. S'il apparaît, l'environnement est bon et le souci venait de
l'empaquetage final (souvent : icône non carrée, antivirus qui bloque l'écriture,
ou cible non compilable sur cet OS). Regarde la dernière ligne du log
electron-builder : elle indique le chemin exact `file=dist/...`.

### Windows (.exe)

```bash
npm install
npm run clean
npm run dist:win
```
→ `dist/MCDU App Fenix A320 Setup 1.0.0.exe`

### macOS (.dmg)

```bash
npm install
npm run clean
npm run dist:mac
```
→ `dist/MCDU App Fenix A320-1.0.0.dmg` (x64 + arm64)

## Configuration avancée

Si ta version de Fenix expose des liens directs par côté, édite l'objet
`PATHS` en haut de `src/renderer.js` (`left` / `right`). Par défaut, les deux
pointent vers la racine `/` de l'EFB, qui contient l'app MCDU sur toutes les
versions.
