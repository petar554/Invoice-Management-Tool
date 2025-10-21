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

- **PIB organizacije** - Koristi se za prepoznavanje dokumenata dje je računovodstvena firma primalac
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
┌──────────────────────────────────────────┐
│   DOKUMENT STIGAO PUTEM EMAIL-A          │
└────────────────┬─────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────┐
│  KORAK 1: ODREĐIVANJE TIPA DOKUMENTA     │
│  • OCR skeniranje cijelog dokumenta      │
│  • Pretraga ključnih riječi              │
│  • Confidence scoring                    │
└────────────────┬─────────────────────────┘
                 │
          ┌──────┴──────────┐
          │                 │
    ✅ Confidence      ❌ Confidence
       >= 80%             < 80%
          │                 │
          │                 ▼
          │         ┌──────────────────┐
          │         │ MANUAL REVIEW    │
          │         └──────────────────┘
          │
          ▼
┌──────────────────────────────────────────┐
│  KORAK 2: IDENTIFIKACIJA KLIJENTA        │
│  • Za FAKTURU: PIB izdavaoca/primaoca    │
│  • Za IZVOD: Broj računa ili PIB         │
│  • Za UGOVOR: PIB                        │
└────────────────┬─────────────────────────┘
                 │
          ┌──────┴──────────┐
          │                 │
    ✅ Klijent          ❌ Klijent
    Identifikovan       Nije Pronađen
          │                 │
          │                 ▼
          │         ┌──────────────────┐
          │         │ KORAK 3:         │
          │         │ Email Fallback   │
          │         └────────┬─────────┘
          │                  │
          │           ┌──────┴─────┐
          │           │            │
          │        ✅ Email    ❌ Email
          │        Match       Ne Match
          │           │            │
          └───────────┴────┐       │
                           │       ▼
                           │  ┌──────────────┐
                           │  │MANUAL REVIEW │
                           │  └──────────────┘
                           │
                           ▼
                ┌──────────────────────┐
                │ ✅ KLASIFIKACIJA     │
                │    ZAVRŠENA          │
                └──────────────────────┘
