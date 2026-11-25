'use strict';

(() => {
  const storageKey = 'tp-supervision-theme';
  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
  let preference = null;

  function readPreference() {
    try {
      const saved = localStorage.getItem(storageKey);
      preference = ['light', 'dark'].includes(saved) ? saved : null;
    } catch {
      // Le choix reste utilisable en mémoire si le stockage est indisponible.
    }
  }

  function applyTheme() {
    const theme = preference || (systemTheme.matches ? 'dark' : 'light');
    document.documentElement.dataset.theme = theme;

    for (const radio of document.querySelectorAll('input[name="site-theme"]')) {
      radio.checked = radio.value === theme;
    }

    document.dispatchEvent(new Event('supervision-theme'));
  }

  readPreference();
  applyTheme();

  document.addEventListener('DOMContentLoaded', () => {
    const header = document.querySelector('#app-header');

    header.innerHTML = `
      <div class="topbar">
        <a class="brand" href="/">
          <span class="brand-icon" aria-hidden="true">∿</span>
          Supervision industrielle
        </a>

        <nav class="main-nav" aria-label="Navigation principale">
          <a href="/" data-page="direct">Direct</a>
          <a href="/automates.html" data-page="automates">Automates</a>
          <a href="/variables.html" data-page="variables">Variables</a>
          <a href="/historique.html" data-page="historique">Historique</a>
        </nav>

        <fieldset class="theme-switch">
          <legend class="sr-only">Thème de l’interface</legend>
          <label>
            <input type="radio" name="site-theme" value="light">
            <span>Clair</span>
          </label>
          <label>
            <input type="radio" name="site-theme" value="dark">
            <span>Sombre</span>
          </label>
        </fieldset>
      </div>
    `;

    for (const link of header.querySelectorAll('nav a')) {
      if (link.dataset.page === document.body.dataset.page) {
        link.setAttribute('aria-current', 'page');
      }
    }

    header.addEventListener('change', event => {
      if (event.target.name !== 'site-theme') return;

      preference = event.target.value;
      try {
        localStorage.setItem(storageKey, preference);
      } catch {
        // applyTheme applique aussi le choix pour la page courante.
      }
      applyTheme();
    });

    applyTheme();
  });

  systemTheme.addEventListener('change', applyTheme);

  window.addEventListener('pageshow', () => {
    readPreference();
    applyTheme();
  });
})();