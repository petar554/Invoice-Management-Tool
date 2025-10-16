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

### **KORAK 1: Identifikacija Klijenta (PIB)**

1. **Otvori dokument** i primeni OCR tehnologiju
2. **Ekstraktuj PIB** iz teksta (8 cifara)
3. **Pretraži bazu** klijenata organizacije po PIB-u

**Ishodi:**

- ✅ **PIB pronađen** → Klijent identifikovan → Prelazi na KORAK 3
- ❌ **PIB nije pronađen** → Prelazi na KORAK 2

---

### **KORAK 2: Identifikacija Klijenta (Email Fallback)**

**Aktivira se ako:** PIB nije pronađen ili ne postoji u bazi.

1. **Proveri email pošiljaoca** (sa kojeg je stigao dokument)
2. **Izvuci domen** (npr. `@restoran-montenegro.me`)
3. **Pretraži bazu** klijenata po email domenu

**Ishodi:**

- ✅ **Email domen prepoznat** → Klijent identifikovan → Prelazi na KORAK 3
- ❌ **Email domen nije prepoznat** → **MANUAL REVIEW** (Nedovršen folder)

---

### **KORAK 3: Klasifikacija Tipa Dokumenta (TBD)**

**Aktivira se ako:** Klijent je uspešno identifikovan (preko PIB-a ili email-a).

1. **OCR analiza** teksta dokumenta
2. **Pretraga ključnih reči:**
   - Faktura: "FAKTURA", "INVOICE", "RAČUN", "BROJ FAKTURE"
   - Ugovor: "UGOVOR", "CONTRACT", "UGOVORNE STRANKE"
   - Izvod: "IZVOD", "BANK STATEMENT", "TRANSAKCIJE"
3. **AI fallback** (ako OCR nije siguran)

**Ishodi:**

- ✅ **Tip prepoznat** → **KLASIFIKACIJA ZAVRŠENA** → Smesti u folder
- ❌ **Tip nije prepoznat** → **MANUAL REVIEW** (Nedovršen folder)

---

## ⚠️ Manual Review - Nedovršeni Folderi

### Razlozi za Manual Review

1. **Klijent nije identifikovan** (ni po PIB-u, ni po email-u)
2. **Tip dokumenta nije siguran** (niska pouzdanost OCR/AI)

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

| Korak                     | Akcija               | Uspeh →  | Neuspeh →     |
| ------------------------- | -------------------- | -------- | ------------- |
| **1. PIB Identifikacija** | OCR ekstraktuje PIB  | KORAK 3  | KORAK 2       |
| **2. Email Fallback**     | Provera email domena | KORAK 3  | MANUAL REVIEW |
| **3. Tip Dokumenta**      | OCR/AI klasifikacija | ZAVRŠENO | MANUAL REVIEW |

**Cilj:** Minimizovati manual review (<10% slučajeva) uz održavanje visoke tačnosti klasifikacije.

---