```

---

## Detaljna Logika po Koracima

### **KORAK 1: Određivanje Tipa Dokumenta**

**Sistem otvara dokument i OCR skenira CIJELI dokument paralelno tražeći ključne riječi za SVE tipove.**

---

#### **A) FAKTURA - Confidence Scoring**

**Pravilo:**

```
Base Confidence: 60%
+ PIB izdavaoca I PIB primaoca pronađeni: +10% → 70%
+ Klijent identifikovan (izdavalac/primalac određen): +10% → 80%+
```

**Proces:**

1. **OCR traži ključne riječi** (u gornjih 30% dokumenta):

   - `"FAKTURA"`, `"INVOICE"`, `"RAČUN"`, `"BROJ FAKTURE"`

2. **AKO pronađeno:**

   - Postavi tip: **FAKTURA**
   - Base confidence: **60%**

3. **Ekstraktuj PIB-ove:**

   - OCR traži sve nizove od 8 cifara
   - Za svaki PIB analiziraj okolni tekst (±200 karaktera)
   - Pretraga ključnih riječi:
     - `"Izdavalac", "Dobavljač", "Prodavac"` → PIB izdavaoca
     - `"Primalac", "Kupac", "Naručilac"` → PIB primaoca
   - Ako se pojavi ključna riječ fakture (na primjer: 'PDV') ≥ 3 od ovih, klasifikovati dokument kao fakturu sa visokim povjerenjem (> 80%).

4. **AKO pronađena 2 PIB-a:**

   - Confidence: **70%**

5. **Uporedi PIB organizacije sa PIB-ovima na fakturi:**

   - **PIB org = PIB primaoca** → **ULAZNA FAKTURA** (klijent = izdavalac)
   - **PIB org = PIB izdavaoca** → **IZLAZNA FAKTURA** (klijent = primalac)

6. **AKO klijent identifikovan:**
   - Confidence: **80%+**
   - → Prelazi na KORAK 2

**Ishod:**

- **Confidence >= 80%** → Prelazi na KORAK 2
- **Confidence < 80%** → **MANUAL REVIEW**

---

#### **B) IZVOD - Confidence Scoring**

**Pravilo:**

```
Base Confidence: 75%
+ Podaci o banci u prvom dijelu: +5% → 80%
+ Riječ "BANKA" pronađena: +5% → 85%
+ Isključivo jedan PIB: +2% → 87%
```

**Proces:**

1. **OCR traži ključne riječi** (u gornjih 20% dokumenta):

   - `"IZVOD"`, `"IZVOD PROMETA"`, `"IZVOD PO RAČUNU"`
   - `"STATEMENT"`, `"BANK STATEMENT"`, `"ACCOUNT STATEMENT"`
   - Ako se pojavi ključna riječ izvoda (na primjer: 'prethodno stanje', 'novo stanje') ≥ 3 od ovih, klasifikovati dokument kao IZVOD sa visokim povjerenjem (> 80%).

2. **AKO pronađeno:**

   - Postavi tip: **IZVOD**
   - Base confidence: **75%**

3. **Provjera podataka o banci** (u prvom dijelu - gornjih 20%):

   - OCR traži nazive banaka:
     - `"ERSTE BANK"`, `"CKB"`, `"HIPOTEKARNA BANKA"`, itd.
   - **AKO pronađeno:**
     - Confidence: **80%**

4. **Pretraga riječi "BANKA":**

   - **AKO pronađeno:**
     - Confidence: **85%**

5. **Brojanje PIB-ova:**

   - OCR ekstraktuje sve PIB-ove
   - **AKO tačno 1 PIB:**
     - Confidence: **87%**

6. **Ekstraktuj broj računa:**
   - Format: `XXX-XXXXXXXXXXXX` ili `MEXXXXXXXXXXXXXXXXXX`

**Ishod:**

- **Confidence >= 80%** → Prelazi na KORAK 2
- **Confidence < 80%** → **MANUAL REVIEW**

---

#### **C) UGOVOR - Confidence Scoring**

**Pravilo:**

```
Base Confidence: 90%
+ PIB pronađen: +5% → 95%
```

**Proces:**

1. **OCR traži ključne riječi:**

   - `"UGOVOR"`, `"CONTRACT"`, `"UGOVORNE STRANKE"`

2. **AKO pronađeno:**

   - Postavi tip: **UGOVOR**
   - Base confidence: **90%**

3. **Ekstraktuj PIB:**
   - **AKO pronađen:**
     - Confidence: **95%**

**Ishod:**

- **Confidence >= 80%** → Prelazi na KORAK 2

---

### **KORAK 2: Identifikacija Klijenta**

**Aktivira se SAMO ako tip dokumenta je određen sa confidence >= 80%.**

---

#### **A) Za FAKTURU:**

**Proces:**

1. Klijent je već identifikovan u KORAKU 1 (tokom confidence scoring-a)
2. Pretraži bazu po PIB-u klijenta:
   - Za ULAZNU: PIB izdavaoca
   - Za IZLAZNU: PIB primaoca

**Ishodi:**

- **Klijent pronađen u bazi** → **KLASIFIKACIJA ZAVRŠENA**
- **Klijent nije u bazi** → Prelazi na KORAK 3

---

#### **B) Za IZVOD:**

**Prioritet metoda:**

1. **Broj računa** (najsigurniji):

   - Pretraži bazu po broju računa (lokalni ili IBAN)

2. **PIB** (ako postoji):

   - Pretraži bazu po PIB-u

3. **Naziv klijenta** (najmanje pouzdan):
   - Fuzzy matching u bazi

**Ishodi:**

- **Klijent pronađen** → **KLASIFIKACIJA ZAVRŠENA**
- **Klijent nije pronađen** → Prelazi na KORAK 3

---

#### **C) Za UGOVOR:**

**Proces:**

1. Pretraži bazu po PIB-u

**Ishodi:**

- **Klijent pronađen** → **KLASIFIKACIJA ZAVRŠENA**
- **Klijent nije pronađen** → Prelazi na KORAK 3

---

### **KORAK 3: Email Fallback**

**Aktivira se ako klijent nije pronađen u KORAKU 2.**

**Proces:**

1. Proveri email pošiljaoca
2. Izvuci domen (npr. `@restoran-montenegro.me`)
3. Pretraži bazu klijenata po email domenu

**Ishodi:**

- **Email domen prepoznat** → **KLASIFIKACIJA ZAVRŠENA**
- **Email domen nije prepoznat** → **MANUAL REVIEW**

---

## Manual Review - Nedovršeni Folderi

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

- **Žuta boja** foldera (warning status)
- **Crvena boja** za urgentne slučajeve
- **Aktivne notifikacije** za računovođu
- **Highlight** (border, animacija)

---

## Testni Scenariji

### **Scenario 1: Uspešna Klasifikacija Izvoda (Broj Računa Match)**

**Setup:**

- Klijent: "Restoran Montenegro DOO" (PIB: 02987654, Račun: 540-000000000787106)
- Dokument: Izvod iz banke u PDF formatu

**Tok:**

1. Email stigne sa `banka@erste.me`
2. OCR prepoznaje ključne riječi: "IZVOD PROMETA" + "ERSTE BANK"
3. Tip dokumenta: **IZVOD**
4. OCR ekstraktuje broj računa: `540-000000000787106`
5. Sistem pronalazi klijenta u bazi po broju računa
6. Dokument se klasifikuje

**Rezultat:**

```
   Tip: IZVOD
   Klijent: Restoran Montenegro DOO (Račun match)
   Folder: /org_123/Restoran_Montenegro/Izvodi/ime_dokumenta_vrijeme
   Status: KLASIFIKOVAN
