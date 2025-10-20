# 📋 Sistem Klasifikacije Dokumenata - Logika Procesa

**Verzija:** 1.0  
**Datum:** 16. Oktobar 2025

---

## Svrha Dokumenta

Definiše logiku automatske klasifikacije dokumenata (fakture, ugovori, izvodi) koji stižu putem email-a u Invoice Management Tool.

---

## Registracija Organizacije i Klijenata

### 1. Organizacija (Računovodstvena Firma) se Registruje

Pri registraciji unosi:

- **PIB organizacije** - Koristi se za prepoznavanje dokumenata gdje je računovodstvena firma primalac
- Osnovne podatke (naziv, email, adresa)

### 2. Organizacija Dodaje Klijente

Za svakog klijenta unosi:

- **PIB klijenta** (obavezno) - Ključan za OCR identifikaciju
- **Email klijenta** (obavezno) - Koristi se kao fallback identifikacija
- **Brojevi računa** (obavezno za izvode) - Svi računi klijenta:
  - Lokalni format (npr. `540-000000000787106`)
  - IBAN format (npr. `ME25520042000000529729`)
- Ostale podatke (naziv, telefon, grad, industrija)

**Važno:** Email domen klijenta služi kao alternativni način identifikacije kada PIB nije dostupan na dokumentu (npr. fizička lica, reprezentacija).

---

## Proces Klasifikacije Dokumenta

```
┌──────────────────────────────────────┐
│   DOKUMENT STIGAO PUTEM EMAIL-A      │
└────────────────┬─────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────┐
│  KORAK 1: OCR - Ekstrakcija PIB-a    │
│  • Skeniranje dokumenta              │
│  • Pretraga PIB-a u tekstu           │
└────────────────┬─────────────────────┘
                 │
          ┌──────┴──────┐
          │             │
       ✅ PIB         ❌ Nema PIB
       Pronađen       ili ne postoji
          │             │
          │             ▼
          │    ┌─────────────────────────┐
          │    │ KORAK 2: Email Fallback │
          │    │ • Provera email domena  │
          │    └─────────┬───────────────┘
          │              │
          │       ┌──────┴──────┐
          │       │             │
          │    ✅ Email      ❌ Email
          │    Prepoznat    Nije Prepoznat
          │       │             │
          └───────┴─────┐       │
                        │       │
                        │       ▼
                        │  ┌──────────────────┐
                        │  │ MANUAL REVIEW    │
                        │  │ Nedovršen Folder │
                        │  └──────────────────┘
                        │
                        ▼
        ┌─────────────────────────────────┐
        │ KORAK 3: Klasifikacija Tipa     │
        │ • OCR pretraga ključnih reči    │
        │ • AI fallback ako OCR ne uspe   │
        └────────────────┬────────────────┘
                         │
                  ┌──────┴──────┐
                  │             │
               ✅ Tip        ❌ Tip
            Prepoznat      Nije Prepoznat
                  │             │
                  │             ▼
                  │    ┌──────────────────┐
                  │    │ MANUAL REVIEW    │
                  │    │ Nedovršen Folder │
                  │    └──────────────────┘
                  │
                  ▼
        ┌──────────────────────┐
        │ ✅ KLASIFIKACIJA     │
        │    ZAVRŠENA          │
        │ Dokument smešten u   │
        │ odgovarajući folder  │
        └──────────────────────┘
```

---

## Detaljna Logika po Koracima

### **KORAK 1: Identifikacija Klijenta i Tipa Dokumenta**

#### **A) Prepoznavanje Tipa Dokumenta**

**1. IZVOD:**

- **OCR pretraga ključnih riječi:**
  - `"IZVOD"`, `"IZVOD PROMETA"`, `"IZVOD PO RAČUNU"`
  - `"STATEMENT"`, `"BANK STATEMENT"`, `"ACCOUNT STATEMENT"`
  - `"BANKA"`, `"BANK"`, `"BANKING"`
