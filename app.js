(function () {
  const SIMS = [
    { id: 'sim1', n: 1, title: 'A train of three pulses', when: 'Video: pause card 1 (PAUSE1)',
      make: (h) => SSSims.TrainSim(h),
      tries: [
        'Press Play and watch the row: pulse 1 makes the FID, the row twists into a corkscrew, pulse 2 splits it, and the spin echo forms at time 2.',
        'Stop just after pulse 2. The purple arrows are the stored part: straight up or straight down along B0, in a stripe along the row. They do not move until pulse 3.',
        'Move pulse 3 later and watch the stimulated echo move with it: it always comes as long after pulse 3 as pulse 2 came after pulse 1.',
        'Try a flip angle of 60, then 30, and compare the size of each echo. Switch to "Whole arrow" to see each spin as one arrow.' ] },
    { id: 'sim2', n: 2, title: 'Build the steady state, pulse by pulse', when: 'Video: pause card 2 (PAUSE2)',
      make: (h) => SSSims.BuildSim(h),
      tries: [
        'Press Play. Each gold dot is the arrow just after one pulse. Watch the dots zigzag across the skewer and slide toward the teal steady-state arrow.',
        'Switch Start to "α/2 preparation": the first dot is already on the skewer, so there is no zigzag, only a smooth glide.',
        'Change the tissue: fluid ends up long (bright) and takes seconds to settle; white matter is short and settles in about fifty pulses.',
        'Switch Picture to "Lab": the same arrow, thrown from side to side because the hinge alternates. Flipping the drawing every other pulse is what makes the skewer visible.' ] },
    { id: 'sim3', n: 3, title: 'The hidden echo at TR/2', when: 'Video: pause card 3 (PAUSE3)',
      make: (h) => SSSims.MirrorSim(h),
      tries: [
        'Press Play. Just after each pulse the hands fan out one way; at TR/2 they all point forward; then they open the other way.',
        'Stop exactly at a pulse: the fan is half open, yet each spin is mirrored cleanly on its own skewer.',
        'Widen the spread toward ±170°: spins near half a turn per repetition lose their signal. That is the dark band, the subject of Part 3.',
        'Drag the 3D view to look along the hinge and watch each arrow keep its height while its flat part swings.' ] },
  ];

  const main = document.getElementById('sims');
  const live = [];
  SIMS.forEach((s) => {
    const sec = document.createElement('section');
    sec.className = 'simsec'; sec.id = s.id;
    sec.innerHTML = `
      <div class="simhead">
        <div class="num">${s.n}</div>
        <div>
          <p class="eyebrow">Simulation ${s.n} of 3 · ${s.when}</p>
          <h2>${s.title}</h2>
        </div>
      </div>
      <ol class="tries">${s.tries.map((t) => `<li>${t}</li>`).join('')}</ol>
      <div class="sim"></div>`;
    main.appendChild(sec);
    live.push(s.make(sec.querySelector('.sim')));
  });
  const redraw = () => live.forEach((x) => x.draw());
  requestAnimationFrame(redraw);
  let rt = null; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(redraw, 80); });
  if (document.fonts) document.fonts.ready.then(redraw);
})();
