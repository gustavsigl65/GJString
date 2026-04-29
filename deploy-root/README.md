# GJ Strings web

Staticka webova aplikace pro zobrazeni rakety a historie vypletu po naskenovani QR kodu.

## Lokalni test

Pro kameru je potreba HTTPS nebo localhost. Na Vercelu bude kamera fungovat pres HTTPS. Lokalni otevreni pres `file:///` slouzi jen pro vzhled a data.

## Publikovani na Vercel

1. Nahraj projekt do GitHub repozitare.
2. Ve Vercelu zvol `Add New Project`.
3. Vyber GitHub repozitar.
4. Framework nech `Other`.
5. Build command nech prazdny.
6. Output directory nastav na `public`.
7. Deploy.

QR kody na raketach mohou odkazovat napr. na:

```text
https://tvoje-aplikace.vercel.app/?code=raketa001
```

## Google Sheet

Aplikace cte publikovane CSV listy:

- Rakety: `gid=0`
- Data: `gid=830114346`
- Vyplety: `gid=2116292174`

Web data pouze cte. Do tabulky ani Apps Scriptu nic nezapisuje.