- **AI fallback:** Ako OCR nije siguran, koristi AI za analizu strukture dokumenta

**2. FAKTURA:**

- **OCR pretraga ključnih riječi:**
  - `"FAKTURA"`, `"INVOICE"`, `"RAČUN"`, `"BROJ FAKTURE"`

**3. UGOVOR:**

- **OCR pretraga ključnih riječi:**
  - `"UGOVOR"`, `"CONTRACT"`, `"UGOVORNE STRANKE"`

---

#### **B) Identifikacija Klijenta na IZVODU**

**Prioritet metoda:**

1. **PIB** (ako postoji na izvodu)

   - OCR ekstraktuje PIB
   - Pretraži bazu klijenata po PIB-u

2. **Broj računa** (lokalni ili IBAN format)

   - OCR ekstraktuje broj računa (npr. `540-000000000787106` ili `ME25520042000000529729`)
   - Pretraži bazu klijenata po broju računa

3. **Naziv klijenta** (najmanje pouzdan)
   - OCR ekstraktuje naziv firme
   - Fuzzy matching u bazi klijenata

**AI fallback:** Ako OCR ne uspe, koristi AI za identifikaciju.

**Ishodi:**

- ✅ **Klijent identifikovan** → **KLASIFIKACIJA ZAVRŠENA**
- ❌ **Klijent nije pronađen** → Prelazi na KORAK 2

---

#### **C) Identifikacija Klijenta na FAKTURI**

**Algoritam:**

1. **Ekstraktuj sve PIB-ove** iz dokumenta (OCR)
2. **Za svaki PIB identifikuj okolni tekst** (±200 karaktera)
3. **Pretraži ključne riječi** u okolnom tekstu
4. **Dodeli ulogu** na osnovu konteksta (izdavalac/primalac)
5. **Validiraj** da ima tačno 1 izdavalac i 1 primalac

**Ključni Indikatori:**

1. **Sekcijski naslovi:**

   - `"Izdavalac", "Dobavljač", "Prodavac"` → PIB izdavaoca
   - `"Primalac", "Kupac", "Naručilac"` → PIB primaoca

2. **Pozicija logoa/header-a** - Firma čiji je logo/header na fakturi je obično izdavalac

3. **Bankarski računi** - PIB u bloku gdje su navedeni IBAN/računi je obično izdavaoca (jer njemu se plaća)

**Određivanje Tipa Fakture:**

- **PIB organizacije = PIB primaoca** → **ULAZNA FAKTURA** 📥 (Klijent = PIB izdavaoca)
- **PIB organizacije = PIB izdavaoca** → **IZLAZNA FAKTURA** 📤 (Klijent = PIB primaoca)

**Ishodi:**

- ✅ **Klijent identifikovan + Tip određen** → **KLASIFIKACIJA ZAVRŠENA**
- ❌ **Klijent nije pronađen** → Prelazi na KORAK 2
- ❌ **Tip dokumenta nije određen** → **MANUAL REVIEW** (Nedovršen folder)

---

### **KORAK 2: Identifikacija Klijenta (Email Fallback)**

**Aktivira se ako:** Klijent nije pronađen po PIB-u u KORAKU 1.

1. **Proveri email pošiljaoca** (sa kojeg je stigao dokument)
2. **Izvuci domen** (npr. `@restoran-montenegro.me`)
3. **Pretraži bazu** klijenata po email domenu

**Ishodi:**

- ✅ **Email domen prepoznat** → Klijent identifikovan → **KLASIFIKACIJA ZAVRŠENA**
- ❌ **Email domen nije prepoznat** → **MANUAL REVIEW** (Nedovršen folder)

---

## ⚠️ Manual Review - Nedovršeni Folderi

### Razlozi za Manual Review

1. **Klijent nije identifikovan** (ni po PIB-u, ni po email-u)
2. **Tip dokumenta nije određen** u KORAKU 1 (niska pouzdanost OCR)

