// Inställningar för skurmaskin-portalen.
// Det här är den enda filen ni behöver ändra för objekt, adress och nyckel.
//
// Efter en ändring: spara till grenen main (på GitHub: pennan, sedan Commit changes).
// Sidan uppdateras av sig själv efter någon minut.

window.SKUR_CONFIG = {
  // Klistra in webbadressen från Apps Script här.
  // Den ska börja med https://script.google.com/ och sluta med /exec
  // Lämna tom tills adressen finns. Då visas "Inte konfigurerad än".
  webAppUrl: "",

  // Samma ord måste stå i apps-script/Code.gs vid TOKEN.
  // Det här är bara ett lätt skydd mot skräp, inte ett lösenord.
  // Vem som helst som öppnar sidan kan se nyckeln.
  token: "alvdalen-skur",

  // Ett objekt per rad. Behåll citattecken och kommatecken.
  objekt: [
    "Tallbacken",
    "Älvdalsskolan Högstadiet",
    "Sporthallen",
    "Nodava",
    "Tingshuset",
    "Brandstationen",
    "Tingshuset Toa",
    "Turistbyrån",
    "Höghol",
    "Gläntan",
    "Ambulansen",
    "Älvdalsskolan Mellanstadiet",
    "Furuvägen",
    "Porfytgårdsvägen",
    "Älvdalsskolan Skurmaskin",
    "Kommunhuset",
    "Brotvägen",
    "Gula Villan",
    "Rot Skola",
    "Fritte Rot",
    "Tallkotten",
    "Tallbacken Rum",
  ],
};
