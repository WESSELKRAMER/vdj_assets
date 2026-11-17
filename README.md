# vdj_assets

Scripts en stijlen voor [vandejong.com](https://www.vandejong.com) (Webflow), geserveerd via jsDelivr.

## Opbouw

```
src/
  core.js            lifecycle (mount/unmount per pagina), GSAP + Lenis, page reveal
  barba.js           paginaovergangen met Barba + opstarten (laatste in de bundle)
  modules/
    globals.js       nav, cursor, voortgangsbalk-klik, logo-tagline (buiten de container)
    text.js          split headings, highlight text, hover chars, jaartal, data-animate
    pages.js         voortgangsbalk, footer parallax, image parallax, marquee, swiper, folder cards
    media.js         Bunny HLS-video's (achtergrond + speler)
    gallery.js       lightbox
    home.js          canvas, lijstweergave, mode switcher, text loop (home + /ons-werk)
    about.js         kantoorillustratie + skip-knop, mensen-cutouts (/over-ons)
  vdj.css            alle site-stijlen
dist/                build-output (dit laadt Webflow)
webflow/             head- en footercode om in Webflow te plakken
animations/          frames voor de kantoorillustratie
test/serve.mjs       lokale testserver
```

Elke module registreert zich met `VDJ.page(naam, fn)`. `fn(container)` draait op elke pagina,
ook na een Barba-overgang. Alles wat GSAP daarin aanmaakt (tweens, ScrollTriggers, SplitTexts)
wordt bij het verlaten van de pagina automatisch opgeruimd. Event listeners en andere zaken ruim je
op in de functie die `fn` teruggeeft.

## Werken

```bash
npm install
npm run build      # src/ -> dist/
npm run serve      # http://localhost:8787
```

`npm run serve` haalt de live site op en vervangt de Webflow custom code door `webflow/head.html` +
`webflow/footer.html`, met de scripts uit `dist/`. Zo test je precies wat je in Webflow gaat zetten.
`MIN=0 npm run serve` laadt de leesbare `dist/vdj.js`.

## Live zetten

1. `npm run build`, commit en push (inclusief `dist/`).
2. Vervang in `webflow/head.html` en `webflow/footer.html` `COMMIT` door de korte commit-hash.
3. Webflow → Site settings → Custom code: vervang de head- en footercode door die twee bestanden.
4. Publiceer eerst naar staging (`*.webflow.io`) en test daar.

Altijd vastzetten op een commit-hash (nooit `@main`): jsDelivr cachet branches tot 7 dagen.

## Eenmalig in Webflow (voor Barba)

- **Alle templates**: zet `data-barba="container"` op de wrapper die alle pagina-inhoud bevat (nu
  `main.page_wrapper` met `data-transition-container`). `data-barba="wrapper"` staat al op `<body>`.
- **Case-template** (`/cases/...`): de hero (`.section_case_hero`) staat nu *buiten* de container.
  Verplaats de container zodat de hero erin valt. Tot die tijd laden case-pagina's met een gewone
  page load (het script ziet dat de opbouw afwijkt).
- **Home + /ons-werk**: de page-level code (preloader + text loop CSS) mag weg, die zit nu in `vdj.css`.
- **Over ons**: het `<script>` in de illustratie-embed mag weg (zit nu in `about.js`). De markup en
  `<style>` van de embed blijven staan. Laat je het script staan, dan doet het niets (het checkt of
  de illustratie al gebouwd is).
- Paginaspecifieke custom code in de **head of footer van een pagina** draait niet na een
  Barba-overgang. Zet zulke code in een module in `src/`.

## Instellingen per element

| Attribuut | Waar | Effect |
| --- | --- | --- |
| `data-sequence-length="1000"` | `.sequence_section` | scrolllengte illustratie in vh (desktop) |
| `data-sequence-length-mobile="800"` | `.sequence_section` | idem, mobiel |
| `data-footer-parallax-touch="true"` | `[data-footer-parallax]` | footer parallax ook op touch-apparaten |
| `data-barba-prevent` | link | link zonder Barba (gewone page load) |
