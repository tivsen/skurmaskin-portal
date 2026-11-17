# Skurmaskin-portal

Personalen trycker på ett objekt när de har kört skurmaskinen. Ansvarig ser hur mycket som körts.

Ingen inloggning. Inga namn sparas.

- Personal: https://tivsen.github.io/skurmaskin-portal/
- Översikt: https://tivsen.github.io/skurmaskin-portal/dashboard.html

Länkarna fungerar först när stegen här under är klara.

Om du läser det här i en pull request: slå ihop den till `main` först. Knappen heter **Merge pull request**.

Gör Google- och GitHub-stegen på en dator. Telefonen används sen för att rapportera.

## 1. Skapa kalkylarket

1. Öppna [sheets.google.com](https://sheets.google.com) och logga in med det Google-konto som ska äga siffrorna.
2. Skapa ett nytt kalkylark.
3. Döp det till `Skurmaskin`.
4. Dela inte kalkylarket. Det ska vara privat. Personalen kommer åt det via webbappen, inte via kalkylarket.

## 2. Klistra in skriptet

1. I kalkylarket: **Tillägg → Apps Script**. På engelska heter det **Extensions → Apps Script**.
2. Markera all text i `Code.gs` och radera den.
3. Öppna filen `apps-script/Code.gs` i det här repot på GitHub.
4. Kopiera allt och klistra in.
5. Högst upp står `TOKEN`. Den ska vara samma ord som `token` i `config.js`. Från början är båda `alvdalen-skur`.
6. Klicka på spara (diskett-ikonen).

## 3. Publicera som webbapp

1. Uppe till höger: **Distribuera → Ny distribution** (Deploy → New deployment).
2. Kugghjulet bredvid **Välj typ** → **Webbapp** (Web app).
3. **Kör som: Jag** (Execute as: Me).
4. **Vem har åtkomst: Alla** (Who has access: Anyone).
   Välj inte "Alla med Google-konto". Då måste personalen logga in.
5. Klicka **Distribuera**.
6. Google ber om lov att ändra kalkylark. Det behövs för att spara rapporterna. Klicka **Tillåt** (Allow).
7. Om det står att Google inte har verifierat appen:
   - Klicka **Avancerat** (Advanced).
   - Klicka **Gå till … (osäker)** (Go to … (unsafe)).
   - Klicka **Tillåt**.
8. Kopiera **webbappens URL**. Den slutar med `/exec`.
   Använd inte adressen som slutar med `/dev`.

## 4. Klistra in adressen

1. På GitHub, öppna repot `skurmaskin-portal`.
2. Klicka på filen `config.js`.
3. Klicka på pennan.
4. Klistra in adressen mellan citattecknen på raden `webAppUrl`.

```javascript
webAppUrl: "https://script.google.com/macros/s/DIN_KOD/exec",
```

5. Låt `token` vara samma ord som `TOKEN` i skriptet.
6. Klicka på gröna **Commit changes**.
7. Välj **Commit directly to the main branch**.

## 5. Slå på GitHub Pages

1. I repot: **Settings → Pages**.
2. Under **Build and deployment**, sätt **Source** till **GitHub Actions**.
3. Öppna fliken **Actions**.
4. Vänta tills jobbet **Publicera sidan** är grönt.
   Om det är rött: öppna det och läs felet. Det vanliga är att Pages inte hunnit slås på. Klicka **Re-run jobs**.

Efter någon minut fungerar länkarna högst upp.

## 6. Prova

1. Öppna personallänken på en telefon.
2. Tryck på ett objekt. Kolla tiden. Tryck **Bekräfta**.
3. Det ska stå **Klart!**
4. Öppna översikten. Körningen ska synas.
5. I kalkylarket finns en flik som heter `Rapporter`.

På telefonen kan du lägga sidan på hemskärmen via webbläsarens meny (Dela → Lägg till på hemskärmen). Då öppnas den som en app.

## Lägga till eller ta bort ett objekt

Allt görs i `config.js`, i listan `objekt`. Ett namn per rad.

1. Öppna `config.js` på GitHub och klicka på pennan.
2. Lägg till en rad, eller radera en rad. Behåll citattecken och kommatecken. Exempel:

```javascript
"Nya stället",
```

3. Använd vanliga raka citattecken `"`, inte sneda citat från Word.
4. **Commit changes** direkt till `main`.
5. Vänta någon minut och ladda om sidan.

Namnet måste stämma exakt. Gamla rapporter för ett borttaget namn syns fortfarande i översikten, med texten att det inte längre finns i listan.

## Byta den enkla nyckeln

Nyckeln är inget lösenord. Den syns för alla som öppnar sidan. Den stoppar bara en del slumpmässigt skräp.

1. Byt till samma nya ord på båda ställena: `token` i `config.js` och `TOKEN` i `Code.gs`.
2. Spara skriptet.
3. Publicera en ny version, se nästa avsnitt. Adressen ska vara oförändrad.
4. Committa `config.js` till `main`.

## Om ni ändrar skriptet senare

En sparad ändring i Apps Script används inte förrän ni publicerar en ny version.

1. **Distribuera → Hantera distributioner** (Manage deployments).
2. Pennan vid webbappen.
3. **Version: Ny version** (New version).
4. **Distribuera**.

URL:en som slutar med `/exec` ska vara densamma. Ändra inte `config.js` om bara skriptet ändrats.

## Vad som sparas

Varje rapport är tre fält:

- `timestamp` — när rapporten togs emot
- `objekt` — vilket ställe
- `reported_at` — när maskinen kördes

Inget namn. Ingen inloggning.

Tiderna i kalkylarket slutar med `Z`. Det är normalt. På webbsidan visas de i svensk tid (Europe/Stockholm). Den som rapporterar i efterhand kan ändra datum och tid innan bekräftelsen.

Översikten kan visa denna vecka (måndag–söndag), denna månad, förra månaden, i år, eller egna datum. Den visar antal, senaste körning, vilka objekt som inte körts, ett stapeldiagram och de senaste rapporterna.

**Ladda ner CSV** ger en fil med semikolon, gjord för svenskt Excel. Öppna den direkt. Importera den inte som komma-separerad, då kan Å, Ä och Ö bli fel.

## Innan adressen är inklistrad

Sidan visar **Inte konfigurerad än**. Då går den att prova i demoläge. Rapporterna sparas bara i den webbläsaren och flyttas inte över till kalkylarket sen.

På översikten finns **Fyll i exempeldata** och **Rensa demoläge**.

## Vem som kan se sidan

Repot är publikt, annars är GitHub Pages inte gratis. Den som har länken kan öppna sidan och läsa rapporterna. Sökmotorer ombeds att inte lista den. Det är inte ett lås. Lägg inga personuppgifter i kalkylarket.

## Om något strular

- **Inte konfigurerad än**, fast adressen är inklistrad: den ska börja med `https://script.google.com/` och sluta med `/exec`. Kolla citattecken och kommatecken i `config.js`.
- **Ogiltig nyckel**: `token` och `TOKEN` är inte samma ord.
- **Kalkylarket kräver inloggning**: åtkomsten är fel. Skapa en ny distribution och välj **Alla**, inte **Alla med Google-konto**. Klistra in den nya adressen.
- **Översikten är tom**: gör en testrapport från telefonen och tryck **Uppdatera**. Titta om fliken `Rapporter` fått en rad.
- **Fliken Rapporter saknas**: i Apps Script, välj funktionen `setup` och klicka på **Kör**. Godkänn om Google frågar.
- **Sidan ser gammal ut**: ladda om. Jobbet under **Actions** ska vara grönt.
- **Å Ä Ö blir konstiga i Excel**: öppna CSV-filen direkt i Excel. Den använder semikolon.