### Struktura Nedovršenog Foldera

**Format naziva:**

```
{email_posiljaoca}_{PIB_ako_postoji}_{naziv_firme_ako_postoji}
```

**Primjeri:**

- `marko@gmail.com_PIB_02987654_Restoran_Montenegro`
- `unknown@company.me_NO_PIB`
- `fizicko.lice@gmail.com_PIB_UNKNOWN`

### Vizuelne Oznake

- 🟡 **Žuta boja** foldera (warning status)
- 🔴 **Crvena boja** za urgentne slučajeve
- 🔔 **Aktivne notifikacije** za računovođu
- ⚡ **Highlight** (border, animacija)

---

## Testni Scenariji

### **Scenario 1: Uspešna Klasifikacija Izvoda (Broj Računa Match)** ✅

**Setup:**

- Klijent: "Restoran Montenegro DOO" (PIB: 02987654, Račun: 540-000000000787106)
- Dokument: Izvod iz banke u PDF formatu

**Tok:**

1. Email stigne sa `banka@erste.me`
2. OCR prepoznaje ključne riječi: "IZVOD PROMETA" + "ERSTE BANK"
3. Tip dokumenta: **IZVOD** ✅
4. OCR ekstraktuje broj računa: `540-000000000787106`
5. Sistem pronalazi klijenta u bazi po broju računa
6. Dokument se klasifikuje

**Rezultat:**

```
✅ Tip: IZVOD
✅ Klijent: Restoran Montenegro DOO (Račun match)
✅ Folder: /org_123/Restoran_Montenegro/Izvodi/ime_dokumenta_vrijeme
✅ Status: KLASIFIKOVAN
```

---

### **Scenario 2: Uspešna Klasifikacija Fakture (PIB Match)** ✅

**Setup:**

- Klijent: "IT Company DOO" (PIB: 02333444, Email: office@itcompany.me)
- Dokument: Faktura u PDF formatu

**Tok:**

1. Email stigne sa `kontakt@gmail.com` (privatni email)
2. OCR prepoznaje ključnu riječ: "FAKTURA"
3. Tip dokumenta: **FAKTURA** ✅
4. OCR ekstraktuje PIB: `02333444`
5. Sistem pronalazi klijenta u bazi
6. OCR određuje tip: "Ulazna Faktura"
7. Dokument se klasifikuje

**Rezultat:**

```
✅ Tip: ULAZNA FAKTURA
✅ Klijent: IT Company DOO (PIB match)
✅ Folder: /org_123/IT_Company/Ulazne_Fakture/ime_dokumenta_vrijeme
✅ Status: KLASIFIKOVAN
```

---

### **Scenario 3: Uspešna Klasifikacija (Email Fallback)** ✅

**Setup:**

- Klijent: "Cafe Bar XYZ" (PIB: 02444555, Email: office@cafexyz.me)
- Dokument: Račun bez PIB-a (reprezentacija)

**Tok:**

1. Email stigne sa `marko@cafexyz.me`
2. OCR prepoznaje ključnu riječ: "RAČUN"
3. Tip dokumenta: **FAKTURA** ✅
4. OCR ne pronalazi PIB na dokumentu
5. Sistem prepoznaje email domen `@cafexyz.me`
6. Sistem pronalazi klijenta u bazi
7. Dokument se klasifikuje

**Rezultat:**

```
⚠️  PIB nije pronađen na dokumentu
✅ Tip: FAKTURA
✅ Klijent: Cafe Bar XYZ (Email match)
✅ Folder: /org_123/Cafe_Bar_XYZ/Ulazne_Fakture/ime_dokumenta_vrijeme
✅ Status: KLASIFIKOVAN
```

---

### **Scenario 4: Manual Review - Klijent Nepoznat** ⚠️

**Setup:**

