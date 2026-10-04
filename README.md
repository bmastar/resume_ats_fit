# RESUME-ATS-FIT

Application Web pour valider et réécrire un CV en version optimisée **ATS** (Applicant Tracking System) à partir d'une annonce d'emploi, via l'API Google **Gemini**, une API compatible **OpenAI** ou bien une API Compatible **Ollama**.

Next.js (App Router) · TypeScript · aucune donnée stockée.

## Fonctionnement
Page de paramétrage :
Paramétrer le provider du LLM, l'URL de l'API si nécéssaire, la clé de l'APi et le modèle à utiliser.

Sur la page d'accueil :
1. Colle **ton CV** dans la première zone ou bien l'importé avec le bouton "Importer un fichier".
2. Colle **l'annonce d'emploi** dans la seconde.
3. Cliquer sur **Scaner mon CV** pour voir le rapport de correspondancedu CV avec l'annonce.
4. Clique sur **Optimiser** Pour optimiser votre CV.
5. Récupère le CV réécrit en PDF ou en docx.

Le CV et l'annonce sont envoyés à l'API le temps de la requête, puis oubliés — rien n'est enregistré côté serveur.

## Installation

```bash
cd cv-ats
npm install
```


## Lancer en développement

```bash
npm run dev
```

Ouvre http://localhost:3000.