```

---

### **Scenario 2: Uspešna Klasifikacija Fakture (PIB Match)**

**Setup:**

- Klijent: "IT Company DOO" (PIB: 02333444, Email: office@itcompany.me)
- Dokument: Faktura u PDF formatu

**Tok:**

1. Email stigne sa `kontakt@gmail.com` (privatni email)
2. OCR prepoznaje ključnu riječ: "FAKTURA"
3. Tip dokumenta: **FAKTURA**
4. OCR ekstraktuje PIB: `02333444`
5. Sistem pronalazi klijenta u bazi
6. OCR određuje tip: "Ulazna Faktura"
7. Dokument se klasifikuje

**Rezultat:**

```
   Tip: ULAZNA FAKTURA
   Klijent: IT Company DOO (PIB match)
   Folder: /org_123/IT_Company/Ulazne_Fakture/ime_dokumenta_vrijeme
   Status: KLASIFIKOVAN
```

---

### **Scenario 3: Uspešna Klasifikacija (Email Fallback)**

**Setup:**

- Klijent: "Cafe Bar XYZ" (PIB: 02444555, Email: office@cafexyz.me)
- Dokument: Račun bez PIB-a (reprezentacija)

**Tok:**

1. Email stigne sa `marko@cafexyz.me`
2. OCR prepoznaje ključnu riječ: "RAČUN"
3. Tip dokumenta: **FAKTURA**
4. OCR ne pronalazi PIB na dokumentu
5. Sistem prepoznaje email domen `@cafexyz.me`
6. Sistem pronalazi klijenta u bazi
7. Dokument se klasifikuje

**Rezultat:**

```
   PIB nije pronađen na dokumentu
   Tip: FAKTURA
   Klijent: Cafe Bar XYZ (Email match)
   Folder: /org_123/Cafe_Bar_XYZ/Ulazne_Fakture/ime_dokumenta_vrijeme
   Status: KLASIFIKOVAN
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
   Tip: FAKTURA
   PIB 02777888 nije u bazi
   Email unknown@newcompany.me nije u bazi
   MANUAL REVIEW potreban
   Folder: /manual_review/unknown@newcompany.me-02777888/ime_dokumenta
   Notifikacija poslata računovodstvu i pojavljuje se u aplikaciji
   Status: PENDING_REVIEW
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
   Klijent: Restoran Super DOO (PIB match)
   Tip dokumenta nije prepoznat (confidence: 45%)
   MANUAL REVIEW potreban
   Folder: /manual_review/office@super.me-02555666/ime_dokumenta
   Notifikacija poslata računovodstvu i pojavljuje se u aplikaciji
   Status: PENDING_REVIEW
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

### **Flow Klasifikacije:**

```
DOKUMENT → KORAK 1 (Tip dokumenta + Confidence)
           ↓
    Confidence >= 80%?
    ✅ DA → KORAK 2 (Identifikacija klijenta)
            ↓
        Klijent pronađen?
        ✅ DA → ZAVRŠENO
        ❌ NE → KORAK 3 (Email fallback)
                ↓
            Email match?
            ✅ DA → ZAVRŠENO
            ❌ NE → MANUAL REVIEW

    ❌ NE → MANUAL REVIEW
```

### **Confidence Thresholds:**

| Tip Dokumenta | Base | Max Confidence                | Threshold |
| ------------- | ---- | ----------------------------- | --------- |
| **FAKTURA**   | 60%  | 80%+ (sa PIB-ovima + klijent) | 80%       |
| **IZVOD**     | 75%  | 87% (sa bankom + PIB)         | 80%       |
| **UGOVOR**    | 90%  | 95% (sa PIB-om)               | 80%       |

**Pravilo:** Ako confidence < 80% → Automatski MANUAL REVIEW

---

### **Prioritet Identifikacije Klijenta:**

| Tip         | Metod 1                | Metod 2     | Metod 3        |
| ----------- | ---------------------- | ----------- | -------------- |
| **FAKTURA** | PIB izdavaoca/primaoca | Email domen | -              |
| **IZVOD**   | Broj računa            | PIB         | Naziv klijenta |
| **UGOVOR**  | PIB                    | Email domen | -              |

**Cilj:** Minimizovati manual review (<10% slučajeva) uz confidence >= 80% za tip dokumenta.

---
