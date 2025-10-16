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

### **KORAK 1: Identifikacija Klijenta i Tipa Fakture**

#### **Algoritam za Klasifikaciju Tipa Fakture:**

1. **Ekstraktuj sve PIB-ove** iz dokumenta (OCR)
2. **Za svaki PIB identifikuj okolni tekst** (±200 karaktera)
3. **Pretraži ključne riječi** u okolnom tekstu
4. **Dodeli ulogu** na osnovu konteksta (izdavalac/primalac)
5. **Validiraj** da ima tačno 1 izdavalac i 1 primalac

#### **Ključni Indikatori:**

1. **Sekcijski naslovi** - Tražiti oznake poput:

   - `"Izdavalac", "Dobavljač", "Prodavac"` → PIB izdavaoca
   - `"Primalac", "Kupac", "Naručilac"` → PIB primaoca

2. **Pozicija logoa/header-a** - Firma čiji je logo/header na fakturi je obično izdavalac

3. **Bankarski računi** - PIB u bloku gdje su navedeni IBAN/računi je obično izdavaoca (jer njemu se plaća)

#### **Određivanje Tipa Fakture:**

- **PIB organizacije = PIB primaoca** → **ULAZNA FAKTURA** 📥
  - Klijent = PIB izdavaoca
- **PIB organizacije = PIB izdavaoca** → **IZLAZNA FAKTURA** 📤
  - Klijent = PIB primaoca

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

### **Scenario 1: Uspešna Klasifikacija (PIB Match)** ✅

**Setup:**

- Klijent: "Restoran Montenegro DOO" (PIB: 02987654, Email: office@restoran.me)
- Dokument: Faktura u PDF formatu

**Tok:**

1. Email stigne sa `kontakt@gmail.com` (privatni email)
2. OCR ekstraktuje PIB: `02987654`
3. Sistem pronalazi klijenta u bazi
4. OCR prepoznaje tip: "FAKTURA"
5. Dokument se klasifikuje

**Rezultat:**

```
✅ Klijent: Restoran Montenegro DOO (PIB match)
✅ Tip: Faktura
✅ Folder: /org_123/Restoran_Montenegro/fakture/2025/Q4/
✅ Status: KLASIFIKOVAN
```

---

### **Scenario 2: Uspešna Klasifikacija (Email Fallback)** ✅

**Setup:**

- Klijent: "IT Company DOO" (PIB: 02333444, Email: office@itcompany.me)
- Dokument: Račun bez PIB-a (reprezentacija)

**Tok:**

1. Email stigne sa `marko@itcompany.me`
2. OCR ne pronalazi PIB na dokumentu
3. Sistem prepoznaje email domen `@itcompany.me`
4. Sistem pronalazi klijenta u bazi
5. OCR prepoznaje tip: "FAKTURA"
6. Dokument se klasifikuje

**Rezultat:**

```
⚠️  PIB nije pronađen na dokumentu
✅ Klijent: IT Company DOO (Email match)
✅ Tip: Faktura
✅ Folder: /org_123/IT_Company/fakture/2025/Q4/
✅ Status: KLASIFIKOVAN
```

---

### **Scenario 3: Manual Review - Klijent Nepoznat** ⚠️

**Setup:**

- Email: `unknown@newcompany.me` (nije u bazi)
- Dokument: Faktura sa PIB-om `02777888` (nije u bazi)

**Tok:**

1. Email stigne sa `unknown@newcompany.me`
2. OCR ekstraktuje PIB: `02777888`
3. PIB nije pronađen u bazi
4. Email domen nije pronađen u bazi
5. Sistem kreira nedovršen folder

**Rezultat:**

```
❌ PIB 02777888 nije u bazi
❌ Email unknown@newcompany.me nije u bazi
⚠️  MANUAL REVIEW potreban
📁 Folder: /manual_review/unknown@newcompany.me_PIB_02777888/
🔔 Notifikacija poslata računovodstvu
✅ Status: PENDING_REVIEW
```

---

### **Scenario 4: Manual Review - Tip Dokumenta Nepoznat** ⚠️

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
📁 Folder: /manual_review/office@super.me_PIB_02555666_Restoran_Super/
🔔 Notifikacija poslata računovodstvu
✅ Status: PENDING_REVIEW
```

---

## Specijalni Slučajevi

### **1. Ugovori i Izvodi**

**Karakteristike:**

- Uvek sadrže PIB
- Naziv dokumenta je jasan ("UGOVOR", "IZVOD")

**Proces:**

- Direktna klasifikacija preko PIB-a (KORAK 1)
- Tip prepoznat sa visokom pouzdanošću (KORAK 3)
- Retko zahtevaju manual review

---

### **2. Fizička Lica (Reprezentacija)**

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
