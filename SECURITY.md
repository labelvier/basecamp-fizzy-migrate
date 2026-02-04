# ⚠️ BELANGRIJK: Security Advisory

## OAuth Credentials Compromised

De Basecamp OAuth credentials die eerder in deze repository stonden zijn **gecompromitteerd** en moeten worden vervangen.

### Actie Vereist

1. **Ga naar**: https://launchpad.37signals.com/integrations
2. **Verwijder** de oude integration
3. **Maak** een nieuwe integration aan met:
   - Name: `Basecamp Fizzy Migration Tool`
   - Redirect URI: `http://localhost:8000/auth/callback`
4. **Kopieer** de nieuwe Client ID en Client Secret naar je `.env` file

### Waarom?

De oude credentials stonden in eerdere git commits en zijn publiek zichtbaar geweest op GitHub. Hoewel de git history is herschreven, kunnen de credentials nog steeds ergens gecached zijn.

### Wat is er Gedaan?

- ✅ Git history volledig herschreven (alle oude commits verwijderd)
- ✅ Secrets verplaatst naar `.env` file (niet in git)
- ✅ `.env.example` bevat nu alleen placeholders
- ✅ `defaults.js` leest van environment variables
- ✅ Force push naar GitHub met schone history

### Nieuwe Setup

De applicatie werkt nu als volgt:

1. Gebruiker kopieert `.env.example` naar `.env`
2. Gebruiker vult eigen OAuth credentials in
3. Applicatie leest credentials uit environment variables
4. `.env` wordt NOOIT gecommit (staat in `.gitignore`)

## Checklist

- [ ] Oude Basecamp integration verwijderd
- [ ] Nieuwe integration aangemaakt
- [ ] Nieuwe credentials in `.env` gezet
- [ ] Tool getest met nieuwe credentials

## Vragen?

Contact: eric@labelvier.nl
