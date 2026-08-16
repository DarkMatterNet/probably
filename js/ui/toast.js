export function createToast(region) {
  return function announce(message) {
    if (!region) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = String(message);
    region.append(toast);

    window.setTimeout(() => {
      toast.classList.add('is-leaving');
      window.setTimeout(() => toast.remove(), 200);
    }, 2600);
  };
}
