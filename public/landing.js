// Landing page: buttons that open the assistant.
(function () {
  'use strict';
  document.addEventListener('click', function (e) {
    var trigger = e.target.closest('[data-open-assistant]');
    if (trigger && window.LapaasAssistant) window.LapaasAssistant.open();
  });
})();
