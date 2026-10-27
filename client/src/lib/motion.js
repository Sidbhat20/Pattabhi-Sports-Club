import { gsap } from 'gsap';

// State feedback only: a row that was just saved gets a short maroon wash.
export function flashRow(el) {
  if (!el) return;
  gsap.fromTo(el, { backgroundColor: 'rgba(156, 36, 44, 0.12)' }, { backgroundColor: 'rgba(156, 36, 44, 0)', duration: 0.6, ease: 'power1.out', clearProps: 'backgroundColor' });
}
