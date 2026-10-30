(() => {
  const filter = document.querySelector('#collectionFilter');
  const cards = [...document.querySelectorAll('.sample-product')];
  const title = document.querySelector('#shopTitle');
  const count = document.querySelector('#shopCount');
  if (!filter || !cards.length) return;

  const labels = {
    all: 'A few good finds.',
    handbags: 'Handbags, with history.',
    jewelry: 'A little extra sparkle.',
    timepieces: 'Time, well spent.',
    'small-treasures': 'The little essentials.',
    'rare-finds': 'Something unexpected.',
  };

  const applyFilter = (category) => {
    const selected = labels[category] ? category : 'all';
    filter.value = selected;
    cards.forEach((card) => { card.hidden = selected !== 'all' && card.dataset.category !== selected; });
    title.innerHTML = selected === 'all' ? 'A few <em>good finds.</em>' : `<em>${labels[selected]}</em>`;
    const visible = cards.filter((card) => !card.hidden).length;
    count.textContent = `${visible} concept ${visible === 1 ? 'piece' : 'pieces'}`;
  };

  filter.addEventListener('change', () => applyFilter(filter.value));
  const requestedCategory = new URLSearchParams(window.location.search).get('collection') || 'all';
  applyFilter(requestedCategory);
})();
