// Fixed scenes for screenshots: ?shot=editor shows the editor with a sample photo loaded;
// ?shot=cover shows the cover alone at an export size. The scene comes from the query:
// photo (a sample name), caption, subtitle, layout and size (WxH). window.__shotReady is set
// once the scene is painted; for a cover the exact exported PNG is exposed as
// window.__exportDataURL so a screenshot script can save the PNG the app wrote.
export async function runShot(shot, query, setup) {
  if (shot === 'cover') document.body.classList.add('shot-cover');
  const scene = {
    photo: query.get('photo') ?? 'pier',
    title: query.get('caption') ?? 'Sunset Heist',
    subtitle: query.get('subtitle') ?? 'A STORY IN EVERY FRAME',
    layout: query.get('layout') ?? 'hero',
    size: query.get('size') ?? '1080x1080',
    grade: query.get('grade') != null ? Number(query.get('grade')) / 100 : null,
  };
  await setup(scene);
  try { await document.fonts.load('100px Anton'); } catch { /* fall back to sans-serif */ }
  await document.fonts.ready;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    window.__shotReady = true;
    if (shot === 'cover') {
      const canvas = document.getElementById('preview');
      window.__exportDataURL = canvas.toDataURL('image/png');
    }
  }));
}
