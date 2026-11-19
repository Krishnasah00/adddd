/* Application bootstrap: shared modules initialise once, here. */
document.addEventListener('DOMContentLoaded', () => { window.AppAlert?.init(); window.toast?.init(); window.AppForms?.init(); });
