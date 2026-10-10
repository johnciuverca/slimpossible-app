import '@testing-library/jest-dom/vitest'
// jsdom has no native modal/focus implementation. Real browsers cover behavior.
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open')
  }
}