- Email: `unknown@newcompany.me` (nije u bazi)
- Dokument: Faktura sa PIB-om `02777888` (nije u bazi)

**Tok:**

1. Email stigne sa `unknown@newcompany.me`
2. OCR prepoznaje tip: "FAKTURA"
3. OCR ekstraktuje PIB: `02777888`
4. PIB nije pronađen u bazi
5. Email domen nije pronađen u bazi
6. Sistem kreira nedovršen folder

**Rezultat:**

```
✅ Tip: FAKTURA
❌ PIB 02777888 nije u bazi
❌ Email unknown@newcompany.me nije u bazi
⚠️  MANUAL REVIEW potreban
📁 Folder: /manual_review/unknown@newcompany.me-02777888/ime_dokumenta
🔔 Notifikacija poslata računovodstvu i pojavljuje se u aplikaciji
✅ Status: PENDING_REVIEW
```

---

### **Scenario 5: Manual Review - Tip Dokumenta Nepoznat** ⚠️

**Setup:**

- Klijent: "Restoran Super DOO" (postoji u bazi)
- Dokument: Nestandarni dokument (OCR ne prepoznaje tip)

**Tok:**

1. Email stigne sa `office@super.me`
2. OCR ekstraktuje PIB: `02555666`
3. Sistem pronalazi klijenta
4. OCR ne može prepoznati tip dokumenta (nema ključnih reči)
5. AI fallback takođe nije siguran (< 70% pouzdanost)
6. Sistem kreira nedovršen folder

**Rezultat:**

```
✅ Klijent: Restoran Super DOO (PIB match)
❌ Tip dokumenta nije prepoznat (confidence: 45%)
⚠️  MANUAL REVIEW potreban
📁 Folder: /manual_review/office@super.me-02555666/ime_dokumenta
🔔 Notifikacija poslata računovodstvu i pojavljuje se u aplikaciji
✅ Status: PENDING_REVIEW
```

---

## Specijalni Slučajevi

### **1. Izvodi**

**Karakteristike:**

- Naziv dokumenta je jasan: "IZVOD", "BANK STATEMENT"
- Mogu sadržati PIB, ali to nije garantovano
- Uvijek sadrže broj računa (lokalni ili IBAN format)

**Proces identifikacije:**

1. **Tip dokumenta:** OCR prepoznaje ključne riječi ("IZVOD" + "BANKA")
2. **Klijent:**
   - Prioritet 1: PIB (ako postoji)
   - Prioritet 2: Broj računa (najsigurniji metod)
   - Prioritet 3: Naziv klijenta (fuzzy matching)
3. **Rezultat:** Retko zahtevaju manual review

### **2. Ugovori**

**Karakteristike:**

- Uvek sadrže PIB
- Naziv dokumenta je jasan: "UGOVOR", "CONTRACT"

**Proces:**

- Direktna klasifikacija preko PIB-a (KORAK 1)
- Tip prepoznat sa visokom pouzdanošću
- Retko zahtevaju manual review

---

### **3. Fizička Lica (Reprezentacija)**

**Karakteristike:**

- Računi često nemaju PIB
- Šalju se sa privatnih email-ova

**Proces:**

- PIB nije pronađen → Email fallback (KORAK 2)
- Ako email nije u bazi → Manual review
- **Preporuka:** Dodati email fizičkog lica kao dodatni email klijenta

---

## Rezime Logike

| Korak                     | Akcija                  | Uspeh →  | Neuspeh →                 |
| ------------------------- | ----------------------- | -------- | ------------------------- |
| **1. PIB Identifikacija** | OCR + Tip klasifikacija | ZAVRŠENO | KORAK 2 ili MANUAL REVIEW |
| **2. Email Fallback**     | Provera email domena    | ZAVRŠENO | MANUAL REVIEW             |

**Cilj:** Minimizovati manual review (<10% slučajeva) uz održavanje visoke tačnosti klasifikacije.

---
