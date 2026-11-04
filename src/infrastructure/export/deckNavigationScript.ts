/**
 * The navigation script written into every exported deck. It is a plain
 * string so the exported file needs no bundler, no module and no network.
 *
 * Two rules it keeps: the deck must work from file:// (where replaceState can
 * throw on a null origin), and the hash must survive a reload.
 */
export const DECK_NAVIGATION_SCRIPT = `
  const slides = Array.from(document.querySelectorAll('.slide'));
  const stage = document.getElementById('stage');
  const counter = document.getElementById('counter');
  const progress = document.getElementById('progress');

  let index = Math.min(
    slides.length - 1,
    Math.max(0, (parseInt(location.hash.slice(1), 10) || 1) - 1),
  );

  function showSlideAt(nextIndex, replaceHash) {
    index = (nextIndex + slides.length) % slides.length;

    slides.forEach(function (slide, position) {
      slide.classList.toggle('active', position === index);
    });

    counter.textContent = (index + 1) + ' / ' + slides.length;
    progress.style.width = (((index + 1) / slides.length) * 100) + '%';

    if (replaceHash === false) return;

    try {
      history.replaceState(null, '', '#' + (index + 1));
    } catch (error) {
      location.hash = String(index + 1);
    }
  }

  function fitStageToWindow() {
    const scale = Math.min(window.innerWidth / 1280, window.innerHeight / 720) * 0.94;
    stage.style.transform = 'scale(' + scale + ')';
  }

  window.addEventListener('resize', fitStageToWindow);

  window.addEventListener('hashchange', function () {
    const targetIndex = (parseInt(location.hash.slice(1), 10) || 1) - 1;
    if (targetIndex !== index) showSlideAt(targetIndex, false);
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'ArrowRight' || event.key === 'PageDown' || event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      showSlideAt(index + 1);
    } else if (event.key === 'ArrowLeft' || event.key === 'PageUp' || event.key === 'Backspace') {
      event.preventDefault();
      showSlideAt(index - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      showSlideAt(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      showSlideAt(slides.length - 1);
    } else if (event.key === 'f' || event.key === 'F') {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen();
    }
  });

  document.getElementById('prev').addEventListener('click', function () {
    showSlideAt(index - 1);
  });

  document.getElementById('next').addEventListener('click', function () {
    showSlideAt(index + 1);
  });

  let touchStartX = null;

  document.addEventListener('touchstart', function (event) {
    touchStartX = event.changedTouches[0].clientX;
  }, { passive: true });

  document.addEventListener('touchend', function (event) {
    if (touchStartX === null) return;
    const deltaX = event.changedTouches[0].clientX - touchStartX;
    if (Math.abs(deltaX) > 48) showSlideAt(index + (deltaX < 0 ? 1 : -1));
    touchStartX = null;
  }, { passive: true });

  fitStageToWindow();
  showSlideAt(index, true);
`;
