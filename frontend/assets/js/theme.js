const toggle = document.getElementById("themeToggle");
if (toggle) {
  toggle.addEventListener("click", () => {
    const html = document.documentElement;
    html.classList.toggle("dark");
    toggle.innerHTML = html.classList.contains("dark") ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
  });
}