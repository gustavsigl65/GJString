# GJ Strings Apps Script

Tento skript se vloží do Google tabulky přes **Rozšíření -> Apps Script**.

## Listy v tabulce

Stávající listy zůstanou:

```text
Rakety:  kod | nazev | majitel | delka | uzly
Data:    kod | datum | typ | napeti
Vyplety: kod | majitel | nazev | mnozstvi
```

Nový list pro přihlášení vyplétačů v jednoduché první verzi:

```text
Vypletaci: id | jmeno | email | heslo | role | aktivni
```

Příklad:

```text
VYP001 | Gustav Sigl | gustav@email.cz | mojeheslo | admin | ano
```

Později je možné přejít na bezpečnější variantu:

```text
Vypletaci: id | jmeno | email | heslo_hash | sul | role | aktivni
```

## Nasazení

1. V Google tabulce otevři **Rozšíření -> Apps Script**.
2. Vlož obsah souboru `Code.gs`.
3. Klikni **Deploy -> New deployment**.
4. Typ vyber **Web app**.
5. Execute as: **Me**.
6. Who has access: **Anyone**.
7. Zkopíruj URL končící `/exec`.

Tuto URL potom vložíme do webu jako servisní API.

## Co API umí

- `login`: přihlášení vyplétače
- `addRacket`: registrace nové rakety do listu `Rakety`
- `addString`: přidání výpletu do listu `Vyplety`
- `addStringing`: zápis vypletení do listu `Data` a odečtení 1 kusu z výpletu podle kódu
