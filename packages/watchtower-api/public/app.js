/* Watchtower Dashboard — client-side JS */

function filterAgents() {
  const input = document.getElementById('agent-search');
  if (!input) return;
  const filter = input.value.toLowerCase();
  const rows = document.querySelectorAll('#agent-table tbody tr');
  rows.forEach(function (row) {
    const text = row.textContent.toLowerCase();
    row.style.display = text.includes(filter) ? '' : 'none';
  });
}
