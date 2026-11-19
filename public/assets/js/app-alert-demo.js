/* App Alert Preview card: demonstration buttons only. The reusable system lives in app-alert.js. */
(() => {
  const card = document.getElementById('app-alert-preview');
  if (!card || !window.AppAlert) return;
  const out = document.getElementById('aa-result');
  const report = r => {
    if (out) out.textContent = 'Last result: ' + (r.isConfirmed ? 'confirmed' : r.isDismissed ? `dismissed (${r.dismiss})` : r.isDenied ? 'denied' : 'none');
    return r;
  };
  const fire = options => AppAlert.fire(options).then(report);
  const DEMOS = {
    success: () => fire({ icon: 'success', title: 'Success!', text: 'Operation completed successfully.' }),
    error: () => fire({ icon: 'error', title: 'Error!', text: 'Something went wrong. Please try again.' }),
    warning: () => fire({ icon: 'warning', title: 'Warning!', text: 'Please review this action before continuing.' }),
    info: () => fire({ icon: 'info', title: 'Information', text: 'Here is some useful information.' }),
    delete: async () => {
      const result = await fire({ icon: 'warning', title: 'Are you sure?', text: "You won't be able to undo this action.", showCancelButton: true, confirmButtonText: 'Yes, delete it!', cancelButtonText: 'Cancel' });
      if (result.isConfirmed) await fire({ icon: 'success', title: 'Deleted!', text: 'The item was deleted successfully.' });
    },
    colors: () => fire({ icon: 'info', title: 'Custom buttons', text: 'These buttons use custom colors and a reversed order.', showCancelButton: true, confirmButtonText: 'Save', cancelButtonText: 'Discard', confirmButtonColor: '#7c3aed', cancelButtonColor: '#0f766e', reverseButtons: true }),
    noclose: () => fire({ icon: 'info', title: 'No close button', text: 'This alert has no close (X) button. Use OK to continue.', showCloseButton: false }),
    nooutside: () => fire({ icon: 'warning', title: 'Outside click disabled', text: 'Clicking the backdrop will not dismiss this alert.', allowOutsideClick: false }),
    noescape: () => fire({ icon: 'warning', title: 'Escape key disabled', text: 'Pressing Escape will not dismiss this alert.', allowEscapeKey: false, showCloseButton: true })
  };
  card.addEventListener('click', e => { const b = e.target.closest('[data-alert]'); if (b && DEMOS[b.dataset.alert]) DEMOS[b.dataset.alert](); });
})();
