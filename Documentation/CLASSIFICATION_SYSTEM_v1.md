Primjer flowa klasifijakicije dokumenta (fakture) u aplikaciji.

- svaki put ćemo otvoriti dokument (i uz pomoć OCR tehnologije - možda i AI kao fallback načina) započeti registraciju firme klijenta na osnovu PIB-a.
- ako znamo o kojoj se firmi radi na osnovu PIB-a onda ćemo znati da klasifikujemo dokumenta u pravi folder (folder odgovarajuće firme)
- nakon uspješnog koraka registracije firme na osnovu PIB-a, zatim započinjemo registraciju tipa dokumenta (uz pomoć OCR tehnologije - možda i AI kao fallback načina)
- ako uspijemo da registrujemo tip dokumenta, posao za registracijom dokumenta smo završili.

- u koliko na osnovu PIB-a ne registrujemo o kojoj se firmi-klijentu radi, drugi način je da započnemo registraciju na osnovu emaila (domena emaila) - sa obzirom da već imamo sačuvane moguće mejlove klijenata tokom procesa registracije.
  - u slučaju da se desi i da na osnovu maila ne registrujemo klijenta, to mora biti označeno i smješteno na lokaciju (folder) čiji će naziv biti naziv mejla preko kojeg je stigao/stigli dokument/dokumenti + PIB i naziv firme (ako smo ove podatke registrovali - imamo ih dostupne)
    i tu mapu (folder) treba smatrati kao "nedovršenu" mapu, i u tom slučaju je potreba čovjekova aktivnost. Bitno je da za ovakve stvari imamo aktivne notifikacije, takodje ovakav folder treba da bude druge boje i hajlajtovan.
  - ukoliko se desi da ne možemo da registrujemo tip dokumenta (na osnovu postavljenih kriterijuma u programu), to mora biti označeno i smješteno na lokaciju (folder) čiji će naziv biti naziv mejla preko kojeg je stigao/stigli dokument/dokumenti + PIB i naziv firme (ako smo ove podatke registrovali - imamo ih dostupne), i tu mapu (folder) treba smatrati kao "nedovršenu" mapu, i u tom slučaju je potreba čovjekova aktivnost. Bitno je da za ovakve stvari imamo aktivne notifikacije, takodje ovakav folder treba da bude druge boje i hajlajtovan.
