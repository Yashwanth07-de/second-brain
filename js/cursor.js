/* ═══════════════════════════════════════════
   cursor.js — custom animated cursor
   Dot that follows instantly + lagging ring
═══════════════════════════════════════════ */

const Cursor = (() => {
  let mouseX = 0, mouseY = 0;
  let ringX = 0, ringY = 0;
  const LERP = 0.12; // ring lag factor (lower = more lag)

  function init() {
    const dot  = document.getElementById('cursor-dot');
    const ring = document.getElementById('cursor-ring');
    if (!dot || !ring) return;

    // Move dot instantly
    document.addEventListener('mousemove', e => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      dot.style.left = mouseX + 'px';
      dot.style.top  = mouseY + 'px';
    });

    // Animate ring with lerp
    function animateRing() {
      ringX += (mouseX - ringX) * LERP;
      ringY += (mouseY - ringY) * LERP;
      ring.style.left = ringX + 'px';
      ring.style.top  = ringY + 'px';
      requestAnimationFrame(animateRing);
    }
    animateRing();

    // Hover state on interactive elements
    const interactives = 'button, a, input, select, textarea, [data-section], .note-card, .list-item, .tag-pill, .savings-card, .cc-card, .glance-task-cb';
    document.addEventListener('mouseover', e => {
      if (e.target.closest(interactives)) {
        document.body.classList.add('cursor-hover');
      }
    });
    document.addEventListener('mouseout', e => {
      if (e.target.closest(interactives)) {
        document.body.classList.remove('cursor-hover');
      }
    });

    // Click state
    document.addEventListener('mousedown', () => document.body.classList.add('cursor-click'));
    document.addEventListener('mouseup',   () => document.body.classList.remove('cursor-click'));

    // Hide cursor when leaving window
    document.addEventListener('mouseleave', () => {
      dot.style.opacity  = '0';
      ring.style.opacity = '0';
    });
    document.addEventListener('mouseenter', () => {
      dot.style.opacity  = '1';
      ring.style.opacity = '1';
    });
  }

  return { init };
})();
